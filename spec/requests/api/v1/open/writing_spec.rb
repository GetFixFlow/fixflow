require "rails_helper"

RSpec.describe "Public API: writing", type: :request do
  let(:org) { create(:organization) }
  let(:key_and_raw) { make_key(org, scopes: %w[write]) }
  let(:headers) { bearer(key_and_raw.last) }

  describe "creating a work order" do
    def create_work_order(attrs) = post("/api/v1/open/work_orders", params: { work_order: attrs }, as: :json, headers: headers)

    it "makes it, with the company's defaults, and the requester is the key" do
      create_work_order({ title: "Pump 3 is leaking", description: "Oil on the floor" })

      expect(response).to have_http_status(:created)
      body = json_body["data"]
      expect(body).to include("title" => "Pump 3 is leaking", "status" => "open", "priority" => org.default_priority,
                              "requester" => { "id" => nil, "name" => "Zapier", "email" => nil })
      expect(body["due_date"]).to be_present
      expect(WorkOrder.find(body["id"]).organization).to eq(org)
    end

    it "takes who asked, when the program is passing on someone's request" do
      create_work_order({ title: "Door sticks", requester_name: "Pat Visitor", requester_email: "pat@example.test", priority: "high" })

      expect(json_body["data"]).to include("priority" => "high",
"requester" => { "id" => nil, "name" => "Pat Visitor", "email" => "pat@example.test" })
    end

    it "puts it on an asset of the company, and refuses one of another company" do
      asset = create(:asset, organization: org)
      create_work_order({ title: "On an asset", asset_id: asset.id })
      expect(json_body.dig("data", "asset", "id")).to eq(asset.id)

      theirs = create(:asset, organization: create(:organization))
      create_work_order({ title: "On theirs", asset_id: theirs.id })
      expect(response).to have_http_status(:unprocessable_entity).or have_http_status(:not_found)
      expect(WorkOrder.where(title: "On theirs")).to be_empty
    end

    it "refuses a work order with no title, in the API's error shape" do
      create_work_order({ description: "No title" })

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body).to include("success" => false)
      expect(json_body.dig("error", "code")).to eq("VALIDATION_ERROR")
      expect(json_body.dig("error", "details", "title")).to be_present
    end

    it "refuses a priority it does not know" do
      create_work_order({ title: "x", priority: "whenever" })

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "says what is missing when there is no work_order at all" do
      post "/api/v1/open/work_orders", params: { something: "else" }, as: :json, headers: headers

      expect(response).to have_http_status(:bad_request)
      expect(json_body.dig("error", "code")).to eq("MISSING_PARAMETER")
    end

    it "ignores fields a program has no business setting (status, costs, who verified)" do
      create_work_order({ title: "Sneaky", status: "verified", labor_cost: 9999, parts_cost: 9999, verified_by_id: 1,
work_order_number: "WO-1" })

      expect(json_body.dig("data", "status")).to eq("open")
      expect(WorkOrder.last).to have_attributes(status: "open", verified_by_id: nil)
      expect(WorkOrder.last.labor_cost.to_f).to eq(0.0)
      expect(WorkOrder.last.parts_cost.to_f).to eq(0.0)
    end

    it "tells the company's webhooks, as any other way of making one does" do
      allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])
      create(:webhook, organization: org, events: %w[work_order.created])

      create_work_order({ title: "From a program" })

      expect(WebhookDelivery.last.payload.dig("data", "work_order", "title")).to eq("From a program")
    end

    it "writes the audit log line with the key's name" do
      create_work_order({ title: "Audited" })

      line = ActivityLog.where(action: "work_order.created").last
      expect(line.user_id).to be_nil
      expect(line.metadata).to include("api_key" => start_with("Zapier"))
    end
  end

  describe "changing a work order" do
    let!(:work_order) { create(:work_order, organization: org, title: "Before", priority: "low") }

    it "changes the fields it may" do
      change = { title: "After", priority: "critical", estimated_hours: 2.5 }
      patch "/api/v1/open/work_orders/#{work_order.id}", params: { work_order: change },
                                                          as: :json, headers: headers

      expect(response).to have_http_status(:ok)
      expect(work_order.reload).to have_attributes(title: "After", priority: "critical", estimated_hours: 2.5)
    end

    it "cannot reach another company's work order" do
      theirs = create(:work_order, organization: create(:organization), title: "Theirs")

      patch "/api/v1/open/work_orders/#{theirs.id}", params: { work_order: { title: "Taken" } }, as: :json, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(theirs.reload.title).to eq("Theirs")
    end

    it "gives it to a person of the company, and not to a person of another" do
      tech = create(:user, organization: org)
      patch "/api/v1/open/work_orders/#{work_order.id}", params: { work_order: { assignee_id: tech.id } }, as: :json, headers: headers
      expect(response).to have_http_status(:ok)
      expect(work_order.reload.assignee_id).to eq(tech.id)

      stranger = create(:user, organization: create(:organization))
      patch "/api/v1/open/work_orders/#{work_order.id}", params: { work_order: { assignee_id: stranger.id } }, as: :json,
headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "moving a work order along" do
    let(:tech) { create(:user, organization: org) }
    let!(:work_order) { create(:work_order, organization: org) }

    def transition(event,
                   **params)
      post("/api/v1/open/work_orders/#{work_order.id}/transitions", params: { event: event, **params }, as: :json,
    headers: headers)
    end

    it "assigns, starts, completes with notes and hours, as on screen" do
      transition("assign", assignee_id: tech.id)
      expect(json_body.dig("data", "status")).to eq("assigned")
      transition("start")
      expect(json_body.dig("data", "status")).to eq("in_progress")
      transition("complete", completion_notes: "Replaced the seal", actual_hours: 1.5)

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]).to include("status" => "completed", "completion_notes" => "Replaced the seal", "actual_hours" => 1.5)
      expect(json_body.dig("data", "completed_at")).to be_present
    end

    it "holds, asks for parts, resumes, and cancels with a reason" do
      work_order.update!(assignee: tech, status: "in_progress")
      transition("hold")
      expect(json_body.dig("data", "status")).to eq("on_hold")
      transition("resume")
      transition("need_parts")
      expect(json_body.dig("data", "status")).to eq("pending_parts")
      transition("resume")
      transition("cancel", cancellation_reason: "Duplicate")

      expect(json_body["data"]).to include("status" => "cancelled", "cancellation_reason" => "Duplicate")
    end

    it "refuses a move the work order cannot make, with the rules of the screen" do
      transition("complete", completion_notes: "x")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("INVALID_TRANSITION")
      expect(work_order.reload.status).to eq("open")
    end

    it "refuses completing without notes" do
      work_order.update!(assignee: tech, status: "in_progress")

      transition("complete")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(work_order.reload.status).to eq("in_progress")
    end

    it "does not verify or reject: those are for a person" do
      work_order.update!(assignee: tech, status: "completed", completion_notes: "Done")

      %w[verify reject approve delete].each do |event|
        transition(event)
        expect(response).to have_http_status(:unprocessable_entity)
      end
      expect(work_order.reload.status).to eq("completed")
    end

    it "says an assignee is needed to assign" do
      transition("assign")

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "makes the work wait for approval when it costs more than the company's limit, and asks the managers" do
      org.update!(settings: org.settings.merge("approval_limit" => 10))
      work_order.update!(assignee: tech, status: "assigned", vendor_cost: 500)
      create(:user, :manager, organization: org)

      expect { transition("start") }.to have_enqueued_job(ApprovalRequestedJob)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("APPROVAL_REQUIRED")
      expect(work_order.reload.status).to eq("assigned")
    end

    it "does not complete with required checklist steps undone, and says which" do
      work_order.update!(assignee: tech, status: "in_progress",
                         checklist: [{ "step" => 1, "instruction" => "Lock out", "required" => true, "completed" => false }])

      transition("complete", completion_notes: "Done")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("CHECKLIST_INCOMPLETE")
      expect(json_body.dig("error", "details", "steps")).to eq([1])
    end
  end

  describe "assets" do
    it "makes and changes one, on a location of the company" do
      room = create(:location, organization: org)
      post "/api/v1/open/assets",
params: { asset: { name: "Compressor", status: "operational", location_id: room.id, serial_number: "SN-1" } },
                                      as: :json, headers: headers
      expect(response).to have_http_status(:created)
      id = json_body.dig("data", "id")
      expect(json_body["data"]).to include("name" => "Compressor", "serial_number" => "SN-1",
"location" => { "id" => room.id, "name" => room.name })
      expect(json_body.dig("data", "asset_tag")).to be_present

      patch "/api/v1/open/assets/#{id}", params: { asset: { status: "down" } }, as: :json, headers: headers
      expect(json_body.dig("data", "status")).to eq("down")
      expect(Asset.find(id).downtimes.open).to exist # the same side effects as on screen
    end

    it "refuses a location of another company, a status it does not know, and no name" do
      theirs = create(:location, organization: create(:organization))

      post "/api/v1/open/assets", params: { asset: { name: "Bad", location_id: theirs.id } }, as: :json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity).or have_http_status(:not_found)
      post "/api/v1/open/assets", params: { asset: { name: "Odd", status: "broken-ish" } }, as: :json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      post "/api/v1/open/assets", params: { asset: { serial_number: "no name" } }, as: :json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(Asset.where(name: %w[Bad Odd])).to be_empty
    end

    it "cannot change another company's asset" do
      theirs = create(:asset, organization: create(:organization), name: "Theirs")

      patch "/api/v1/open/assets/#{theirs.id}", params: { asset: { name: "Taken" } }, as: :json, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(theirs.reload.name).to eq("Theirs")
    end
  end

  it "has no way to delete anything" do
    work_order = create(:work_order, organization: org)

    delete "/api/v1/open/work_orders/#{work_order.id}", headers: headers

    expect(response).to have_http_status(:not_found)
    expect(WorkOrder.exists?(work_order.id)).to be(true)
  end
end
