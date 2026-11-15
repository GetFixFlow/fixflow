require "rails_helper"

RSpec.describe "Api::V1::Ai::Forecasts", type: :request do
  let(:organization) { create(:organization) }
  let(:user)  { create(:user, organization: organization) }
  let(:now)   { Time.zone.parse("2026-11-15 12:00") }
  let(:local_model) do
    { "provider" => "local", "providers" => { "local" => { "base_url" => "http://model.lan:11434/v1", "model" => "llama3" } } }
  end

  around do |example|
    saved = ENV.values_at("AI_ENABLED", "ANTHROPIC_API_KEY", "AI_MODEL")
    ENV["AI_ENABLED"] = "true"
    ENV["ANTHROPIC_API_KEY"] = "sk-test-key"
    ENV["AI_MODEL"] = ""
    travel_to(now) { example.run }
  ensure
    ENV["AI_ENABLED"], ENV["ANTHROPIC_API_KEY"], ENV["AI_MODEL"] = saved
  end

  def readings(asset, per_day:, start: 60.0, metric: "temperature", days: 30)
    rows = (0...(days * 4)).map do |n|
      day = n / 4.0
      value = start + (per_day * day) + ((((n * 7) % 5) - 2) * 0.2)
      { asset_id: asset.id, organization_id: asset.organization_id, metric_name: metric, value: value, source: 1, raw_payload: {},
        recorded_at: now - ((days - day) * 24).hours, created_at: now, updated_at: now }
    end
    SensorReading.insert_all(rows) # rubocop:disable Rails/SkipsModelValidations -- hundreds of readings, quickly
  end

  def heading(name, per_day:, threshold: 85, **options)
    asset = create(:asset, organization: organization, name: name)
    readings(asset, per_day: per_day, **options)
    create(:iot_rule, asset: asset, organization: organization, metric_name: "temperature", operator: :gt, threshold: threshold,
                      unit: "°C", name: "#{name} too hot")
  end

  def get_forecast(kind, as: user, **params)
    get "/api/v1/ai/forecasts/#{kind}", params: params, headers: auth_headers_for(as)
  end

  def data = json_body["data"]

  it "needs a sign-in" do
    get "/api/v1/ai/forecasts/limits"

    expect(response).to have_http_status(:unauthorized)
  end

  it "is not for a requester" do
    %w[limits parts].each do |kind|
      get_forecast(kind, as: create(:user, :requester, organization: organization))
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET limits" do
    it "lists the sensors heading for a limit, the soonest first, with the range and what it rests on" do
      slow = heading("Slow fan", per_day: 0.3)
      fast = heading("Fast pump", per_day: 0.6)
      heading("Steady motor", per_day: 0.0)

      get_forecast("limits")

      expect(response).to have_http_status(:ok)
      expect(data.pluck("asset").pluck("name")).to eq(["Fast pump", "Slow fan"])
      first = data.first
      expect(first).to include("metric_name" => "temperature", "unit" => "°C", "limit" => 85.0,
                               "rule" => { "id" => fast.id, "name" => "Fast pump too hot" })
      expect(first["days_soonest"]).to be < first["days_left"]
      expect(first["days_latest"]).to be >= first["days_left"]
      expect(first.keys).to include("r2", "days_of_history", "points", "slope_per_day", "current", "reaches_on")
      expect(slow.asset_id).not_to eq(fast.asset_id)
    end

    it "says the date it gets there" do
      heading("Fast pump", per_day: 0.6)

      get_forecast("limits")

      expect(data.first["reaches_on"]).to eq((now + data.first["days_left"].days).to_date.iso8601)
    end

    it "can be narrowed to one asset" do
      heading("Fast pump", per_day: 0.6)
      slow = heading("Slow fan", per_day: 0.3)

      get_forecast("limits", asset_id: slow.asset_id)

      expect(data.pluck("asset").pluck("name")).to eq(["Slow fan"])
    end

    it "leaves out a paused rule, and another company's" do
      paused = heading("Paused pump", per_day: 0.6)
      paused.update!(status: :paused)
      other = create(:asset)
      readings(other, per_day: 0.6)
      create(:iot_rule, asset: other, organization: other.organization, metric_name: "temperature", operator: :gt, threshold: 85)

      get_forecast("limits")

      expect(data).to eq([])
    end
  end

  describe "GET parts" do
    let(:work_order) { create(:work_order, organization: organization) }

    def use(part, quantities, days_ago)
      quantities.each_with_index { |q, i|
        create(:work_order_part, work_order: work_order, part: part, quantity_used: q, created_at: now - days_ago[i].days)
      }
    end

    before do
      use(create(:part, organization: organization, name: "Marker"), [1], [190])
      belt = create(:part, organization: organization, name: "Belt", quantity_on_hand: 1)
      use(belt, [2, 2, 2, 2, 2, 2], [5, 30, 55, 70, 95, 100])
      plenty = create(:part, organization: organization, name: "Plenty", quantity_on_hand: 900)
      use(plenty, [1, 1, 1], [5, 35, 65])
    end

    it "lists the parts that may run short, with what is expected, what is held, and what to order" do
      get_forecast("parts")

      expect(response).to have_http_status(:ok)
      expect(data.pluck("part").pluck("name")).to eq(["Belt"])
      expect(data.first).to include("status" => "short", "on_hand" => 1.0, "on_order" => 0.0, "uses" => 6)
      expect(data.first["expected"]).to be_positive
      expect(data.first["low"]).to be <= data.first["expected"]
      expect(data.first["high"]).to be >= data.first["expected"]
      expect(data.first["suggested_quantity"]).to be_positive
      expect(data.first["part"]).to include("id", "name" => "Belt", "unit" => "each")
    end

    it "lists the ones that are fine too when asked" do
      get_forecast("parts", all: "true")

      expect(data.pluck("part").pluck("name")).to eq(%w[Belt Plenty])
    end

    it "shows a person who works at one site only the parts stocked there or nowhere" do
      north = create(:location, organization: organization, name: "North", location_type: "site")
      south = create(:location, organization: organization, name: "South", location_type: "site")
      organization.update!(settings: organization.settings.merge("sites_enabled" => true))
      SiteMembership.create!(user: user, site: north)
      Part.find_by!(name: "Belt").update!(location: south)

      get_forecast("parts", all: "true")

      expect(data.pluck("part").pluck("name")).to eq(%w[Plenty])
    end

    it "does not show another company's parts" do
      other_part = create(:part, name: "Theirs", quantity_on_hand: 0)
      other_order = create(:work_order, organization: other_part.organization)
      create(:work_order_part, work_order: other_order, part: other_part, quantity_used: 5, created_at: now - 100.days)
      3.times { |n|
        create(:work_order_part, work_order: other_order, part: other_part, quantity_used: 5, created_at: now - (n * 20).days)
      }

      get_forecast("parts", all: "true")

      expect(data.pluck("part").pluck("name")).not_to include("Theirs")
    end
  end

  describe "when it is off" do
    it "is unavailable when AI is off" do
      ENV["AI_ENABLED"] = "false"

      get_forecast("limits")
      expect(response).to have_http_status(:service_unavailable)
      expect(json_body.dig("error", "code")).to eq("AI_DISABLED")
    end

    it "is unavailable once the company has switched off that forecast, and the other still works" do
      organization.update!(ai_settings: { "features" => { "limits" => false } })

      get_forecast("limits")
      expect(response).to have_http_status(:service_unavailable)
      expect(json_body.dig("error", "code")).to eq("AI_FEATURE_OFF")
      get_forecast("parts")
      expect(response).to have_http_status(:ok)

      organization.update!(ai_settings: { "features" => { "parts" => false } })
      get_forecast("parts")
      expect(response).to have_http_status(:service_unavailable)
      expect(json_body.dig("error", "code")).to eq("AI_FEATURE_OFF")
    end

    it "works with a local model chosen, without asking it anything" do
      allow(Resolv).to receive(:getaddresses).and_return(["192.168.1.20"])
      organization.update!(ai_settings: local_model)
      expect(Ai::Client).not_to receive(:chat)

      get_forecast("limits")

      expect(response).to have_http_status(:ok)
    end
  end
end
