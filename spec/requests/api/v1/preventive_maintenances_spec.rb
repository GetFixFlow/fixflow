require "rails_helper"

RSpec.describe "Api::V1::PreventiveMaintenances", type: :request do
  let(:organization) { create(:organization) }
  let(:admin)        { create(:user, organization: organization, role: "admin") }
  let(:manager)      { create(:user, organization: organization, role: "manager") }
  let(:technician)   { create(:user, organization: organization, role: "technician") }
  let(:asset)        { create(:asset, organization: organization) }

  let(:valid_template) do
    {
      "title"       => "Monthly PM - {asset_name}",
      "description" => "Standard inspection",
      "checklist"   => [{ "step" => 1, "instruction" => "Inspect", "required" => true }]
    }
  end

  # ─── INDEX ──────────────────────────────────────────────────────────────────

  describe "GET /api/v1/preventive_maintenances" do
    let!(:active_pm)  { create(:preventive_maintenance, :active_pm, organization: organization, asset: asset) }
    let!(:paused_pm)  { create(:preventive_maintenance, :paused_pm, organization: organization, asset: asset) }

    it "returns paginated PM schedules" do
      get "/api/v1/preventive_maintenances", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body).to have_key("pm_schedules")
      expect(json_body).to have_key("meta")
    end

    it "returns 401 without auth" do
      get "/api/v1/preventive_maintenances"
      expect(response).to have_http_status(:unauthorized)
    end

    it "filters by status" do
      get "/api/v1/preventive_maintenances",
        params: { status: "paused" },
        headers: auth_headers_for(manager)
      ids = json_body["pm_schedules"].map { |p| p["id"] }
      expect(ids).to include(paused_pm.id)
      expect(ids).not_to include(active_pm.id)
    end

    it "filters overdue PMs" do
      overdue = create(:preventive_maintenance, :overdue_pm, organization: organization, asset: asset)
      get "/api/v1/preventive_maintenances",
        params: { overdue: "true" },
        headers: auth_headers_for(manager)
      ids = json_body["pm_schedules"].map { |p| p["id"] }
      expect(ids).to include(overdue.id)
    end

    it "is scoped to current organization" do
      other_pm = create(:preventive_maintenance)
      get "/api/v1/preventive_maintenances", headers: auth_headers_for(manager)
      ids = json_body["pm_schedules"].map { |p| p["id"] }
      expect(ids).not_to include(other_pm.id)
    end
  end

  # ─── SHOW ────────────────────────────────────────────────────────────────────

  describe "GET /api/v1/preventive_maintenances/:id" do
    let(:pm) { create(:preventive_maintenance, organization: organization, asset: asset) }

    it "returns the PM with extended view" do
      get "/api/v1/preventive_maintenances/#{pm.id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["id"]).to eq(pm.id)
      expect(json_body).to have_key("template")
    end

    it "technician can view a PM" do
      get "/api/v1/preventive_maintenances/#{pm.id}", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:ok)
    end

    it "returns 404 for another org's PM" do
      other_pm = create(:preventive_maintenance)
      get "/api/v1/preventive_maintenances/#{other_pm.id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:not_found)
    end
  end

  # ─── CREATE ──────────────────────────────────────────────────────────────────

  describe "POST /api/v1/preventive_maintenances" do
    let(:valid_params) do
      {
        preventive_maintenance: {
          name:           "Monthly Inspection",
          asset_id:       asset.id,
          priority:       "medium",
          frequency_type: "time_based",
          frequency_value: 30,
          frequency_unit:  "days",
          start_date:      Date.today.iso8601,
          template:        valid_template
        }
      }
    end

    it "creates a PM schedule" do
      expect {
        post "/api/v1/preventive_maintenances", params: valid_params, headers: auth_headers_for(manager)
      }.to change(PreventiveMaintenance, :count).by(1)
      expect(response).to have_http_status(:created)
      expect(json_body["name"]).to eq("Monthly Inspection")
    end

    it "forbids technician from creating PM schedules" do
      post "/api/v1/preventive_maintenances", params: valid_params, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 422 when template is missing title" do
      bad_params = valid_params.deep_merge(
        preventive_maintenance: { template: { "description" => "no title here" } }
      )
      post "/api/v1/preventive_maintenances", params: bad_params, headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 without a name" do
      post "/api/v1/preventive_maintenances",
        params: valid_params.deep_merge(preventive_maintenance: { name: "" }),
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  # ─── UPDATE ──────────────────────────────────────────────────────────────────

  describe "PATCH /api/v1/preventive_maintenances/:id" do
    let(:pm) { create(:preventive_maintenance, organization: organization, asset: asset) }

    it "updates the PM" do
      patch "/api/v1/preventive_maintenances/#{pm.id}",
        params: { preventive_maintenance: { name: "Updated PM Name" } },
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["name"]).to eq("Updated PM Name")
    end

    it "forbids technician from updating" do
      patch "/api/v1/preventive_maintenances/#{pm.id}",
        params: { preventive_maintenance: { name: "Nope" } },
        headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end
  end

  # ─── DESTROY ─────────────────────────────────────────────────────────────────

  describe "DELETE /api/v1/preventive_maintenances/:id" do
    let!(:pm) { create(:preventive_maintenance, organization: organization, asset: asset) }

    it "archives the PM (does not hard delete)" do
      delete "/api/v1/preventive_maintenances/#{pm.id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:no_content)
      expect(pm.reload.status).to eq("archived")
      expect(PreventiveMaintenance.count).to eq(1)
    end

    it "forbids technician from deleting" do
      delete "/api/v1/preventive_maintenances/#{pm.id}", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end
  end

  # ─── LIFECYCLE ───────────────────────────────────────────────────────────────

  describe "PATCH /api/v1/preventive_maintenances/:id/pause" do
    let(:pm) { create(:preventive_maintenance, :active_pm, organization: organization, asset: asset) }

    it "pauses an active PM" do
      patch "/api/v1/preventive_maintenances/#{pm.id}/pause", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["status"]).to eq("paused")
    end

    it "returns 422 when already paused" do
      pm.update!(status: :paused)
      patch "/api/v1/preventive_maintenances/#{pm.id}/pause", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/preventive_maintenances/:id/resume" do
    let(:pm) { create(:preventive_maintenance, :paused_pm, organization: organization, asset: asset) }

    it "resumes a paused PM" do
      patch "/api/v1/preventive_maintenances/#{pm.id}/resume", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["status"]).to eq("active")
    end

    it "returns 422 when already active" do
      pm.update_column(:status, PreventiveMaintenance.statuses[:active])
      patch "/api/v1/preventive_maintenances/#{pm.id}/resume", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/preventive_maintenances/:id/trigger" do
    let(:pm) { create(:preventive_maintenance, :active_pm, organization: organization, asset: asset) }

    it "generates a work order immediately" do
      expect {
        patch "/api/v1/preventive_maintenances/#{pm.id}/trigger", headers: auth_headers_for(manager)
      }.to change(WorkOrder, :count).by(1)
      expect(response).to have_http_status(:created)
      expect(json_body).to have_key("work_order")
    end

    it "forbids technician from triggering" do
      patch "/api/v1/preventive_maintenances/#{pm.id}/trigger", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end
  end

  # ─── PREVIEW ─────────────────────────────────────────────────────────────────

  describe "GET /api/v1/preventive_maintenances/:id/preview" do
    let(:pm) do
      create(:preventive_maintenance,
        organization: organization, asset: asset,
        frequency_type: :time_based, frequency_value: 30, frequency_unit: "days",
        next_due_at: 1.day.from_now)
    end

    it "returns 12 upcoming scheduled dates" do
      get "/api/v1/preventive_maintenances/#{pm.id}/preview", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["scheduled_dates"].size).to eq(12)
    end

    it "technician can access preview" do
      get "/api/v1/preventive_maintenances/#{pm.id}/preview", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:ok)
    end
  end

  # ─── DASHBOARD ───────────────────────────────────────────────────────────────

  describe "GET /api/v1/preventive_maintenances/dashboard" do
    let!(:active_pm)  { create(:preventive_maintenance, :active_pm, organization: organization, asset: asset) }
    let!(:overdue_pm) { create(:preventive_maintenance, :overdue_pm, organization: organization, asset: asset) }

    it "returns compliance summary" do
      get "/api/v1/preventive_maintenances/dashboard", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body).to have_key("summary")
      summary = json_body["summary"]
      expect(summary).to have_key("total_active")
      expect(summary).to have_key("overdue")
      expect(summary).to have_key("compliance_rate")
      expect(summary["overdue"]).to eq(1)
    end

    it "returns 401 without auth" do
      get "/api/v1/preventive_maintenances/dashboard"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  # ─── EXECUTIONS ──────────────────────────────────────────────────────────────

  describe "Executions" do
    let(:pm) { create(:preventive_maintenance, :active_pm, organization: organization, asset: asset) }

    describe "GET /api/v1/preventive_maintenances/:id/executions" do
      let!(:exec) do
        create(:pm_execution, preventive_maintenance: pm, scheduled_date: Date.today, status: :generated)
      end

      it "returns executions for the PM" do
        get "/api/v1/preventive_maintenances/#{pm.id}/executions", headers: auth_headers_for(manager)
        expect(response).to have_http_status(:ok)
        expect(json_body["executions"].size).to eq(1)
      end
    end

    describe "PATCH /api/v1/preventive_maintenances/:id/executions/:execution_id/skip" do
      let!(:pending_exec) do
        create(:pm_execution, preventive_maintenance: pm, scheduled_date: Date.today, status: :pending)
      end

      it "skips a pending execution" do
        patch "/api/v1/preventive_maintenances/#{pm.id}/executions/#{pending_exec.id}/skip",
          params: { skip_reason: "Equipment in use" },
          headers: auth_headers_for(technician)
        expect(response).to have_http_status(:ok)
        expect(json_body["status"]).to eq("skipped")
      end

      it "returns 422 when execution is not pending" do
        pending_exec.update_column(:status, PmExecution.statuses[:generated])
        patch "/api/v1/preventive_maintenances/#{pm.id}/executions/#{pending_exec.id}/skip",
          params: { skip_reason: "reason" },
          headers: auth_headers_for(manager)
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end
end
