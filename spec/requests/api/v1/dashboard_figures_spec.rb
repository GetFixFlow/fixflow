require "rails_helper"

# The figures on the first screen, for each kind of person.
RSpec.describe "Dashboard figures", type: :request do
  let(:org)      { create(:organization) }
  let(:manager)  { create(:user, :manager, organization: org) }
  let(:alice)    { create(:user, organization: org) }
  let(:bob)      { create(:user, organization: org) }
  let(:customer) { create(:user, :requester, organization: org) }
  let(:pump)     { create(:asset, organization: org) }
  let(:now)      { Time.utc(2026, 10, 16, 12, 0) }

  def dashboard(as: manager)
    get "/api/v1/dashboard", headers: auth_headers_for(as)
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  def make(**attrs)
    notes = %w[completed verified].include?(attrs[:status]) ? { completion_notes: "Done" } : {}
    create(:work_order, organization: org, asset: pump, **notes, **attrs)
  end

  around { |example| travel_to(now) { example.run } }

  describe "managers and administrators" do
    it "counts the company's work orders" do
      make(status: "open", priority: "critical")
      make(status: "open", due_date: now - 1.day)
      make(status: "in_progress", started_at: now - 1.hour, assignee: alice)
      make(status: "completed", assignee: alice, started_at: now - 3.hours, completed_at: now - 1.hour)
      make(status: "verified", assignee: bob, started_at: now - 5.days, completed_at: now - 4.days)
      make(status: "completed", assignee: bob, started_at: now - 20.days, completed_at: now - 19.days)
      stats = dashboard["work_orders"]
      expect(stats).to include("open" => 2, "in_progress" => 1, "overdue" => 1, "critical_open" => 1,
                               "completed_today" => 1, "completed_this_week" => 2)
    end

    it "gives the average hours to finish as a number, counting only finished work that was started" do
      make(status: "completed", assignee: alice, started_at: now - 4.hours, completed_at: now - 2.hours)
      make(status: "completed", assignee: alice, started_at: now - 10.hours, completed_at: now - 4.hours)
      make(status: "completed", assignee: alice, completed_at: now - 1.hour) # never started
      make(status: "cancelled", cancellation_reason: "Duplicate", started_at: now - 100.hours, completed_at: now)
      average = dashboard["work_orders"]["avg_resolution_hours"]
      expect(average).to be_a(Float).and eq(4.0)
    end

    it "is zero hours, not an error, with nothing finished" do
      expect(dashboard["work_orders"]["avg_resolution_hours"]).to eq(0)
    end

    it "counts the assets by status" do
      pump
      create(:asset, organization: org, status: "down")
      create(:asset, organization: org, status: "degraded")
      expect(dashboard["assets"]).to include("total" => 3, "operational" => 1, "degraded" => 1, "down" => 1, "health_score" => 66.7)
    end

    describe "preventive maintenance" do
      let(:schedule) { create(:preventive_maintenance, organization: org, asset: pump, next_due_at: now + 2.days) }

      def execution(status, days_ago)
        create(:pm_execution, status, preventive_maintenance: schedule, scheduled_date: now.to_date - days_ago)
      end

      it "counts skipped and missed executions against compliance, as the PM dashboard does" do
        execution(:completed, 3)
        execution(:skipped, 4)
        execution(:generated, 5) # past its date and still not done
        execution(:pending, -3)  # not due yet: left out
        expect(dashboard["preventive_maintenance"]["compliance_rate_30d"]).to eq(33.3)
      end

      it "is null, not 0 or 100, when nothing has come due" do
        execution(:pending, -3)
        expect(dashboard["preventive_maintenance"]["compliance_rate_30d"]).to be_nil
      end

      it "counts what is due in the next week apart from what is overdue" do
        schedule
        create(:preventive_maintenance, organization: org, asset: pump, next_due_at: now + 20.days)
        create(:preventive_maintenance, organization: org, asset: pump, next_due_at: now - 2.days)
        expect(dashboard["preventive_maintenance"]).to include("due_this_week" => 1, "overdue" => 1)
        expect(dashboard["preventive_maintenance"]["next_due"].size).to eq(3)
      end
    end

    it "counts what has just happened, without waiting for a cache to expire" do
      allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new)
      expect(dashboard["work_orders"]["open"]).to eq(0)
      make(status: "open")
      expect(dashboard["work_orders"]["open"]).to eq(1)
    end
  end

  describe "technicians" do
    it "counts only the work assigned to them" do
      make(status: "assigned", assignee: alice)
      make(status: "assigned", assignee: alice, due_date: now - 1.day)
      make(status: "in_progress", assignee: alice, started_at: now - 1.hour)
      make(status: "completed", assignee: alice, completed_at: now - 1.hour)
      make(status: "assigned", assignee: bob, due_date: now - 1.day)
      expect(dashboard(as: alice)["my_work_orders"]).to eq("assigned" => 2, "in_progress" => 1, "overdue" => 1, "completed_today" => 1)
    end

    it "lists the maintenance assigned to them, soonest first, and their own activity" do
      create(:preventive_maintenance, organization: org, asset: pump, assigned_to: alice, name: "Later", next_due_at: now + 9.days)
      create(:preventive_maintenance, organization: org, asset: pump, assigned_to: alice, name: "Sooner", next_due_at: now + 2.days)
      create(:preventive_maintenance, organization: org, asset: pump, assigned_to: bob, name: "Not mine", next_due_at: now + 1.day)
      create(:activity_log, organization: org, user: alice, resource_name: "WO-1")
      create(:activity_log, organization: org, user: bob, resource_name: "WO-2")
      body = dashboard(as: alice)
      expect(body["upcoming_pms"].pluck("name")).to eq(%w[Sooner Later])
      expect(body["recent_activity"].pluck("description")).to eq(["WO-1"])
    end
  end

  describe "requesters" do
    it "counts only their own requests" do
      make(status: "open", requester: customer)
      make(status: "in_progress", requester: customer, started_at: now - 1.hour, assignee: alice)
      make(status: "completed", requester: customer, assignee: alice, completed_at: now - 1.hour)
      make(status: "open", requester: alice)
      expect(dashboard(as: customer)["my_requests"]).to eq("total" => 3, "open" => 2, "completed" => 1)
    end
  end
end
