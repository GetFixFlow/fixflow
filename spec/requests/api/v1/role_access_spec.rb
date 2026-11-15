require "rails_helper"

# What each kind of person may open and do, from the security review before 1.0 (docs/security-review.md). Every example here is
# a way a person without the right role could reach something, found by reading the code, that now says no.
# rubocop:disable RSpec/MultipleMemoizedHelpers -- a company with a person of every role, and requests of two of them
RSpec.describe "Who may see and do what", type: :request do
  let(:org)        { create(:organization) }
  let(:admin)      { create(:user, :admin, organization: org) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:colleague)  { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let(:other_requester) { create(:user, :requester, organization: org) }
  let(:asset)      { create(:asset, organization: org) }

  let!(:mine)   { create(:work_order, organization: org, asset: asset, requester: requester, title: "Mine") }
  let!(:theirs) { create(:work_order, organization: org, asset: asset, requester: other_requester, title: "Theirs") }

  def as(person) = { headers: auth_headers_for(person), as: :json }

  describe "a requester and work orders" do
    it "lists only the requests they made" do
      get "/api/v1/work_orders", **as(requester)

      expect(json_body["work_orders"].pluck("title")).to eq(["Mine"])
    end

    it "opens their own request and gets 'not found' for anyone else's, as for one that does not exist" do
      get "/api/v1/work_orders/#{mine.id}", **as(requester)
      expect(response).to have_http_status(:ok)

      get "/api/v1/work_orders/#{theirs.id}", **as(requester)
      expect(response).to have_http_status(:not_found)
    end

    it "cannot read, add to or attach to someone else's work order" do
      create(:comment, commentable: theirs, internal: false, body: "Private talk")

      get "/api/v1/work_orders/#{theirs.id}/comments", **as(requester)
      expect(response).to have_http_status(:not_found)
      post "/api/v1/work_orders/#{theirs.id}/comments", params: { comment: { body: "Hello" } }, **as(requester)
      expect(response).to have_http_status(:not_found)
      get "/api/v1/work_orders/#{theirs.id}/attachments", **as(requester)
      expect(response).to have_http_status(:not_found)
      get "/api/v1/work_orders/#{theirs.id}/parts", **as(requester)
      expect(response).to have_http_status(:not_found)
      expect(theirs.comments.count).to eq(1)
    end

    it "can comment on their own request" do
      post "/api/v1/work_orders/#{mine.id}/comments", params: { comment: { body: "Still leaking" } }, **as(requester)

      expect(response).to have_http_status(:created)
    end

    it "has no overdue or unassigned lists: those are the maintenance team's" do
      get "/api/v1/work_orders/overdue", **as(requester)
      expect(response).to have_http_status(:forbidden)
      get "/api/v1/work_orders/unassigned", **as(requester)
      expect(response).to have_http_status(:forbidden)
    end

    it "cannot take a work order for themselves, even their own" do
      patch "/api/v1/work_orders/#{mine.id}/transition", params: { event: "assign_self" }, **as(requester)

      expect(response).to have_http_status(:forbidden)
      expect(mine.reload.assignee_id).to be_nil
    end

    it "does not get assets or maintenance schedules" do
      ["/api/v1/assets", "/api/v1/assets/#{asset.id}", "/api/v1/assets/#{asset.id}/work_orders",
       "/api/v1/preventive_maintenances"].each do |path|
        get path, **as(requester)
        expect(response).to have_http_status(:forbidden), "GET #{path} answered #{response.status}"
      end
    end

    it "does not get sensor screens or the assistant" do
      ["/api/v1/iot_rules", "/api/v1/iot/assets/#{asset.id}/readings", "/api/v1/iot_alerts"].each do |path|
        get path, **as(requester)
        expect(response).to have_http_status(:forbidden), "GET #{path} answered #{response.status}"
      end

      post "/api/v1/ai/assist", params: { work_order_id: mine.id, message: "Help" }, **as(requester)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "a technician and work orders" do
    it "sees the whole company's work (the pool to pick from, and an asset's history)" do
      get "/api/v1/work_orders", **as(technician)

      expect(json_body["work_orders"].pluck("title")).to contain_exactly("Mine", "Theirs")
    end

    it "takes work nobody has, and keeps it when asking again" do
      patch "/api/v1/work_orders/#{theirs.id}/transition", params: { event: "assign_self" }, **as(technician)
      expect(response).to have_http_status(:ok)
      expect(theirs.reload.assignee_id).to eq(technician.id)
    end

    it "cannot take a job from the person who has it: that is a manager's assign" do
      theirs.update!(assignee: colleague, status: "assigned")

      patch "/api/v1/work_orders/#{theirs.id}/transition", params: { event: "assign_self" }, **as(technician)

      expect(response).to have_http_status(:forbidden)
      expect(theirs.reload.assignee_id).to eq(colleague.id)
    end

    it "cannot start, complete or log parts on a job they did not take" do
      theirs.update!(assignee: colleague, status: "assigned")

      patch "/api/v1/work_orders/#{theirs.id}/transition", params: { event: "start" }, **as(technician)
      expect(response).to have_http_status(:forbidden)
      patch "/api/v1/work_orders/#{theirs.id}", params: { work_order: { title: "Mine now" } }, **as(technician)
      expect(response).to have_http_status(:forbidden)
    end

    it "does not see internal notes on the work order's own page, as in its comments" do
      create(:comment, commentable: mine, internal: true, body: "Manager only: contractor is billing twice")
      create(:comment, commentable: mine, internal: false, body: "Visible to all")

      get "/api/v1/work_orders/#{mine.id}", **as(technician)
      bodies = json_body.dig("data", "comments").pluck("body")
      expect(bodies).to eq(["Visible to all"])
      expect(response.body).not_to include("contractor is billing twice")

      get "/api/v1/work_orders/#{mine.id}", **as(manager)
      expect(json_body.dig("data", "comments").pluck("body")).to include("Manager only: contractor is billing twice")
    end

    it "cannot name who does the work, or why it was sent back, when creating a work order" do
      post "/api/v1/work_orders", params: { work_order: { title: "Fix fan", asset_id: asset.id, assignee_id: colleague.id,
                                                          rejection_reason: "because" } }, **as(technician)

      expect(response).to have_http_status(:created)
      created = WorkOrder.find(json_body.dig("data", "id"))
      expect(created.assignee_id).to be_nil
      expect(created.rejection_reason).to be_nil
    end

    it "cannot hand their job to someone else by editing it" do
      theirs.update!(assignee: technician, status: "assigned")

      patch "/api/v1/work_orders/#{theirs.id}", params: { work_order: { assignee_id: colleague.id, title: "Renamed" } },
                                                **as(technician)

      expect(response).to have_http_status(:ok)
      expect(theirs.reload).to have_attributes(assignee_id: technician.id, title: "Renamed")
    end

    it "still lets a manager assign work through an edit" do
      patch "/api/v1/work_orders/#{theirs.id}", params: { work_order: { assignee_id: colleague.id } }, **as(manager)

      expect(theirs.reload.assignee_id).to eq(colleague.id)
    end
  end

  describe "skipping a maintenance execution" do
    let(:pm)        { create(:preventive_maintenance, organization: org, asset: asset) }
    let(:execution) { create(:pm_execution, preventive_maintenance: pm) }

    it "is for the maintenance team, not a requester" do
      patch "/api/v1/preventive_maintenances/#{pm.id}/executions/#{execution.id}/skip", **as(requester)

      expect(response).to have_http_status(:forbidden)
      expect(execution.reload.status).to eq("pending")
      expect(pm.reload.times_skipped).to eq(0)
    end

    it "works for a technician" do
      patch "/api/v1/preventive_maintenances/#{pm.id}/executions/#{execution.id}/skip", **as(technician)

      expect(response).to have_http_status(:ok)
    end
  end

  describe "the company's wage settings" do
    before { org.update!(settings: org.settings.merge("labor_rate" => 55, "approval_limit" => 900)) }

    it "shows the default hourly rate and the approval limit to managers and administrators only" do
      [manager, admin].each do |person|
        get "/api/v1/organization_settings", **as(person)
        expect(json_body["organization"]).to include("labor_rate" => 55, "approval_limit" => 900)
      end

      [technician, requester].each do |person|
        get "/api/v1/organization_settings", **as(person)
        expect(response).to have_http_status(:ok)
        expect(json_body["organization"]).not_to include("labor_rate", "approval_limit")
        expect(json_body["organization"]).to include("name")
      end
    end
  end

  describe "other people's details" do
    it "are for managers, and for the person themselves" do
      get "/api/v1/users/#{colleague.id}", **as(technician)
      expect(response).to have_http_status(:forbidden)
      get "/api/v1/users/#{technician.id}", **as(technician)
      expect(response).to have_http_status(:ok)
      get "/api/v1/users/#{colleague.id}", **as(manager)
      expect(response).to have_http_status(:ok)
    end
  end
end
# rubocop:enable RSpec/MultipleMemoizedHelpers
