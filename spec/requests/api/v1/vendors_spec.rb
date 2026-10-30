require "rails_helper"

RSpec.describe "Api::V1::Vendors", type: :request do
  let(:org)        { create(:organization) }
  let(:admin)      { create(:user, :admin, organization: org) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let!(:acme)      { create(:vendor, organization: org, name: "Acme Electric", category: "Electrical") }
  let!(:chill)     { create(:vendor, organization: org, name: "Chill Co", category: "HVAC", active: false) }

  describe "GET /api/v1/vendors" do
    it "lists the company's vendors by name with their categories and how many work orders each has, for a technician" do
      create(:work_order, organization: org, vendor: acme)
      get "/api/v1/vendors", headers: auth_headers_for(technician)

      expect(response).to have_http_status(:ok)
      expect(json_body["vendors"].pluck("name")).to eq(["Acme Electric", "Chill Co"])
      expect(json_body["vendors"].first).to include("work_orders_count" => 1, "category" => "Electrical", "active" => true)
      expect(json_body["categories"]).to eq(%w[Electrical HVAC])
    end

    it "filters by search text, category and whether the vendor is active" do
      get "/api/v1/vendors", params: { search: "chill" }, headers: auth_headers_for(manager)
      expect(json_body["vendors"].pluck("name")).to eq(["Chill Co"])

      get "/api/v1/vendors", params: { category: "electrical" }, headers: auth_headers_for(manager)
      expect(json_body["vendors"].pluck("name")).to eq(["Acme Electric"])

      get "/api/v1/vendors", params: { active: "true" }, headers: auth_headers_for(manager)
      expect(json_body["vendors"].pluck("name")).to eq(["Acme Electric"])
    end

    it "never shows another company's vendors, and is not for a requester" do
      create(:vendor, name: "Elsewhere")

      get "/api/v1/vendors", headers: auth_headers_for(manager)
      expect(json_body["vendors"].pluck("name")).not_to include("Elsewhere")

      get "/api/v1/vendors", headers: auth_headers_for(requester)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/vendors/:id" do
    it "returns the vendor with its contacts" do
      create(:vendor_contact, vendor: acme, name: "Priya", role: "Dispatcher", phone: "555-1")
      get "/api/v1/vendors/#{acme.id}", headers: auth_headers_for(technician)

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]["contacts"]).to contain_exactly(include("name" => "Priya", "role" => "Dispatcher", "phone" => "555-1"))
    end

    it "is not found across companies" do
      get "/api/v1/vendors/#{create(:vendor).id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/vendors" do
    let(:params) { { vendor: { name: "  Bolt Works ", category: "Welding", email: "ops@bolt.example", phone: "555-2" } } }

    it "lets a manager add a vendor, trimming the name" do
      post "/api/v1/vendors", params: params, headers: auth_headers_for(manager)

      expect(response).to have_http_status(:created)
      expect(Vendor.find(json_body["data"]["id"])).to have_attributes(name: "Bolt Works", category: "Welding", organization_id: org.id)
    end

    it "refuses a technician, a name already used (any case), and an email that is not one" do
      post "/api/v1/vendors", params: params, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)

      post "/api/v1/vendors", params: { vendor: { name: "ACME electric" } }, headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)

      post "/api/v1/vendors", params: { vendor: { name: "X", email: "nope" } }, headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "lets two companies use the same vendor name" do
      other = create(:vendor, name: "Bolt Works")
      post "/api/v1/vendors", params: params, headers: auth_headers_for(manager)

      expect(response).to have_http_status(:created)
      expect(other.reload.organization_id).not_to eq(org.id)
    end
  end

  describe "PATCH /api/v1/vendors/:id" do
    it "lets a manager change details and deactivate a vendor" do
      patch "/api/v1/vendors/#{acme.id}", params: { vendor: { phone: "555-9", active: false } }, headers: auth_headers_for(manager)

      expect(response).to have_http_status(:ok)
      expect(acme.reload).to have_attributes(phone: "555-9", active: false)
    end

    it "refuses a technician" do
      patch "/api/v1/vendors/#{acme.id}", params: { vendor: { phone: "x" } }, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /api/v1/vendors/:id" do
    it "lets an administrator delete a vendor that has never done work, with its contacts" do
      create(:vendor_contact, vendor: acme)
      delete "/api/v1/vendors/#{acme.id}", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:no_content)
      expect(Vendor.exists?(acme.id)).to be(false)
      expect(VendorContact.count).to eq(0)
    end

    it "refuses once the vendor has work orders, and says to deactivate" do
      create(:work_order, organization: org, vendor: acme)
      delete "/api/v1/vendors/#{acme.id}", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("VENDOR_IN_USE")
      expect(Vendor.exists?(acme.id)).to be(true)
    end

    it "is an administrator's, not a manager's" do
      delete "/api/v1/vendors/#{acme.id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "contacts" do
    it "lets a manager add, change and remove a person to call" do
      post "/api/v1/vendors/#{acme.id}/contacts", params: { contact: { name: "Priya", role: "Sales", email: "p@acme.example" } },
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:created)
      contact = acme.contacts.find(json_body["data"]["id"])

      patch "/api/v1/vendors/#{acme.id}/contacts/#{contact.id}", params: { contact: { phone: "555-3" } },
headers: auth_headers_for(manager)
      expect(contact.reload.phone).to eq("555-3")

      delete "/api/v1/vendors/#{acme.id}/contacts/#{contact.id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:no_content)
      expect(acme.contacts.count).to eq(0)
    end

    it "refuses a technician and a contact without a name" do
      post "/api/v1/vendors/#{acme.id}/contacts", params: { contact: { name: "X" } }, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)

      post "/api/v1/vendors/#{acme.id}/contacts", params: { contact: { name: "" } }, headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "cannot reach a contact through another vendor" do
      other = create(:vendor_contact, vendor: chill)
      patch "/api/v1/vendors/#{acme.id}/contacts/#{other.id}", params: { contact: { name: "Hijack" } },
headers: auth_headers_for(manager)

      expect(response).to have_http_status(:not_found)
      expect(other.reload.name).not_to eq("Hijack")
    end
  end
end
