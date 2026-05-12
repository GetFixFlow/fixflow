require "rails_helper"

RSpec.describe "Api::V1::WorkOrders", type: :request do
  let(:organization) { create(:organization) }
  let(:admin)        { create(:user, organization: organization, role: "admin") }
  let(:manager)      { create(:user, organization: organization, role: "manager") }
  let(:technician)   { create(:user, organization: organization, role: "technician") }

  # ─── INDEX ──────────────────────────────────────────────────────────────────

  describe "GET /api/v1/work_orders" do
    let!(:wo1) { create(:work_order, organization: organization) }
    let!(:wo2) { create(:work_order, :critical, organization: organization) }

    it "returns paginated work orders" do
      get "/api/v1/work_orders", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["work_orders"].size).to eq(2)
      expect(json_body).to have_key("meta")
    end

    it "returns 401 without auth" do
      get "/api/v1/work_orders"
      expect(response).to have_http_status(:unauthorized)
    end

    context "filtering" do
      let!(:critical_wo) { create(:work_order, :critical, organization: organization) }
      let!(:overdue_wo)  { create(:work_order, organization: organization, due_date: 2.days.ago) }

      it "filters by status" do
        assigned = create(:work_order, :assigned, organization: organization)
        get "/api/v1/work_orders", params: { status: "assigned" }, headers: auth_headers_for(manager)
        ids = json_body["work_orders"].map { |w| w["id"] }
        expect(ids).to include(assigned.id)
        expect(ids).not_to include(wo1.id)
      end

      it "filters by priority" do
        get "/api/v1/work_orders", params: { priority: "critical" }, headers: auth_headers_for(manager)
        priorities = json_body["work_orders"].map { |w| w["priority"] }.uniq
        expect(priorities).to eq(["critical"])
      end

      it "filters overdue work orders" do
        get "/api/v1/work_orders", params: { overdue: "true" }, headers: auth_headers_for(manager)
        ids = json_body["work_orders"].map { |w| w["id"] }
        expect(ids).to include(overdue_wo.id)
      end

      it "searches by keyword" do
        special = create(:work_order, organization: organization, title: "Boiler pressure valve")
        get "/api/v1/work_orders", params: { search: "pressure" }, headers: auth_headers_for(manager)
        ids = json_body["work_orders"].map { |w| w["id"] }
        expect(ids).to include(special.id)
        expect(ids).not_to include(wo1.id)
      end
    end
  end

  # ─── SHOW ────────────────────────────────────────────────────────────────────

  describe "GET /api/v1/work_orders/:id" do
    let(:work_order) { create(:work_order, organization: organization) }

    it "returns the work order with extended view" do
      get "/api/v1/work_orders/#{work_order.id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["id"]).to eq(work_order.id)
    end

    it "returns 404 for another org's work order" do
      other_wo = create(:work_order)
      get "/api/v1/work_orders/#{other_wo.id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:not_found)
    end
  end

  # ─── CREATE ──────────────────────────────────────────────────────────────────

  describe "POST /api/v1/work_orders" do
    let(:valid_params) do
      { work_order: { title: "Replace HVAC filter", priority: "medium" } }
    end

    it "creates a work order" do
      expect {
        post "/api/v1/work_orders", params: valid_params, headers: auth_headers_for(manager)
      }.to change(WorkOrder, :count).by(1)
      expect(response).to have_http_status(:created)
      expect(json_body["title"]).to eq("Replace HVAC filter")
    end

    it "sets requester to current user" do
      post "/api/v1/work_orders", params: valid_params, headers: auth_headers_for(technician)
      created = WorkOrder.last
      expect(created.requester_id).to eq(technician.id)
    end

    it "returns 422 with missing title" do
      post "/api/v1/work_orders",
        params: { work_order: { priority: "low" } },
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  # ─── UPDATE ──────────────────────────────────────────────────────────────────

  describe "PATCH /api/v1/work_orders/:id" do
    let(:work_order) { create(:work_order, organization: organization) }

    it "allows manager to update any work order" do
      patch "/api/v1/work_orders/#{work_order.id}",
        params: { work_order: { title: "Updated title" } },
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["title"]).to eq("Updated title")
    end

    it "allows assignee to update their own work order" do
      work_order.update!(assignee: technician)
      patch "/api/v1/work_orders/#{work_order.id}",
        params: { work_order: { title: "Tech updated" } },
        headers: auth_headers_for(technician)
      expect(response).to have_http_status(:ok)
    end

    it "forbids non-assignee technician from updating" do
      other_tech = create(:user, organization: organization, role: "technician")
      patch "/api/v1/work_orders/#{work_order.id}",
        params: { work_order: { title: "Nope" } },
        headers: auth_headers_for(other_tech)
      expect(response).to have_http_status(:forbidden)
    end
  end

  # ─── LIFECYCLE TRANSITIONS ───────────────────────────────────────────────────

  describe "PATCH /api/v1/work_orders/:id/assign" do
    let(:work_order) { create(:work_order, organization: organization) }

    it "assigns a technician and transitions to assigned" do
      patch "/api/v1/work_orders/#{work_order.id}/assign",
        params: { assignee_id: technician.id },
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["status"]).to eq("assigned")
    end

    it "enqueues NotifyAssigneeJob" do
      expect {
        patch "/api/v1/work_orders/#{work_order.id}/assign",
          params: { assignee_id: technician.id },
          headers: auth_headers_for(manager)
      }.to have_enqueued_job(NotifyAssigneeJob)
    end

    it "returns 403 for technician" do
      patch "/api/v1/work_orders/#{work_order.id}/assign",
        params: { assignee_id: technician.id },
        headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 422 for invalid transition" do
      wo = create(:work_order, :cancelled, organization: organization)
      patch "/api/v1/work_orders/#{wo.id}/assign",
        params: { assignee_id: technician.id },
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/work_orders/:id/start" do
    let(:work_order) { create(:work_order, :assigned, organization: organization, assignee: technician) }

    it "transitions assigned → in_progress" do
      patch "/api/v1/work_orders/#{work_order.id}/start", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:ok)
      expect(json_body["status"]).to eq("in_progress")
    end

    it "returns 422 when starting from wrong state" do
      wo = create(:work_order, organization: organization)
      patch "/api/v1/work_orders/#{wo.id}/start", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/work_orders/:id/complete" do
    let(:work_order) { create(:work_order, :in_progress, organization: organization, assignee: technician) }

    it "transitions in_progress → completed with notes" do
      patch "/api/v1/work_orders/#{work_order.id}/complete",
        params: { completion_notes: "Replaced all gaskets" },
        headers: auth_headers_for(technician)
      expect(response).to have_http_status(:ok)
      expect(json_body["status"]).to eq("completed")
    end

    it "returns 422 without completion notes" do
      patch "/api/v1/work_orders/#{work_order.id}/complete",
        headers: auth_headers_for(technician)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/work_orders/:id/verify" do
    let(:work_order) { create(:work_order, :completed, organization: organization, assignee: technician) }

    it "transitions completed → verified" do
      patch "/api/v1/work_orders/#{work_order.id}/verify", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["status"]).to eq("verified")
    end

    it "returns 403 for technician" do
      patch "/api/v1/work_orders/#{work_order.id}/verify", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 422 when technician tries to verify their own work" do
      manager2 = create(:user, organization: organization, role: "manager")
      work_order.update!(assignee: manager2)
      patch "/api/v1/work_orders/#{work_order.id}/verify", headers: auth_headers_for(manager2)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/work_orders/:id/reject" do
    let(:work_order) { create(:work_order, :completed, organization: organization, assignee: technician) }

    it "transitions completed → in_progress" do
      patch "/api/v1/work_orders/#{work_order.id}/reject",
        params: { rejection_reason: "Work incomplete" },
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["status"]).to eq("in_progress")
    end

    it "returns 403 for technician" do
      patch "/api/v1/work_orders/#{work_order.id}/reject",
        headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /api/v1/work_orders/:id/hold" do
    let(:work_order) { create(:work_order, :in_progress, organization: organization, assignee: technician) }

    it "transitions in_progress → on_hold" do
      patch "/api/v1/work_orders/#{work_order.id}/hold", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:ok)
      expect(json_body["status"]).to eq("on_hold")
    end
  end

  describe "PATCH /api/v1/work_orders/:id/cancel" do
    let(:work_order) { create(:work_order, organization: organization) }

    it "cancels a work order" do
      patch "/api/v1/work_orders/#{work_order.id}/cancel",
        params: { cancellation_reason: "Duplicate request" },
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
      expect(json_body["status"]).to eq("cancelled")
    end

    it "returns 403 for technician" do
      patch "/api/v1/work_orders/#{work_order.id}/cancel",
        headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 422 when cancelling a verified work order" do
      wo = create(:work_order, :verified, organization: organization)
      patch "/api/v1/work_orders/#{wo.id}/cancel", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  # ─── COLLECTION ENDPOINTS ────────────────────────────────────────────────────

  describe "GET /api/v1/work_orders/overdue" do
    it "returns overdue work orders" do
      overdue = create(:work_order, :overdue, organization: organization)
      current = create(:work_order, organization: organization, due_date: 2.days.from_now)
      get "/api/v1/work_orders/overdue", headers: auth_headers_for(manager)
      ids = json_body["work_orders"].map { |w| w["id"] }
      expect(ids).to include(overdue.id)
      expect(ids).not_to include(current.id)
    end
  end

  describe "GET /api/v1/work_orders/unassigned" do
    it "returns unassigned open work orders" do
      unassigned = create(:work_order, organization: organization)
      assigned   = create(:work_order, :assigned, organization: organization)
      get "/api/v1/work_orders/unassigned", headers: auth_headers_for(manager)
      ids = json_body["work_orders"].map { |w| w["id"] }
      expect(ids).to include(unassigned.id)
      expect(ids).not_to include(assigned.id)
    end
  end

  # ─── COMMENTS ────────────────────────────────────────────────────────────────

  describe "Comments" do
    let(:work_order) { create(:work_order, organization: organization) }

    describe "GET /api/v1/work_orders/:id/comments" do
      let!(:public_comment)   { create(:comment, commentable: work_order, user: technician, internal: false) }
      let!(:internal_comment) { create(:comment, commentable: work_order, user: manager, internal: true) }

      it "returns all comments for managers" do
        get "/api/v1/work_orders/#{work_order.id}/comments", headers: auth_headers_for(manager)
        expect(response).to have_http_status(:ok)
        expect(json_body["comments"].size).to eq(2)
      end

      it "hides internal comments from technicians" do
        get "/api/v1/work_orders/#{work_order.id}/comments", headers: auth_headers_for(technician)
        bodies = json_body["comments"].map { |c| c["body"] }
        expect(bodies).to include(public_comment.body)
        expect(bodies).not_to include(internal_comment.body)
      end
    end

    describe "POST /api/v1/work_orders/:id/comments" do
      it "creates a comment" do
        expect {
          post "/api/v1/work_orders/#{work_order.id}/comments",
            params: { comment: { body: "Parts are on order" } },
            headers: auth_headers_for(technician)
        }.to change(Comment, :count).by(1)
        expect(response).to have_http_status(:created)
      end
    end

    describe "DELETE /api/v1/work_orders/:id/comments/:comment_id" do
      let!(:comment) { create(:comment, commentable: work_order, user: technician) }

      it "allows author to delete their own comment" do
        delete "/api/v1/work_orders/#{work_order.id}/comments/#{comment.id}",
          headers: auth_headers_for(technician)
        expect(response).to have_http_status(:no_content)
      end

      it "allows manager to delete any comment" do
        delete "/api/v1/work_orders/#{work_order.id}/comments/#{comment.id}",
          headers: auth_headers_for(manager)
        expect(response).to have_http_status(:no_content)
      end

      it "forbids non-author technician from deleting" do
        other = create(:user, organization: organization, role: "technician")
        delete "/api/v1/work_orders/#{work_order.id}/comments/#{comment.id}",
          headers: auth_headers_for(other)
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  # ─── PUBLIC WORK REQUESTS ────────────────────────────────────────────────────

  describe "Public work request portal" do
    describe "POST /api/v1/requests" do
      let(:valid_params) do
        {
          subdomain:       organization.subdomain,
          title:           "Leaking pipe in room 204",
          requester_name:  "John Smith",
          requester_email: "john@example.com"
        }
      end

      it "creates a work order without authentication" do
        expect {
          post "/api/v1/requests", params: valid_params
        }.to change(WorkOrder, :count).by(1)
        expect(response).to have_http_status(:created)
        expect(json_body).to have_key("token")
      end

      it "enqueues NotifyNewRequestJob" do
        expect {
          post "/api/v1/requests", params: valid_params
        }.to have_enqueued_job(NotifyNewRequestJob)
      end

      it "returns 404 for unknown organization" do
        post "/api/v1/requests", params: valid_params.merge(subdomain: "nonexistent-org-xyz")
        expect(response).to have_http_status(:not_found)
      end
    end

    describe "GET /api/v1/requests/:token" do
      let(:work_order) { create(:work_order, :public_request, organization: organization) }

      it "returns work order status by token without auth" do
        get "/api/v1/requests/#{work_order.public_token}"
        expect(response).to have_http_status(:ok)
        expect(json_body["status"]).to eq(work_order.status)
        expect(json_body["work_order_number"]).to eq(work_order.work_order_number)
      end

      it "returns 404 for invalid token" do
        get "/api/v1/requests/invalid_token_abc"
        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
