require "rails_helper"

RSpec.describe "Approving work over the limit", type: :request do
  include ActiveJob::TestHelper

  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:order)      { create(:work_order, :assigned, organization: org, assignee: technician, estimated_hours: 4) } # 4 h x 50 = 200

  before do
    org.assign_company_settings("labor_rate" => 50, "approval_limit" => 100)
    org.save!
  end

  def send_json(verb, url, body = nil, as: technician)
    public_send(verb, url, params: body&.to_json, headers: auth_headers_for(as).merge("Content-Type" => "application/json"))
  end

  def start(record = order, as: technician) = send_json(:patch, "/api/v1/work_orders/#{record.id}/start", nil, as: as)

  def complete(record, as: technician)
    send_json(:patch, "/api/v1/work_orders/#{record.id}/complete", { work_order: { completion_notes: "Done" } }, as: as)
  end

  describe "starting over-limit work" do
    it "is refused until a manager approves, with the reason, and the managers are asked" do
      manager
      expect { start }.to have_enqueued_job(ApprovalRequestedJob).with(order.id)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("APPROVAL_REQUIRED")
      expect(json_body.dig("error", "message")).to match(/manager has to approve this work order before it is started/)
      expect(order.reload.status).to eq("assigned")
    end

    it "does not tell the technician what it costs, as that is made of wages" do
      start

      expect(json_body.dig("error", "details")).to be_blank
      expect(response.body).not_to include("200")
    end

    it "tells a manager what it costs and what the limit is" do
      mine = create(:work_order, :assigned, organization: org, assignee: manager, estimated_hours: 4)

      start(mine, as: manager)

      expect(json_body.dig("error", "details")).to include("expected_cost" => "200.0", "limit" => "100.0")
    end

    it "works once a manager has approved it" do
      send_json :patch, "/api/v1/work_orders/#{order.id}/approve", nil, as: manager
      start

      expect(response).to have_http_status(:ok)
      expect(order.reload.status).to eq("in_progress")
    end

    it "is refused the same way through the one endpoint the app uses for every change" do
      send_json :patch, "/api/v1/work_orders/#{order.id}/transition", { event: "start" }

      expect(json_body.dig("error", "code")).to eq("APPROVAL_REQUIRED")
    end

    it "is allowed when it costs no more than the limit, or when nothing is limited" do
      cheap = create(:work_order, :assigned, organization: org, assignee: technician, estimated_hours: 2) # 100: not over
      start(cheap)
      expect(response).to have_http_status(:ok)

      org.assign_company_settings("approval_limit" => 0)
      org.save!
      start
      expect(response).to have_http_status(:ok)
    end
  end

  describe "completing work whose cost has grown" do
    let(:started) { create(:work_order, :in_progress, organization: org, assignee: technician, estimated_hours: 1) } # 50: fine

    it "is refused when the cost has grown past the limit without approval, and allowed after approval" do
      started.update!(vendor_cost: 300)
      complete(started)
      expect(json_body.dig("error", "code")).to eq("APPROVAL_REQUIRED")
      expect(json_body.dig("error", "message")).to match(/before it is completed/)

      send_json :patch, "/api/v1/work_orders/#{started.id}/approve", nil, as: manager
      complete(started)
      expect(response).to have_http_status(:ok)
    end

    it "needs approving again when it has grown past what was approved" do
      started.update!(vendor_cost: 300)
      send_json :patch, "/api/v1/work_orders/#{started.id}/approve", nil, as: manager
      started.update!(vendor_cost: 900)

      complete(started)

      expect(json_body.dig("error", "code")).to eq("APPROVAL_REQUIRED")
    end

    it "is allowed when the cost is within the limit" do
      complete(started)

      expect(response).to have_http_status(:ok)
    end
  end

  describe "PATCH /work_orders/:id/approve" do
    it "records the approval and answers with the work order, with its cost for a manager" do
      send_json :patch, "/api/v1/work_orders/#{order.id}/approve", nil, as: manager

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]).to include("approval_needed" => false, "approved_cost" => "200.0",
                                           "approved_by" => { "id" => manager.id, "full_name" => manager.full_name })
    end

    it "is for managers" do
      send_json :patch, "/api/v1/work_orders/#{order.id}/approve", nil, as: technician

      expect(response).to have_http_status(:forbidden)
      expect(order.reload.approved_by).to be_nil
    end

    it "is for managers: another technician is refused as plainly, not as if it were their own work" do
      send_json :patch, "/api/v1/work_orders/#{order.id}/approve", nil, as: create(:user, organization: org)

      expect(response).to have_http_status(:forbidden)
      expect(json_body["error"]).to eq("Forbidden")
    end

    it "is not for the person doing the work" do
      mine = create(:work_order, :assigned, organization: org, assignee: manager, estimated_hours: 4)

      send_json :patch, "/api/v1/work_orders/#{mine.id}/approve", nil, as: manager

      expect(response).to have_http_status(:forbidden)
      expect(json_body.dig("error", "code")).to eq("OWN_WORK")
      expect(mine.reload.approved_by).to be_nil
    end

    it "refuses work that does not need it" do
      cheap = create(:work_order, :assigned, organization: org, assignee: technician, estimated_hours: 1)

      send_json :patch, "/api/v1/work_orders/#{cheap.id}/approve", nil, as: manager

      expect(json_body.dig("error", "code")).to eq("NOT_NEEDED")
    end

    it "refuses work that is finished" do
      done = create(:work_order, :completed, organization: org, vendor_cost: 900)

      send_json :patch, "/api/v1/work_orders/#{done.id}/approve", nil, as: manager

      expect(json_body.dig("error", "code")).to eq("NOT_OPEN")
    end

    it "does not reach another company's work order" do
      theirs = create(:work_order, organization: create(:organization))

      send_json :patch, "/api/v1/work_orders/#{theirs.id}/approve", nil, as: manager

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /work_orders/:id/request_approval" do
    it "lets the person doing the work ask the managers, once" do
      manager
      expect { 2.times { send_json :patch, "/api/v1/work_orders/#{order.id}/request_approval" } }
        .to have_enqueued_job(ApprovalRequestedJob).once

      expect(response).to have_http_status(:ok)
      expect(json_body.dig("data", "approval_requested_at")).to be_present
    end

    it "is not for someone else's work order" do
      send_json :patch, "/api/v1/work_orders/#{order.id}/request_approval", nil, as: create(:user, organization: org)

      expect(response).to have_http_status(:forbidden)
    end

    it "refuses work that does not need approving" do
      cheap = create(:work_order, :assigned, organization: org, assignee: technician, estimated_hours: 1)

      send_json :patch, "/api/v1/work_orders/#{cheap.id}/request_approval"

      expect(json_body.dig("error", "code")).to eq("NOT_NEEDED")
    end
  end

  describe "what a work order shows" do
    it "says it needs approval to everyone, but gives the cost only to managers" do
      send_json :get, "/api/v1/work_orders/#{order.id}"
      expect(json_body["data"]).to include("approval_needed" => true, "expected_cost" => nil)

      send_json :get, "/api/v1/work_orders/#{order.id}", nil, as: manager
      expect(json_body["data"]).to include("approval_needed" => true, "expected_cost" => "200.0")
    end
  end

  describe "what was approved" do
    it "is shown with its cost to a manager, and without it to a technician" do
      order.approve!(by: manager)

      send_json :get, "/api/v1/work_orders/#{order.id}"
      expect(json_body["data"]).to include("approved_cost" => nil,
                                           "approved_by" => { "id" => manager.id, "full_name" => manager.full_name })

      send_json :get, "/api/v1/work_orders/#{order.id}", nil, as: manager
      expect(json_body["data"]).to include("approved_cost" => "200.0")
    end
  end

  describe "GET /work_orders?needs_approval=true" do
    it "lists the unfinished work waiting for a decision, for a manager" do
      order
      create(:work_order, :assigned, organization: org, assignee: technician, estimated_hours: 1)
      approved = create(:work_order, :assigned, organization: org, assignee: technician, estimated_hours: 4)
      approved.approve!(by: manager)
      create(:work_order, :completed, organization: org, vendor_cost: 900)

      send_json :get, "/api/v1/work_orders?needs_approval=true", nil, as: manager

      expect(json_body["work_orders"].pluck("id")).to eq([order.id])
    end

    it "is empty for a technician, and when there is no limit" do
      order
      send_json :get, "/api/v1/work_orders?needs_approval=true"
      expect(json_body["work_orders"]).to be_empty

      org.assign_company_settings("approval_limit" => 0)
      org.save!
      send_json :get, "/api/v1/work_orders?needs_approval=true", nil, as: manager
      expect(json_body["work_orders"]).to be_empty
    end
  end

  describe "the approval limit setting" do
    it "takes the amount as the form sends it, as text" do
      admin = create(:user, :admin, organization: org)

      send_json :patch, "/api/v1/organization_settings", { organization: { approval_limit: "300" } }, as: admin

      expect(response).to have_http_status(:ok)
      expect(org.reload.approval_limit).to eq(300)
    end

    it "is set in the company settings, and 0 or more only" do
      admin = create(:user, :admin, organization: org)

      send_json :patch, "/api/v1/organization_settings", { organization: { approval_limit: 750.5 } }, as: admin
      expect(response).to have_http_status(:ok)
      expect(org.reload.approval_limit).to eq(750.5)

      send_json :patch, "/api/v1/organization_settings", { organization: { approval_limit: -1 } }, as: admin
      expect(response).to have_http_status(:unprocessable_entity)
      expect(org.reload.approval_limit).to eq(750.5)
    end
  end
end
