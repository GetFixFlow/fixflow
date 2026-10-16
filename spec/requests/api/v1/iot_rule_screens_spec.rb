require "rails_helper"

# What the IoT rule screens send and read: the rule form's field names, archive, duplicate and the test box.
RSpec.describe "IoT rules for the screens", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:asset)      { create(:asset, organization: org, name: "Pump 3") }
  let(:headers)    { auth_headers_for(manager) }
  let(:other_org)  { create(:organization) }

  def send_json(verb, path, body = nil, as: headers)
    public_send(verb, path, params: body&.to_json, headers: as.merge("Content-Type" => "application/json"))
  end

  def form(**fields)
    { iot_rule: { asset_id: asset.id, name: "Too hot", metric_name: "temperature", operator: "gt", threshold_value: 85,
                  metric_unit: "°C", auto_create_wo: true, wo_priority: "high", cooldown_minutes: 30 }.merge(fields) }
  end

  describe "creating a rule from the rule form" do
    it "understands the form's names for the limit, the unit, the sustained time and the assignee" do
      send_json(:post, "/api/v1/iot_rules", form(sustained_minutes: 5, wo_assignee_id: technician.id))

      expect(response).to have_http_status(:created)
      rule = IotRule.find(json_body.dig("data", "id"))
      expect(rule).to have_attributes(threshold: 85.0, unit: "°C", sustained_duration_seconds: 300, assigned_to_id: technician.id,
                                      status: "active", organization_id: org.id, created_by: manager)
      expect(json_body["data"]).to include("threshold_value" => 85.0, "metric_unit" => "°C", "sustained_minutes" => 5,
                                           "wo_assignee_id" => technician.id, "asset_id" => asset.id, "enabled" => true)
    end

    it "takes an outside-range rule's lower limit from threshold_min" do
      send_json(:post, "/api/v1/iot_rules",
                form(metric_name: "humidity", operator: "outside_range", threshold_min: 20, threshold_max: 70, threshold_value: 0))

      expect(response).to have_http_status(:created)
      expect(IotRule.find(json_body.dig("data",
"id"))).to have_attributes(threshold: 20.0, threshold_max: 70.0, operator: "outside_range")
      expect(json_body["data"]).to include("threshold_min" => 20.0, "threshold_max" => "70.0")
    end

    it "still takes the column names, and the column wins when both are sent" do
      send_json(:post, "/api/v1/iot_rules", form(threshold: 90, unit: "F"))

      expect(IotRule.find(json_body.dig("data", "id"))).to have_attributes(threshold: 90.0, unit: "F")
    end

    it "is still refused without a limit, with a message instead of an error page" do
      body = form
      body[:iot_rule].delete(:threshold_value)

      send_json(:post, "/api/v1/iot_rules", body)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("VALIDATION_ERROR")
    end

    it "answers 400 for a sustained time that is not a number" do
      send_json(:post, "/api/v1/iot_rules", form(sustained_minutes: "a while"))

      expect(response).to have_http_status(:bad_request)
    end

    it "leaves the sustained time empty when none is given" do
      send_json(:post, "/api/v1/iot_rules", form(sustained_minutes: ""))

      expect(IotRule.find(json_body.dig("data", "id")).sustained_duration_seconds).to be_nil
    end

    it "refuses an asset that belongs to another company" do
      foreign = create(:asset, organization: other_org)

      expect { send_json(:post, "/api/v1/iot_rules", form(asset_id: foreign.id)) }.not_to(change { IotRule.unscoped.count })

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "refuses an assignee from another company, or one who has been deactivated" do
      foreign = create(:user, organization: other_org)
      gone = create(:user, organization: org, deactivated_at: 1.day.ago)

      send_json(:post, "/api/v1/iot_rules", form(wo_assignee_id: foreign.id))
      expect(response).to have_http_status(:unprocessable_entity)
      send_json(:post, "/api/v1/iot_rules", form(wo_assignee_id: gone.id))
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "is for managers" do
      send_json(:post, "/api/v1/iot_rules", form, as: auth_headers_for(technician))

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "editing a rule from the form" do
    let!(:rule) { create(:iot_rule, asset: asset, organization: org, threshold: 85, unit: "C") }

    it "changes the limit and the unit by the form's names" do
      send_json(:patch, "/api/v1/iot_rules/#{rule.id}", { iot_rule: { threshold_value: 70, metric_unit: "°F" } })

      expect(response).to have_http_status(:ok)
      expect(rule.reload).to have_attributes(threshold: 70.0, unit: "°F")
    end

    it "changes an outside-range rule's lower limit with threshold_min, not threshold_value" do
      range = create(:iot_rule, :outside_range, asset: asset, organization: org)

      send_json(:patch, "/api/v1/iot_rules/#{range.id}", { iot_rule: { threshold_min: 15, threshold_value: 0 } })

      expect(range.reload.threshold).to eq(15.0)
    end

    it "does not touch what was not sent" do
      send_json(:patch, "/api/v1/iot_rules/#{rule.id}", { iot_rule: { name: "Renamed" } })

      expect(rule.reload).to have_attributes(name: "Renamed", threshold: 85.0, unit: "C")
    end

    it "clears the assignee when the form sends none" do
      rule.update!(assigned_to: technician)

      send_json(:patch, "/api/v1/iot_rules/#{rule.id}", { iot_rule: { wo_assignee_id: "" } })

      expect(rule.reload.assigned_to_id).to be_nil
    end
  end

  describe "archive and duplicate" do
    let!(:rule) do
      create(:iot_rule, asset: asset, organization: org, name: "Pump too hot", trigger_count: 7, times_acknowledged: 3,
                        last_triggered_at: 1.day.ago, last_wo_created_at: 1.day.ago)
    end

    it "archives a rule: it stops, and nothing is lost" do
      send_json(:patch, "/api/v1/iot_rules/#{rule.id}/archive")

      expect(response).to have_http_status(:ok)
      expect(json_body.dig("data", "status")).to eq("archived")
      expect(IotRule.unscoped.find(rule.id).trigger_count).to eq(7)
    end

    it "duplicates a rule as a paused copy with fresh counts, leaving the original alone" do
      expect { send_json(:post, "/api/v1/iot_rules/#{rule.id}/duplicate") }.to change { IotRule.unscoped.count }.by(1)

      expect(response).to have_http_status(:created)
      copy = IotRule.unscoped.find(json_body.dig("data", "id"))
      expect(copy).to have_attributes(name: "Pump too hot (copy)", status: "paused", trigger_count: 0, times_acknowledged: 0,
                                      last_triggered_at: nil, last_wo_created_at: nil, asset_id: asset.id, threshold: rule.threshold,
                                      metric_name: rule.metric_name, created_by_id: rule.created_by_id)
      expect(rule.reload).to have_attributes(status: "active", trigger_count: 7, name: "Pump too hot")
    end

    it "is for managers, and not for another company's rule" do
      send_json(:patch, "/api/v1/iot_rules/#{rule.id}/archive", as: auth_headers_for(technician))
      expect(response).to have_http_status(:forbidden)
      send_json(:post, "/api/v1/iot_rules/#{rule.id}/duplicate", as: auth_headers_for(technician))
      expect(response).to have_http_status(:forbidden)

      other_manager = create(:user, :manager, organization: other_org)
      send_json(:patch, "/api/v1/iot_rules/#{rule.id}/archive", as: auth_headers_for(other_manager))
      expect(response).to have_http_status(:not_found)
      send_json(:post, "/api/v1/iot_rules/#{rule.id}/duplicate", as: auth_headers_for(other_manager))
      expect(response).to have_http_status(:not_found)
      expect(rule.reload.status).to eq("active")
    end
  end

  describe "POST /api/v1/iot_rules/:id/test" do
    let!(:rule) { create(:iot_rule, asset: asset, organization: org, threshold: 85, unit: "°C") }

    def test_rule(value, **body)
      send_json(:post, "/api/v1/iot_rules/#{rule.id}/test", { test_value: value }.merge(body))
    end

    it "says a reading over the limit would trigger, and why, in the shape the test box reads" do
      test_rule(91)

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("would_trigger" => true, "would_create_wo" => true, "cooldown_active" => false)
      expect(json_body["reason"]).to eq("A reading of 91 °C is above 85 °C. It would raise an alert and create a work order.")
      expect(json_body["recent_readings"]).to eq([])
    end

    it "says a reading under the limit would do nothing" do
      test_rule(70)

      expect(json_body["would_trigger"]).to be(false)
      expect(json_body["reason"]).to eq("A reading of 70 °C is not above 85 °C, so nothing would happen.")
    end

    it "explains a cooldown, a rule that makes no work orders, and a paused rule" do
      rule.update!(last_wo_created_at: 5.minutes.ago)
      test_rule(91)
      expect(json_body["reason"]).to include("no work order", "last 60 minutes")
      expect(json_body["would_create_wo"]).to be(false)

      rule.update!(last_wo_created_at: nil, auto_create_wo: false)
      test_rule(91)
      expect(json_body["reason"]).to include("does not create work orders")

      rule.update!(auto_create_wo: true, status: :paused)
      test_rule(91)
      expect(json_body["reason"]).to include("The rule is paused")
      expect(json_body["would_create_wo"]).to be(false)
    end

    it "words a range rule" do
      range = create(:iot_rule, :outside_range, asset: asset, organization: org, unit: "%")

      send_json(:post, "/api/v1/iot_rules/#{range.id}/test", { test_value: 95 })

      expect(json_body["reason"]).to start_with("A reading of 95 % is outside 10 to 90 %.")
    end

    it "shows the latest readings and whether each would have set the rule off" do
      [[70, 3.hours.ago], [90, 2.hours.ago], [88.5, 1.hour.ago]].each do |value, at|
        create(:sensor_reading, asset: asset, organization: org, metric_name: "temperature", value: value, unit: "°C", recorded_at: at)
      end
      create(:sensor_reading, asset: asset, organization: org, metric_name: "vibration", value: 99, recorded_at: 10.minutes.ago)

      test_rule(80)

      readings = json_body["recent_readings"]
      expect(readings.pluck("value")).to eq([88.5, 90.0, 70.0])
      expect(readings.pluck("would_trigger")).to eq([true, true, false])
      expect(readings.first).to include("unit" => "°C")
      expect(readings.first["recorded_at"]).to be_present
    end

    it "still takes the older parameter name" do
      send_json(:post, "/api/v1/iot_rules/#{rule.id}/test", { value: 91 })

      expect(json_body["would_trigger"]).to be(true)
    end

    it "refuses something that is not a number, instead of treating it as zero" do
      test_rule("hot")
      expect(response).to have_http_status(:unprocessable_entity)

      send_json(:post, "/api/v1/iot_rules/#{rule.id}/test", {})
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "is for managers" do
      send_json(:post, "/api/v1/iot_rules/#{rule.id}/test", { test_value: 91 }, as: auth_headers_for(technician))

      expect(response).to have_http_status(:forbidden)
    end
  end
end
