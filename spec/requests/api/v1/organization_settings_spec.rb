require "rails_helper"

RSpec.describe "Api::V1::OrganizationSettings", type: :request do
  let(:org)     { create(:organization, name: "Acme Corp", subdomain: "acme") }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:manager) { create(:user, :manager, organization: org) }

  def save_settings(as_user: admin, **changes)
    patch "/api/v1/organization_settings", params: { organization: changes }, headers: auth_headers_for(as_user), as: :json
  end

  describe "GET /api/v1/organization_settings" do
    it "returns the name, slug and every setting with its default" do
      get "/api/v1/organization_settings", headers: auth_headers_for(manager)

      expect(response).to have_http_status(:ok)
      expect(json_body["organization"]).to include(
        "name" => "Acme Corp", "slug" => "acme", "timezone" => "UTC", "wo_number_prefix" => "WO",
        "default_priority" => "medium", "default_due_days" => 7, "work_days" => [1, 2, 3, 4, 5],
        "work_hours" => { "start" => "08:00", "end" => "17:00" }, "holidays" => []
      )
    end

    it "requires authentication" do
      get "/api/v1/organization_settings"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /api/v1/organization_settings" do
    it "saves the name and settings so they survive a reload" do
      save_settings(name: "Acme Manufacturing", industry: "Manufacturing", timezone: "Asia/Colombo", wo_number_prefix: "mnt",
             default_priority: "high", default_due_days: 3, pm_compliance_target: 95, pm_pause_on_down: true,
             work_hours: { start: "07:30", end: "16:00" }, work_days: [1, 2, 3, 4, 5, 6],
             holidays: [{ date: "2026-12-25", name: "Christmas", repeating: true }])

      expect(response).to have_http_status(:ok)

      get "/api/v1/organization_settings", headers: auth_headers_for(admin)
      expect(json_body["organization"]).to include(
        "name" => "Acme Manufacturing", "industry" => "Manufacturing", "timezone" => "Asia/Colombo",
        "wo_number_prefix" => "MNT", "default_priority" => "high", "default_due_days" => 3,
        "pm_compliance_target" => 95, "pm_pause_on_down" => true,
        "work_hours" => { "start" => "07:30", "end" => "16:00" }, "work_days" => [1, 2, 3, 4, 5, 6],
        "holidays" => [{ "date" => "2026-12-25", "name" => "Christmas", "repeating" => true }]
      )
    end

    it "changes only what was sent" do
      save_settings(timezone: "Europe/Paris")
      save_settings(default_due_days: 14)

      get "/api/v1/organization_settings", headers: auth_headers_for(admin)
      expect(json_body["organization"]).to include("timezone" => "Europe/Paris", "default_due_days" => 14)
    end

    it "does not let the slug be changed" do
      save_settings(slug: "hacked", subdomain: "hacked", name: "Acme Corp")
      expect(org.reload.subdomain).to eq("acme")
    end

    it "forbids a manager" do
      save_settings(name: "Mine now", as_user: manager)

      expect(response).to have_http_status(:forbidden)
      expect(org.reload.name).to eq("Acme Corp")
    end

    it "only ever changes the signed-in user's own organization" do
      other = create(:organization, name: "Other Co")
      save_settings(name: "Renamed")

      expect(other.reload.name).to eq("Other Co")
    end

    {
      "an unknown time zone"        => { timezone: "Mars/Olympus" },
      "a prefix with symbols"       => { wo_number_prefix: "WO-1" },
      "a prefix that is too long"   => { wo_number_prefix: "TOOLONGPREFIX" },
      "an unknown priority"         => { default_priority: "urgent" },
      "zero default due days"       => { default_due_days: 0 },
      "a fractional number"         => { default_due_days: 7.5 },
      "a compliance target over 100" => { pm_compliance_target: 101 },
      "work hours that end before they start" => { work_hours: { start: "17:00", end: "08:00" } },
      "a malformed time" => { work_hours: { start: "8am", end: "5pm" } },
      "a day number outside the week" => { work_days: [1, 7] },
      "a holiday without a name"    => { holidays: [{ date: "2026-12-25", name: "" }] },
      "a holiday with a bad date"   => { holidays: [{ date: "Dec 25", name: "Christmas" }] },
      "an unknown auto work order option" => { iot_auto_wo_threshold: "sometimes" },
      "a blank company name" => { name: "" }
    }.each do |label, changes|
      it "rejects #{label} and saves nothing" do
        save_settings(**changes, industry: "Should not stick")

        expect(response).to have_http_status(:unprocessable_entity)
        get "/api/v1/organization_settings", headers: auth_headers_for(admin)
        expect(json_body["organization"]["industry"]).to eq("")
      end
    end
  end

  describe "settings that take effect" do
    describe "work order numbers" do
      it "use the company prefix and keep counting when the prefix changes" do
        save_settings(wo_number_prefix: "MNT")
        post "/api/v1/work_orders", params: { work_order: { title: "First" } }, headers: auth_headers_for(admin), as: :json
        first = json_body["data"]["work_order_number"]

        save_settings(wo_number_prefix: "PLANT")
        post "/api/v1/work_orders", params: { work_order: { title: "Second" } }, headers: auth_headers_for(admin), as: :json
        second = json_body["data"]["work_order_number"]

        expect(first).to match(/\AMNT-\d{6}\z/)
        expect(second).to match(/\APLANT-\d{6}\z/)
        expect(second.split("-").last.to_i).to eq(first.split("-").last.to_i + 1)
      end

      it "still start at WO-000001 for a company that never set a prefix" do
        post "/api/v1/work_orders", params: { work_order: { title: "First" } }, headers: auth_headers_for(admin), as: :json
        expect(json_body["data"]["work_order_number"]).to eq("WO-000001")
      end
    end

    describe "new work order defaults" do
      it "take the company's default priority and due date when the request has none" do
        save_settings(default_priority: "high", default_due_days: 3)
        travel_to(Time.zone.local(2026, 10, 13, 9, 0)) do
          post "/api/v1/work_orders", params: { work_order: { title: "Leaky pump" } }, headers: auth_headers_for(admin), as: :json
        end

        data = json_body["data"]
        expect(data["priority"]).to eq("high")
        expect(Time.zone.parse(data["due_date"]).to_date).to eq(Date.new(2026, 10, 16))
      end

      it "do not override what the request sets" do
        save_settings(default_priority: "high", default_due_days: 3)
        post "/api/v1/work_orders", headers: auth_headers_for(admin), as: :json,
          params: { work_order: { title: "Urgent", priority: "low", due_date: "2027-01-05T10:00:00Z" } }

        expect(json_body["data"]).to include("priority" => "low")
        expect(Time.zone.parse(json_body["data"]["due_date"]).to_date).to eq(Date.new(2027, 1, 5))
      end
    end

    describe "time zone" do
      it "reads dates without an offset as the company's local time" do
        # 01:30 on 2 Oct in Sri Lanka (UTC+5:30) is 20:00 on 1 Oct UTC.
        create(:activity_log, organization: org, user: admin, action: "asset.updated", created_at: Time.utc(2026, 10, 1, 20, 0))
        headers = auth_headers_for(admin)
        params = { from: "2026-10-02", log_action: "asset.updated" } # the sign-in and the save write lines of their own

        get "/api/v1/activity_logs", params: params, headers: headers
        utc_count = json_body["activity_logs"].size

        save_settings(timezone: "Asia/Colombo")
        get "/api/v1/activity_logs", params: params, headers: headers
        local_count = json_body["activity_logs"].size

        expect([utc_count, local_count]).to eq([0, 1])
      end
    end
  end
end
