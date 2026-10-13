require "rails_helper"

RSpec.describe "Api::V1::Users administration", type: :request do
  let(:org)      { create(:organization) }
  let!(:admin)   { create(:user, :admin, organization: org, first_name: "Ada", last_name: "Admin") }
  let!(:manager) { create(:user, :manager, organization: org) }
  let!(:tech)    { create(:user, organization: org, first_name: "Tess", last_name: "Tech") }

  def as(user) = auth_headers_for(user)

  describe "PATCH /api/v1/users/:id/deactivate" do
    it "deactivates the user, who can then no longer sign in" do
      patch "/api/v1/users/#{tech.id}/deactivate", headers: as(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["user"]).to include("id" => tech.id, "active" => false)

      reset!
      post "/api/v1/auth/sign_in", params: { user: { email: tech.email, password: "password123" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(json_body["error"]).to match(/deactivated/i)
    end

    it "signs them out everywhere: a token they already held stops working" do
      headers = as(tech)
      patch "/api/v1/users/#{tech.id}/deactivate", headers: as(admin), as: :json

      get "/api/v1/profile", headers: headers
      expect(response).to have_http_status(:unauthorized)
    end

    it "does not let an admin deactivate themselves" do
      patch "/api/v1/users/#{admin.id}/deactivate", headers: as(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to match(/your own account/)
      expect(admin.reload).to be_active
    end

    it "forbids a manager" do
      patch "/api/v1/users/#{tech.id}/deactivate", headers: as(manager), as: :json

      expect(response).to have_http_status(:forbidden)
      expect(tech.reload).to be_active
    end

    it "cannot reach a user in another company" do
      outsider = create(:user)
      patch "/api/v1/users/#{outsider.id}/deactivate", headers: as(admin), as: :json

      expect(response).to have_http_status(:not_found)
      expect(outsider.reload).to be_active
    end
  end

  describe "PATCH /api/v1/users/:id/reactivate" do
    it "lets a deactivated user sign in again" do
      UserAdministration.deactivate!(tech, by: admin)

      patch "/api/v1/users/#{tech.id}/reactivate", headers: as(admin), as: :json
      expect(json_body["user"]["active"]).to be true

      reset!
      post "/api/v1/auth/sign_in", params: { user: { email: tech.email, password: "password123" } }, as: :json
      expect(response).to have_http_status(:ok)
    end
  end

  describe "PATCH /api/v1/users/:id/role" do
    it "changes the role" do
      patch "/api/v1/users/#{tech.id}/role", params: { role: "manager" }, headers: as(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect(tech.reload.role).to eq("manager")
    end

    it "rejects a role that does not exist" do
      patch "/api/v1/users/#{tech.id}/role", params: { role: "superuser" }, headers: as(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(tech.reload.role).to eq("technician")
    end

    it "does not let an admin change their own role" do
      patch "/api/v1/users/#{admin.id}/role", params: { role: "technician" }, headers: as(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(admin.reload.role).to eq("admin")
    end

    it "forbids a manager" do
      patch "/api/v1/users/#{tech.id}/role", params: { role: "admin" }, headers: as(manager), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /api/v1/users/:id (edit details)" do
    it "saves the name, phone, job title and department" do
      patch "/api/v1/users/#{tech.id}", headers: as(manager), as: :json,
        params: { user: { full_name: "Tess Q Tech", phone: "555-0101", job_title: "Electrician", department: "Plant 1" } }

      expect(response).to have_http_status(:ok)
      expect(tech.reload).to have_attributes(first_name: "Tess", last_name: "Q Tech", phone: "555-0101",
                                             job_title: "Electrician", department: "Plant 1")
    end

    it "ignores email and a role sent by a manager" do
      patch "/api/v1/users/#{tech.id}", params: { user: { email: "new@example.com", role: "admin", phone: "1" } },
                                        headers: as(manager), as: :json

      tech.reload
      expect(tech).to have_attributes(role: "technician", phone: "1")
      expect(tech.email).not_to eq("new@example.com")
    end

    it "lets an admin change the role" do
      patch "/api/v1/users/#{tech.id}", params: { user: { role: "manager" } }, headers: as(admin), as: :json
      expect(tech.reload.role).to eq("manager")
    end

    it "saves nothing when the role change is refused" do
      patch "/api/v1/users/#{admin.id}", params: { user: { phone: "999", role: "technician" } }, headers: as(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(admin.reload).to have_attributes(role: "admin", phone: nil)
    end
  end

  describe "DELETE /api/v1/users/:id" do
    it "does not let an admin delete themselves" do
      delete "/api/v1/users/#{admin.id}", headers: as(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(User.exists?(admin.id)).to be true
    end
  end

  describe "bulk actions" do
    it "changes several roles at once" do
      other = create(:user, organization: org)
      patch "/api/v1/users/bulk_role", params: { ids: [tech.id, other.id], role: "requester" }, headers: as(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect([tech, other].map { |u| u.reload.role }).to all(eq("requester"))
    end

    it "deactivates several people at once" do
      other = create(:user, organization: org)
      patch "/api/v1/users/bulk_deactivate", params: { ids: [tech.id, other.id] }, headers: as(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect([tech, other].map { |u| u.reload.active? }).to all(be(false))
    end

    it "does nothing at all when one of them is the admin themselves, and says who" do
      patch "/api/v1/users/bulk_deactivate", params: { ids: [tech.id, admin.id] }, headers: as(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("Ada Admin")
      expect([tech, admin].map { |u| u.reload.active? }).to all(be(true))
    end

    it "does nothing at all when one of the ids is not in the company" do
      outsider = create(:user)
      patch "/api/v1/users/bulk_role", params: { ids: [tech.id, outsider.id], role: "manager" }, headers: as(admin), as: :json

      expect(response).to have_http_status(:not_found)
      expect(tech.reload.role).to eq("technician")
    end

    it "rejects an empty selection" do
      patch "/api/v1/users/bulk_deactivate", params: { ids: [] }, headers: as(admin), as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "forbids a manager" do
      patch "/api/v1/users/bulk_deactivate", params: { ids: [tech.id] }, headers: as(manager), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "the user list" do
    it "reports who is active, including people who were deactivated" do
      UserAdministration.deactivate!(tech, by: admin)

      get "/api/v1/users", headers: as(admin), as: :json

      rows = json_body["users"].index_by { |u| u["id"] }
      expect(rows[tech.id]["active"]).to be false
      expect(rows[manager.id]["active"]).to be true
    end
  end

  describe "work order assignment" do
    it "refuses to assign work to a deactivated person" do
      work_order = create(:work_order, organization: org)
      UserAdministration.deactivate!(tech, by: admin)

      patch "/api/v1/work_orders/#{work_order.id}/assign", params: { assignee_id: tech.id }, headers: as(manager), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(work_order.reload.assignee_id).to be_nil
    end
  end

  describe UserAdministration do
    it "never lets the last active admin be deactivated, demoted or deleted" do
      expect { described_class.deactivate!(admin, by: manager) }.to raise_error(described_class::Refused, /active admin/)
      expect { described_class.change_role!(admin, "manager", by: manager) }.to raise_error(described_class::Refused, /active admin/)
      expect { described_class.delete!(admin, by: manager) }.to raise_error(described_class::Refused, /active admin/)

      expect(admin.reload).to be_active
      expect(admin.role).to eq("admin")
      expect(User.exists?(admin.id)).to be true
    end

    it "allows removing an admin while another active admin remains" do
      second = create(:user, :admin, organization: org)

      expect { described_class.deactivate!(second, by: admin) }.not_to raise_error
      expect(second.reload).not_to be_active
    end

    it "counts a deactivated admin as no admin" do
      second = create(:user, :admin, organization: org)
      described_class.deactivate!(second, by: admin)

      expect { described_class.deactivate!(admin, by: second) }.to raise_error(described_class::Refused, /active admin/)
    end
  end
end
