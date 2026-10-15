require "rails_helper"

RSpec.describe "Work order checklists", type: :request do
  let(:org)        { create(:organization) }
  let(:technician) { create(:user, organization: org, first_name: "Tom", last_name: "Tech") }
  let(:other_tech) { create(:user, organization: org) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:steps) do
    [
      { "step" => 1, "instruction" => "Shut down pump safely", "required" => true,  "completed" => false },
      { "step" => 2, "instruction" => "Drain old oil",         "required" => true,  "completed" => false },
      { "step" => 3, "instruction" => "Take a photo",          "required" => false, "completed" => false }
    ]
  end
  let(:work_order) { create(:work_order, :in_progress, organization: org, assignee: technician, checklist: steps) }

  def tick(*changes, as: technician)
    patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { checklist: changes } }, headers: auth_headers_for(as),
as: :json
  end

  def complete(path: "transition", as: technician)
    notes = "Replaced the filter and tested the pump"
    if path == "transition"
      patch "/api/v1/work_orders/#{work_order.id}/transition",
params: { event: "complete", work_order: { completion_notes: notes, actual_hours: 1 } }, headers: auth_headers_for(as), as: :json
    else
      patch "/api/v1/work_orders/#{work_order.id}/complete", params: { work_order: { completion_notes: notes, actual_hours: 1 } },
headers: auth_headers_for(as), as: :json
    end
  end

  describe "ticking steps" do
    it "marks a step done, keeping the instructions, and notes who did it and when" do
      tick({ step: 1, completed: true })

      expect(response).to have_http_status(:ok)
      first, second = work_order.reload.checklist
      expect(first).to include("instruction" => "Shut down pump safely", "required" => true, "completed" => true,
"completed_by" => technician.id, "completed_by_name" => "Tom Tech")
      expect(Time.zone.parse(first["completed_at"])).to be_within(1.minute).of(Time.current)
      expect(second).to eq(steps[1])
    end

    it "shows the checklist, with who did what, when the work order is read" do
      tick({ step: 2, completed: true })

      get "/api/v1/work_orders/#{work_order.id}", headers: auth_headers_for(manager)

      done = json_body.dig("data", "checklist").find { |s| s["step"] == 2 }
      expect(done).to include("completed" => true, "completed_by_name" => "Tom Tech")
    end

    it "takes the who and when off again when a step is unticked" do
      tick({ step: 1, completed: true })
      tick({ step: 1, completed: false })

      expect(work_order.reload.checklist.first).to eq(steps.first)
    end

    it "does not change who did a step, or when, if the same tick arrives again (a retry after a lost connection)" do
      tick({ step: 1, completed: true })
      before = work_order.reload.checklist.first

      travel 5.minutes do
        tick({ step: 1, completed: true }, as: manager)
      end

      expect(work_order.reload.checklist.first).to eq(before)
    end

    it "ticks several steps at once, and leaves the others alone" do
      tick({ step: 1, completed: true }, { step: 3, completed: true })

      expect(work_order.reload.checklist.pluck("completed")).to eq([true, false, true])
    end

    it "ignores a step that does not exist" do
      tick({ step: 99, completed: true })

      expect(response).to have_http_status(:ok)
      expect(work_order.reload.checklist.pluck("completed")).to eq([false, false, false])
    end

    it "lets a manager tick steps too" do
      tick({ step: 1, completed: true }, as: manager)

      expect(work_order.reload.checklist.first).to include("completed_by" => manager.id)
    end

    it "does not let a technician tick steps on someone else's work order" do
      tick({ step: 1, completed: true }, as: other_tech)

      expect(response).to have_http_status(:forbidden)
      expect(work_order.reload.checklist.first["completed"]).to be(false)
    end

    %i[completed verified cancelled].each do |status|
      it "keeps the checklist as it was once the work order is #{status}" do
        work_order.update_columns(status: status.to_s) # rubocop:disable Rails/SkipsModelValidations

        tick({ step: 1, completed: true }, as: manager)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_body.dig("error", "code")).to eq("CHECKLIST_LOCKED")
        expect(work_order.reload.checklist.first["completed"]).to be(false)
      end
    end
  end

  describe "completing the work order" do
    it "is refused while a required step is not done, naming the steps" do
      tick({ step: 1, completed: true })

      complete

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]).to include("code" => "CHECKLIST_INCOMPLETE")
      expect(json_body.dig("error", "message")).to eq("Complete the required steps first: Drain old oil")
      expect(json_body.dig("error", "details", "steps")).to eq([2])
      expect(work_order.reload.status).to eq("in_progress")
    end

    it "is refused the same way through the older complete endpoint" do
      complete(path: "legacy")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("CHECKLIST_INCOMPLETE")
      expect(work_order.reload.status).to eq("in_progress")
    end

    it "is refused for a manager as well, as the steps are required of the work" do
      complete(as: manager)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "goes ahead once the required steps are done, even if an optional one is not" do
      tick({ step: 1, completed: true }, { step: 2, completed: true })

      complete

      expect(response).to have_http_status(:ok)
      expect(work_order.reload.status).to eq("completed")
      expect(work_order.checklist.last["completed"]).to be(false)
    end

    it "treats a step as required unless it says it is not" do
      work_order.update!(checklist: [{ "step" => 1, "instruction" => "Inspect", "completed" => false }])

      complete

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "has nothing to hold it up when there is no checklist" do
      work_order.update!(checklist: [])

      complete

      expect(response).to have_http_status(:ok)
    end
  end
end
