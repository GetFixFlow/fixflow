require "rails_helper"

RSpec.describe "IoT alerts", type: :request do
  let(:org)       { create(:organization) }
  let(:manager)   { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:asset) do
    plant = create(:location, organization: org, name: "Plant")
    create(:asset, organization: org, name: "Pump 3", location: create(:location, organization: org, name: "Hall", parent: plant))
  end
  let(:rule)      { create(:iot_rule, asset: asset, organization: org, name: "Pump too hot", unit: "°C", wo_priority: :critical) }
  let(:headers)   { auth_headers_for(manager) }

  def make_alert(overrides = {})
    reading = create(:sensor_reading, asset: asset, organization: org)
    create(:iot_alert, { iot_rule: rule, asset: asset, sensor_reading: reading, triggered_value: 91.25 }.merge(overrides))
  end

  def patch_to(path, body = nil, as: headers)
    patch path, params: body&.to_json, headers: as.merge("Content-Type" => "application/json")
  end

  describe "what an alert looks like" do
    it "has the fields the screens read, as well as the record's own" do
      work_order = create(:work_order, organization: org, asset: asset)
      alert = make_alert(work_order: work_order)

      get "/api/v1/iot_alerts/#{alert.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]).to include(
        "id" => alert.id, "status" => "open", "severity" => "critical",
        "message" => "temperature above 85 °C (reading 91.25 °C)",
        "sensor_value" => 91.25, "threshold_value" => 85.0, "threshold_operator" => "gt",
        "metric_name" => "temperature", "metric_unit" => "°C", "rule_name" => "Pump too hot",
        "asset_id" => asset.id, "iot_rule_id" => rule.id, "work_order_id" => work_order.id,
        "work_order_number" => work_order.work_order_number, "location_path" => "Plant > Hall",
        "triggered_value" => "91.25", "threshold" => "85.0", "asset" => include("id" => asset.id, "name" => "Pump 3")
      )
    end

    it "takes its severity from the rule's priority" do
      %w[critical high medium low].each do |priority|
        other = create(:iot_rule, asset: asset, organization: org, wo_priority: priority)
        alert = make_alert(iot_rule: other)

        get "/api/v1/iot_alerts/#{alert.id}", headers: headers

        expect(json_body["data"]["severity"]).to eq(priority)
      end
    end

    it "words a range rule as outside the range" do
      range = create(:iot_rule, :outside_range, asset: asset, organization: org, unit: "%")
      alert = make_alert(iot_rule: range, triggered_value: 95)

      get "/api/v1/iot_alerts/#{alert.id}", headers: headers

      expect(json_body.dig("data", "message")).to eq("humidity outside 10 to 90 % (reading 95 %)")
    end

    it "says how long it was a problem" do
      alert = make_alert(status: :resolved, created_at: 3.hours.ago, resolved_at: 1.hour.ago)

      get "/api/v1/iot_alerts/#{alert.id}", headers: headers

      expect(json_body.dig("data", "duration_minutes")).to eq(120)
    end

    it "shows a note under the step it belongs to" do
      alert = make_alert
      patch_to("/api/v1/iot_alerts/#{alert.id}/acknowledge", { notes: "On my way" })
      expect(json_body["data"]).to include("acknowledged_note" => "On my way", "resolved_note" => nil)

      patch_to("/api/v1/iot_alerts/#{alert.id}/resolve", { notes: "Replaced the belt" })
      expect(json_body["data"]).to include("resolved_note" => "Replaced the belt", "acknowledged_note" => nil)
    end
  end

  describe "GET /api/v1/iot_alerts" do
    let!(:critical) { make_alert }
    let!(:low_one)  { make_alert(iot_rule: create(:iot_rule, asset: asset, organization: org, wo_priority: :low)) }
    let!(:done)     { make_alert(status: :resolved, resolved_at: 1.hour.ago) }

    it "lists the company's alerts, newest first, never another company's" do
      other_org = create(:organization)
      other_asset = create(:asset, organization: other_org)
      other_rule = create(:iot_rule, asset: other_asset, organization: other_org)
      create(:iot_alert, iot_rule: other_rule, asset: other_asset,
sensor_reading: create(:sensor_reading, asset: other_asset, organization: other_org))

      get "/api/v1/iot_alerts", headers: headers

      expect(json_body["iot_alerts"].pluck("id")).to eq([done.id, low_one.id, critical.id])
    end

    it "filters by status" do
      get "/api/v1/iot_alerts", params: { status: "resolved" }, headers: headers

      expect(json_body["iot_alerts"].pluck("id")).to eq([done.id])
    end

    it "filters by severity (the rule's priority)" do
      get "/api/v1/iot_alerts", params: { severity: "low" }, headers: headers

      expect(json_body["iot_alerts"].pluck("id")).to eq([low_one.id])
    end

    it "filters by the period" do
      critical.update_columns(created_at: 10.days.ago) # rubocop:disable Rails/SkipsModelValidations

      get "/api/v1/iot_alerts", params: { from: 2.days.ago.iso8601 }, headers: headers
      expect(json_body["iot_alerts"].pluck("id")).to contain_exactly(low_one.id, done.id)

      get "/api/v1/iot_alerts", params: { to: 5.days.ago.iso8601 }, headers: headers
      expect(json_body["iot_alerts"].pluck("id")).to eq([critical.id])
    end

    it "answers 400, not an error page, for a date it cannot read" do
      get "/api/v1/iot_alerts", params: { from: "not a date" }, headers: headers

      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "acknowledging, resolving and suppressing" do
    it "acknowledges an open alert once: who, when, and the rule's count goes up by one" do
      alert = make_alert

      expect { patch_to("/api/v1/iot_alerts/#{alert.id}/acknowledge") }.to change { rule.reload.times_acknowledged }.by(1)

      expect(response).to have_http_status(:ok)
      expect(alert.reload).to have_attributes(status: "acknowledged", acknowledged_by: manager)
      expect(alert.acknowledged_at).to be_within(1.minute).of(Time.current)
    end

    it "refuses to acknowledge it again, and does not count it again" do
      alert = make_alert(status: :acknowledged, acknowledged_at: 1.hour.ago)

      expect { patch_to("/api/v1/iot_alerts/#{alert.id}/acknowledge") }.not_to(change { rule.reload.times_acknowledged })

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("INVALID_TRANSITION")
      expect(json_body.dig("error", "message")).to eq("This alert is already acknowledged")
    end

    it "says why a resolved alert cannot be acknowledged" do
      alert = make_alert(status: :resolved, resolved_at: 1.hour.ago)

      patch_to("/api/v1/iot_alerts/#{alert.id}/acknowledge")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("This alert is resolved, so it cannot be acknowledged")
      expect(alert.reload.status).to eq("resolved")
    end

    %w[open acknowledged suppressed].each do |from|
      it "resolves a #{from} alert" do
        alert = make_alert(status: from)

        patch_to("/api/v1/iot_alerts/#{alert.id}/resolve")

        expect(response).to have_http_status(:ok)
        expect(alert.reload.status).to eq("resolved")
        expect(alert.resolved_at).to be_within(1.minute).of(Time.current)
      end
    end

    it "does not resolve a resolved alert again (its time would move)" do
      alert = make_alert(status: :resolved, resolved_at: 5.hours.ago)

      expect { patch_to("/api/v1/iot_alerts/#{alert.id}/resolve") }.not_to(change { alert.reload.resolved_at })

      expect(response).to have_http_status(:unprocessable_entity)
    end

    %w[open acknowledged].each do |from|
      it "suppresses a #{from} alert" do
        alert = make_alert(status: from)

        patch_to("/api/v1/iot_alerts/#{alert.id}/suppress")

        expect(response).to have_http_status(:ok)
        expect(json_body.dig("data", "status")).to eq("suppressed")
      end
    end

    it "does not suppress a resolved alert" do
      alert = make_alert(status: :resolved, resolved_at: 1.hour.ago)

      patch_to("/api/v1/iot_alerts/#{alert.id}/suppress")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(alert.reload.status).to eq("resolved")
    end

    %w[acknowledge resolve suppress].each do |action|
      it "is for managers: a technician cannot #{action}" do
        alert = make_alert

        patch_to("/api/v1/iot_alerts/#{alert.id}/#{action}", as: auth_headers_for(technician))

        expect(response).to have_http_status(:forbidden)
        expect(alert.reload.status).to eq("open")
      end

      it "cannot #{action} another company's alert, and cannot tell whether it exists" do
        other_org = create(:organization)
        other_asset = create(:asset, organization: other_org)
        other_rule = create(:iot_rule, asset: other_asset, organization: other_org)
        theirs = create(:iot_alert, iot_rule: other_rule, asset: other_asset,
                                    sensor_reading: create(:sensor_reading, asset: other_asset, organization: other_org))

        patch_to("/api/v1/iot_alerts/#{theirs.id}/#{action}")

        expect(response).to have_http_status(:not_found)
        expect(theirs.reload.status).to eq("open")
      end
    end
  end

  describe "bulk actions" do
    let!(:open_ones) { Array.new(3) { make_alert } }
    let!(:resolved)  { make_alert(status: :resolved, resolved_at: 1.hour.ago) }
    let(:foreign) do
      other_org = create(:organization)
      other_asset = create(:asset, organization: other_org)
      create(:iot_alert, iot_rule: create(:iot_rule, asset: other_asset, organization: other_org), asset: other_asset,
                         sensor_reading: create(:sensor_reading, asset: other_asset, organization: other_org))
    end

    it "acknowledges each alert that can be, and says how many were skipped" do
      ids = open_ones.map(&:id) + [resolved.id, foreign.id, 0]

      patch_to("/api/v1/iot_alerts/bulk_acknowledge", { ids: ids })

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("updated" => 3, "skipped" => 3)
      expect(open_ones.map { |a| a.reload.status }.uniq).to eq(["acknowledged"])
      expect(resolved.reload.status).to eq("resolved")
      expect(foreign.reload.status).to eq("open")
      expect(rule.reload.times_acknowledged).to eq(3)
    end

    it "resolves each alert that can be" do
      patch_to("/api/v1/iot_alerts/bulk_resolve", { ids: open_ones.map(&:id) + [resolved.id] })

      expect(json_body).to eq("updated" => 3, "skipped" => 1)
      expect(open_ones.map { |a| a.reload.status }.uniq).to eq(["resolved"])
    end

    it "ignores things that are not ids, and counts them as skipped" do
      patch_to("/api/v1/iot_alerts/bulk_acknowledge", { ids: [open_ones.first.id, "abc", nil] })

      expect(json_body).to eq("updated" => 1, "skipped" => 0)
    end

    it "wants at least one id, and no more than 200" do
      patch_to("/api/v1/iot_alerts/bulk_acknowledge", { ids: [] })
      expect(response).to have_http_status(:bad_request)

      patch_to("/api/v1/iot_alerts/bulk_resolve", { ids: (1..201).to_a })
      expect(response).to have_http_status(:bad_request)
    end

    it "is for managers" do
      patch_to("/api/v1/iot_alerts/bulk_acknowledge", { ids: open_ones.map(&:id) }, as: auth_headers_for(technician))

      expect(response).to have_http_status(:forbidden)
      expect(open_ones.map { |a| a.reload.status }.uniq).to eq(["open"])
    end
  end

  describe "GET /api/v1/assets/:id/iot_alerts" do
    it "lists that asset's alerts, newest first, in the same shape" do
      older = make_alert(created_at: 2.days.ago)
      newer = make_alert
      other_asset = create(:asset, organization: org)
      other_rule = create(:iot_rule, asset: other_asset, organization: org)
      create(:iot_alert, iot_rule: other_rule, asset: other_asset,
sensor_reading: create(:sensor_reading, asset: other_asset, organization: org))

      get "/api/v1/assets/#{asset.id}/iot_alerts", headers: auth_headers_for(technician)

      expect(response).to have_http_status(:ok)
      expect(json_body["iot_alerts"].pluck("id")).to eq([newer.id, older.id])
      expect(json_body["iot_alerts"].first).to include("severity" => "critical", "rule_name" => "Pump too hot")
    end

    it "filters by status" do
      make_alert
      done = make_alert(status: :resolved, resolved_at: 1.hour.ago)

      get "/api/v1/assets/#{asset.id}/iot_alerts", params: { status: "resolved" }, headers: headers

      expect(json_body["iot_alerts"].pluck("id")).to eq([done.id])
    end

    it "is not found for another company's asset" do
      other_asset = create(:asset, organization: create(:organization))

      get "/api/v1/assets/#{other_asset.id}/iot_alerts", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it "needs a sign-in" do
      get "/api/v1/assets/#{asset.id}/iot_alerts"

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
