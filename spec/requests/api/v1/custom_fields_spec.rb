require "rails_helper"

RSpec.describe "Api::V1::CustomFields", type: :request do
  let(:org)        { create(:organization) }
  let(:admin)      { create(:user, :admin, organization: org) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }

  def send_json(verb, url, body = nil, as: admin)
    public_send(verb, url, params: body&.to_json, headers: auth_headers_for(as).merge("Content-Type" => "application/json"))
  end

  describe "GET /custom_fields" do
    before do
      create(:custom_field, organization: org, label: "Second", position: 2)
      create(:custom_field, organization: org, label: "First", position: 1)
      create(:custom_field, :off, organization: org, label: "Off", position: 3)
      create(:custom_field, :part, organization: org, label: "Shelf")
    end

    it "gives an administrator every field, a kind of record at a time and in order, those turned off too" do
      send_json :get, "/api/v1/custom_fields"

      expect(json_body["custom_fields"].pluck("label")).to eq(%w[Shelf First Second Off])
      expect(json_body["custom_fields"].second).to include("key" => "first", "kind" => "text", "entity" => "work_order",
                                                          "required" => false, "in_list" => false, "active" => true)
    end

    it "gives everyone else the fields that are on, so any role can fill in a form" do
      [technician, requester, manager].each do |user|
        send_json :get, "/api/v1/custom_fields", as: user

        expect(response).to have_http_status(:ok)
        expect(json_body["custom_fields"].pluck("label")).to eq(%w[Shelf First Second])
      end
    end

    it "can be asked for one kind of record" do
      send_json :get, "/api/v1/custom_fields?entity=part"

      expect(json_body["custom_fields"].pluck("label")).to eq(["Shelf"])
    end

    it "does not show another company's" do
      create(:custom_field, label: "Elsewhere")
      send_json :get, "/api/v1/custom_fields"

      expect(json_body["custom_fields"].pluck("label")).not_to include("Elsewhere")
    end
  end

  describe "POST /custom_fields" do
    it "adds a field at the end of its kind of record" do
      create(:custom_field, organization: org, label: "Existing", position: 4)
      send_json :post, "/api/v1/custom_fields",
                { custom_field: { entity: "work_order", label: "Cost centre", kind: "text", required: true, in_list: true } }

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("key" => "cost_centre", "label" => "Cost centre", "required" => true,
                                           "in_list" => true, "position" => 5)
    end

    it "takes the choices of a choice list" do
      send_json :post, "/api/v1/custom_fields",
                { custom_field: { entity: "part", label: "Grade", kind: "select", options: %w[A B] } }

      expect(json_body["data"]["options"]).to eq(%w[A B])
    end

    it "says what is wrong, and adds nothing" do
      send_json :post, "/api/v1/custom_fields", { custom_field: { entity: "asset", label: "Colour", kind: "text" } }
      expect(response).to have_http_status(:unprocessable_entity)

      send_json :post, "/api/v1/custom_fields", { custom_field: { entity: "part", label: "Grade", kind: "select" } }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(org.custom_fields).to be_empty
    end

    it "refuses a second field with the same name" do
      create(:custom_field, organization: org, label: "Cost centre")
      send_json :post, "/api/v1/custom_fields", { custom_field: { entity: "work_order", label: "cost centre", kind: "number" } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("similar name")
    end

    it "is for administrators" do
      [manager, technician, requester].each do |user|
        send_json :post, "/api/v1/custom_fields", { custom_field: { entity: "part", label: "X", kind: "text" } }, as: user
        expect(response).to have_http_status(:forbidden)
      end
      expect(org.custom_fields).to be_empty
    end
  end

  describe "PATCH /custom_fields/:id" do
    let!(:field) { create(:custom_field, :select, organization: org, label: "Risk") }

    it "changes the label, the choices, the flags and whether it is on" do
      send_json :patch, "/api/v1/custom_fields/#{field.id}",
                { custom_field: { label: "Risk level", options: %w[Low High], required: true, in_list: true, active: false } }

      expect(response).to have_http_status(:ok)
      expect(field.reload).to have_attributes(label: "Risk level", options: %w[Low High], required: true, in_list: true,
                                              active: false, key: "risk")
    end

    it "ignores an attempt to change the kind or the key" do
      send_json :patch, "/api/v1/custom_fields/#{field.id}", { custom_field: { kind: "number", key: "other", label: "Risk" } }

      expect(response).to have_http_status(:ok)
      expect(field.reload).to have_attributes(kind: "select", key: "risk")
    end

    it "is for administrators, and for their own company's fields" do
      send_json :patch, "/api/v1/custom_fields/#{field.id}", { custom_field: { label: "X" } }, as: manager
      expect(response).to have_http_status(:forbidden)

      send_json :patch, "/api/v1/custom_fields/#{create(:custom_field).id}", { custom_field: { label: "X" } }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /custom_fields/reorder" do
    let!(:one)   { create(:custom_field, organization: org, label: "One", position: 1) }
    let!(:two)   { create(:custom_field, organization: org, label: "Two", position: 2) }
    let!(:three) { create(:custom_field, organization: org, label: "Three", position: 3) }
    let!(:shelf) { create(:custom_field, :part, organization: org, label: "Shelf", position: 1) }

    it "puts them in the order given" do
      send_json :patch, "/api/v1/custom_fields/reorder", { entity: "work_order", ids: [three.id, one.id, two.id] }

      expect(response).to have_http_status(:ok)
      expect(json_body["custom_fields"].pluck("label")).to eq(%w[Three One Two])
      expect(shelf.reload.position).to eq(1)
    end

    it "wants every field of the kind, once each" do
      [[one.id, two.id], [one.id, two.id, two.id], [one.id, two.id, three.id, shelf.id]].each do |ids|
        send_json :patch, "/api/v1/custom_fields/reorder", { entity: "work_order", ids: ids }
        expect(response).to have_http_status(:unprocessable_entity)
      end
      expect(three.reload.position).to eq(3)
    end

    it "is for administrators" do
      send_json :patch, "/api/v1/custom_fields/reorder", { entity: "work_order", ids: [one.id, two.id, three.id] }, as: manager

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /custom_fields/:id" do
    let!(:field) { create(:custom_field, organization: org, label: "Cost centre") }

    before { create(:custom_field, organization: org, label: "Zone") }

    it "removes the field and what was filled in for it, and nothing else" do
      mine   = create(:work_order, organization: org, custom_values: { "cost_centre" => "CC-1", "zone" => "North" })
      theirs = create(:work_order, custom_values: {})
      theirs.organization.custom_fields.create!(entity: "work_order", label: "Cost centre", kind: "text")
      theirs.update!(custom_values: { "cost_centre" => "keep me" })
      part = create(:part, organization: org)
      part.update_columns(custom_values: { "cost_centre" => "a part is not a work order" }) # rubocop:disable Rails/SkipsModelValidations

      send_json :delete, "/api/v1/custom_fields/#{field.id}"

      expect(response).to have_http_status(:no_content)
      expect(CustomField.exists?(field.id)).to be(false)
      expect(mine.reload.custom_values).to eq("zone" => "North")
      expect(theirs.reload.custom_values).to eq("cost_centre" => "keep me")
      expect(part.reload.custom_values).to eq("cost_centre" => "a part is not a work order")
    end

    it "removes a part field's values from parts, and leaves a work order's value of the same name" do
      create(:custom_field, :part, organization: org, label: "Cost centre")
      part = create(:part, organization: org, custom_values: { "cost_centre" => "P-1" })
      order = create(:work_order, organization: org, custom_values: { "cost_centre" => "W-1" })

      send_json :delete, "/api/v1/custom_fields/#{org.custom_fields.find_by(entity: 'part').id}"

      expect(part.reload.custom_values).to eq({})
      expect(order.reload.custom_values).to eq("cost_centre" => "W-1")
    end

    it "lets a new field with the same name start empty" do
      order = create(:work_order, organization: org, custom_values: { "cost_centre" => "CC-1" })
      send_json :delete, "/api/v1/custom_fields/#{field.id}"
      create(:custom_field, organization: org, label: "Cost centre")

      expect(order.reload.custom_values).to eq({})
    end

    it "is written to the audit log" do
      send_json :delete, "/api/v1/custom_fields/#{field.id}"

      expect(ActivityLog.where(action: "custom_field.deleted", resource_id: field.id)).to exist
    end

    it "is for administrators" do
      send_json :delete, "/api/v1/custom_fields/#{field.id}", as: manager

      expect(response).to have_http_status(:forbidden)
      expect(CustomField.exists?(field.id)).to be(true)
    end
  end
end
