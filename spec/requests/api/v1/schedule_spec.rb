require "rails_helper"

RSpec.describe "Api::V1::Schedule", type: :request do
  include ActiveJob::TestHelper

  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org, first_name: "Tia", last_name: "Tech") }
  let(:other_tech) { create(:user, organization: org, first_name: "Omar", last_name: "Other") }
  let(:now)        { Time.utc(2026, 10, 14, 12, 0) } # a Wednesday
  let(:monday)     { Date.new(2026, 10, 12) }

  around { |example| travel_to(now) { example.run } }

  def send_json(verb, url, body = nil, as: manager)
    public_send(verb, url, params: body&.to_json, headers: auth_headers_for(as).merge("Content-Type" => "application/json"))
  end

  describe "GET /schedule" do
    let(:path) { "/api/v1/schedule?from=2026-10-12&to=2026-10-18" }

    it "gives a manager the week laid out by person and day" do
      technician
      create(:work_order, organization: org, assignee: technician, status: "assigned", estimated_hours: 3,
                          due_date: Time.utc(2026, 10, 13, 15, 0), title: "Replace belt")

      send_json :get, path

      expect(response).to have_http_status(:ok)
      data = json_body["data"]
      expect(data).to include("from" => "2026-10-12", "to" => "2026-10-18", "today" => "2026-10-14", "truncated" => false)
      expect(data["days"].size).to eq(7)
      expect(data["technicians"].pluck("name")).to eq(["Tia Tech"])
      expect(data["technicians"].first["days"].find { |d| d["date"] == "2026-10-13" }).to eq(
        "date" => "2026-10-13", "count" => 1, "hours" => 3.0, "overloaded" => false
      )
      expect(data["work_orders"].first).to include("title" => "Replace belt", "assignee_id" => technician.id, "day" => "2026-10-13")
    end

    it "has a row for work nobody has, with no one's name" do
      send_json :get, path

      expect(json_body.dig("data", "unassigned")).to include("id" => nil, "name" => nil)
    end

    it "is for managers: a technician or requester is refused" do
      send_json :get, path, as: technician
      expect(response).to have_http_status(:forbidden)

      send_json :get, path, as: create(:user, :requester, organization: org)
      expect(response).to have_http_status(:forbidden)
    end

    it "needs the dates, and sensible ones" do
      send_json :get, "/api/v1/schedule"
      expect(response).to have_http_status(:bad_request)
      expect(json_body.dig("error", "code")).to eq("INVALID_DATE")

      send_json :get, "/api/v1/schedule?from=2026-10-18&to=2026-10-12"
      expect(json_body.dig("error", "code")).to eq("INVALID_RANGE")

      send_json :get, "/api/v1/schedule?from=2026-10-01&to=2026-10-15"
      expect(json_body.dig("error", "code")).to eq("RANGE_TOO_LONG")

      send_json :get, "/api/v1/schedule?from=2026-10-01&to=2026-10-14"
      expect(response).to have_http_status(:ok)
    end

    it "does not show another company's work" do
      create(:work_order, organization: create(:organization), due_date: Time.utc(2026, 10, 13, 15, 0))

      send_json :get, path

      expect(json_body.dig("data", "work_orders")).to be_empty
    end
  end

  describe "PATCH /work_orders/:id/reschedule" do
    let(:due) { Time.utc(2026, 10, 14, 15, 30) }
    let(:order) { create(:work_order, organization: org, assignee: technician, status: "assigned", due_date: due) }

    def reschedule(as: manager, record: order, **body)
      send_json :patch, "/api/v1/work_orders/#{record.id}/reschedule", body, as: as
    end

    it "moves it to another day, keeping its time of day, and logs the new date" do
      reschedule(due_on: "2026-10-16")

      expect(response).to have_http_status(:ok)
      expect(order.reload.due_date).to eq(Time.utc(2026, 10, 16, 15, 30))
      expect(order.assignee).to eq(technician)
      expect(ActivityLog.where(action: "work_order.updated", resource_id: order.id)).to exist
    end

    it "gives work with no due date the end of the working day" do
      order.update_columns(due_date: nil) # rubocop:disable Rails/SkipsModelValidations

      reschedule(due_on: "2026-10-15")

      expect(order.reload.due_date).to eq(Time.utc(2026, 10, 15, 17, 0))
    end

    it "hands assigned work to someone else, keeps its status, tells them, and logs it" do
      other_tech
      expect { reschedule(assignee_id: other_tech.id) }
        .to have_enqueued_job(NotifyAssigneeJob).with(order.id)

      expect(response).to have_http_status(:ok)
      expect(order.reload).to have_attributes(assignee: other_tech, status: "assigned")
      expect(ActivityLog.where(action: "work_order.reassigned", resource_id: order.id)).to exist
    end

    it "assigns waiting work in the usual way: it becomes assigned, the person is told" do
      waiting = create(:work_order, organization: org, status: "open", due_date: due)

      expect { reschedule(assignee_id: technician.id, record: waiting) }.to have_enqueued_job(NotifyAssigneeJob)

      expect(waiting.reload).to have_attributes(assignee: technician, status: "assigned")
      expect(ActivityLog.where(action: "work_order.assigned", resource_id: waiting.id)).to exist
    end

    it "keeps held work held when it is given to someone" do
      held = create(:work_order, :on_hold, organization: org, assignee: technician, due_date: due)

      reschedule(assignee_id: other_tech.id, record: held)

      expect(held.reload).to have_attributes(assignee: other_tech, status: "on_hold")
    end

    it "takes work back from someone: it goes back to open, and nobody is told" do
      expect { reschedule(assignee_id: nil) }.not_to have_enqueued_job(NotifyAssigneeJob)

      expect(order.reload).to have_attributes(assignee: nil, status: "open")
      expect(ActivityLog.where(action: "work_order.unassigned", resource_id: order.id)).to exist
    end

    it "does both at once, and either alone leaves the other as it was" do
      reschedule(assignee_id: other_tech.id, due_on: "2026-10-19")
      expect(order.reload).to have_attributes(assignee: other_tech, due_date: Time.utc(2026, 10, 19, 15, 30))

      reschedule(due_on: "2026-10-20")
      expect(order.reload).to have_attributes(assignee: other_tech, due_date: Time.utc(2026, 10, 20, 15, 30))
    end

    it "does nothing, and tells nobody, when it is already there" do
      expect { reschedule(assignee_id: technician.id, due_on: "2026-10-14") }.not_to have_enqueued_job(NotifyAssigneeJob)

      expect(response).to have_http_status(:ok)
      expect(order.reload.due_date).to eq(due)
      expect(ActivityLog.where(resource_id: order.id, action: "work_order.reassigned")).not_to exist
    end

    it "lets started work be moved to another day, but not to another person" do
      started = create(:work_order, :in_progress, organization: org, assignee: technician, due_date: due)

      reschedule(due_on: "2026-10-16", record: started)
      expect(response).to have_http_status(:ok)
      expect(started.reload.due_date.to_date).to eq(Date.new(2026, 10, 16))

      reschedule(assignee_id: other_tech.id, record: started)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("STARTED")
      expect(started.reload.assignee).to eq(technician)
    end

    it "changes nothing at all when part of a move is refused" do
      started = create(:work_order, :in_progress, organization: org, assignee: technician, due_date: due)

      reschedule(assignee_id: other_tech.id, due_on: "2026-10-20", record: started)

      expect(started.reload.due_date).to eq(due)
    end

    it "leaves finished and cancelled work alone" do
      %i[completed cancelled].each do |state|
        finished = create(:work_order, state, organization: org, due_date: due)

        reschedule(due_on: "2026-10-20", record: finished)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_body.dig("error", "code")).to eq("NOT_MOVABLE")
        expect(finished.reload.due_date).to eq(due)
      end
    end

    it "does not hand work to someone who does not do work orders, or who has left" do
      reschedule(assignee_id: create(:user, :requester, organization: org).id)
      expect(json_body.dig("error", "code")).to eq("NOT_A_WORKER")

      gone = create(:user, organization: org, deactivated_at: 1.day.ago)
      reschedule(assignee_id: gone.id)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(order.reload.assignee).to eq(technician)
    end

    it "leaves the date alone too when the person it is handed to turns out not to be able to take it" do
      gone = create(:user, organization: org, deactivated_at: 1.day.ago)

      reschedule(assignee_id: gone.id, due_on: "2026-10-20")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(order.reload).to have_attributes(due_date: due, assignee: technician)
    end

    it "does not hand work to someone in another company" do
      reschedule(assignee_id: create(:user, organization: create(:organization)).id)

      expect(response).to have_http_status(:not_found)
      expect(order.reload.assignee).to eq(technician)
    end

    it "is for managers" do
      reschedule(due_on: "2026-10-16", as: technician)

      expect(response).to have_http_status(:forbidden)
      expect(order.reload.due_date).to eq(due)
    end

    it "refuses a date that is not a date" do
      reschedule(due_on: "next tuesday")

      expect(response).to have_http_status(:bad_request)
      expect(json_body.dig("error", "code")).to eq("INVALID_DATE")
    end

    it "does not reach another company's work order" do
      theirs = create(:work_order, organization: create(:organization), due_date: due)

      reschedule(due_on: "2026-10-16", record: theirs)

      expect(response).to have_http_status(:not_found)
    end
  end
end
