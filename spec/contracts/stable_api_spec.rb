require "rails_helper"

# The promise of FixFlow 1.x (docs/stability.md): what a company's own programs depend on does not break within 1.x. This spec
# compares the public API, sensor ingestion, webhooks, the health check and the settings in `.env` with a baseline written
# down in spec/contracts/api_1_0_baseline.json, and fails when something in the baseline is gone or turned into something else.
# Adding is fine: a new field, route, event or setting.
#
# If this fails after your change, you have broken the promise: find another way (keep the old field and add the new one;
# accept the old and the new value). If you only *added* something, accept it into the baseline:
#
#   UPDATE_API_BASELINE=1 bundle exec rspec spec/contracts/stable_api_spec.rb
#
# That refuses to write when anything in the baseline would be lost, so it cannot be used to paper over a break. A break needs
# FixFlow 2.0, with the old and the new side by side for as long as the notice in docs/stability.md says.
# rubocop:disable RSpec/MultipleMemoizedHelpers -- a company with the records the answers are made from
RSpec.describe "The 1.x promise", type: :request do
  include ActiveJob::TestHelper

  let(:org)      { create(:organization) }
  let(:tech)     { create(:user, organization: org, first_name: "Tia", last_name: "Nguyen") }
  let(:site)     { create(:location, organization: org, name: "Plant") }
  let(:room)     { create(:location, organization: org, name: "Pump room", parent: site) }
  let!(:asset)   do
    create(:asset, organization: org, location: room, name: "Pump 3", barcode: "BC-3", warranty_expires_on: 1.year.from_now)
  end
  let!(:part)    { create(:part, organization: org, location: room, name: "Seal") }
  let!(:order)   { create(:work_order, organization: org, asset: asset, assignee: tech, title: "Leak", status: "assigned") }
  let!(:full_order) do # every field filled, so the kind of each is on record (a list is read as one row)
    create(:work_order, organization: org, asset: asset, assignee: tech, requester: tech, description: "Oil on the floor",
           due_date: 3.days.from_now, estimated_hours: 2.5, actual_hours: 3, started_at: 2.days.ago, completed_at: 1.day.ago,
           verified_at: 1.hour.ago, completion_notes: "Seal replaced", cancellation_reason: "None", status: "verified")
  end
  let(:reader)   { bearer(make_key(org, scopes: %w[read], expires_at: 1.month.from_now).last) }
  let(:writer)   { bearer(make_key(org, scopes: %w[read write]).last) }
  let(:sensor)   { { "X-API-Key" => make_key(org, scopes: %w[iot]).last } }
  let(:json)     { { "Content-Type" => "application/json" } }
  let(:current)  { ApiStability.surface(answers: current_answers) }

  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  def answer(into, name, status: nil)
    into[name] = ApiStability.shape(json_body).merge("(status)" => response.status.to_s)
    expect(response).to have_http_status(status) if status
  end

  # Real answers to real requests, as the shapes of their JSON. Records are made so that no field is left empty by accident.
  def public_api_answers
    {}.tap do |out|
      get("/api/v1/open/me", headers: reader)
      answer(out, "GET /open/me", status: 200)
      get("/api/v1/open/work_orders", headers: reader)
      answer(out, "GET /open/work_orders", status: 200)
      get("/api/v1/open/work_orders/#{full_order.id}", headers: reader)
      answer(out, "GET /open/work_orders/:id", status: 200)
      get("/api/v1/open/work_orders/0", headers: reader)
      answer(out, "GET /open/work_orders/:id (not found)", status: 404)
      get("/api/v1/open/work_orders", headers: bearer("fxk_wrong"))
      answer(out, "GET /open/work_orders (bad key)", status: 401)
      post("/api/v1/open/work_orders", params: { work_order: { title: "New" } }.to_json, headers: reader.merge(json))
      answer(out, "POST /open/work_orders (read-only key)", status: 403)
      post("/api/v1/open/work_orders", params: { work_order: { title: "" } }.to_json, headers: writer.merge(json))
      answer(out, "POST /open/work_orders (invalid)", status: 422)
    end
  end

  def public_api_writes
    {}.tap do |out|
      new_order = { title: "New", description: "Details", priority: "high", asset_id: asset.id, assignee_id: tech.id,
                    due_date: 2.days.from_now.iso8601, estimated_hours: 1.5, requester_name: "Sam",
                    requester_email: "sam@example.test" }
      post("/api/v1/open/work_orders", params: { work_order: new_order }.to_json, headers: writer.merge(json))
      answer(out, "POST /open/work_orders", status: 201)
      patch("/api/v1/open/work_orders/#{full_order.id}", params: { work_order: { title: "Renamed" } }.to_json,
                                                         headers: writer.merge(json))
      answer(out, "PATCH /open/work_orders/:id", status: 200)
      post("/api/v1/open/work_orders/#{order.id}/transitions", params: { event: "start" }.to_json, headers: writer.merge(json))
      answer(out, "POST /open/work_orders/:id/transitions", status: 200)
      new_asset = { name: "Fan 9", status: "operational", location_id: room.id, serial_number: "SN-9" }
      post("/api/v1/open/assets", params: { asset: new_asset }.to_json, headers: writer.merge(json))
      answer(out, "POST /open/assets", status: 201)
      patch("/api/v1/open/assets/#{asset.id}", params: { asset: { name: "Pump three" } }.to_json, headers: writer.merge(json))
      answer(out, "PATCH /open/assets/:id", status: 200)
    end
  end

  def public_api_lists
    {}.tap do |out|
      { "assets" => asset.id, "locations" => room.id, "parts" => part.id }.each do |name, id|
        get("/api/v1/open/#{name}", headers: reader)
        answer(out, "GET /open/#{name}", status: 200)
        get("/api/v1/open/#{name}/#{id}", headers: reader)
        answer(out, "GET /open/#{name}/:id", status: 200)
      end
    end
  end

  def sensor_answers
    {}.tap do |out|
      post("/api/v1/iot/ingest", params: { asset_id: asset.id, metric: "temperature", value: 72.4, unit: "C" }.to_json,
                                 headers: sensor.merge(json))
      answer(out, "POST /iot/ingest (one reading)", status: 200)
      post("/api/v1/iot/ingest", params: { asset_tag: asset.asset_tag, device_id: "pump-1", timestamp: Time.current.iso8601,
                                           readings: [{ metric: "temperature", value: 70.1, unit: "C" }] }.to_json,
                                 headers: sensor.merge(json))
      answer(out, "POST /iot/ingest (several readings from one device)", status: 200)
      post("/api/v1/iot/ingest", params: [{ asset_id: asset.id, metric: "vibration", value: 3.2, unit: "mm/s" }].to_json,
                                 headers: sensor.merge(json))
      answer(out, "POST /iot/ingest (a list of readings)", status: 200)
      get("/api/v1/health")
      answer(out, "GET /health", status: 200)
    end
  end

  def webhook_messages
    {}.tap do |out|
      create(:webhook, organization: org, events: Webhooks::EVENTS.keys)
      alert = create(:iot_alert, work_order: order, asset: asset, iot_rule: create(:iot_rule, asset: asset, organization: org))
      Webhooks.work_order(full_order, "work_order.completed", changes: { status: %w[in_progress completed] })
      Webhooks.asset(asset, "asset.status_changed", changes: { status: %w[operational down] })
      Webhooks.iot_alert(alert)
      Webhooks.part(part, :low)
      %w[work_order.completed asset.status_changed iot_alert.created part.low_stock].each do |event|
        out["webhook #{event}"] = ApiStability.shape(WebhookDelivery.where(event: event).last.payload)
      end
    end
  end

  def current_answers = public_api_answers.merge(public_api_writes, public_api_lists, sensor_answers, webhook_messages)

  if ENV["UPDATE_API_BASELINE"]
    it("writes the baseline") { expect { ApiStability.write_baseline(current) }.not_to raise_error }
  else
    it "keeps everything the 1.x promise covers" do
      expect(ApiStability.breaks(ApiStability.baseline, current)).to be_empty
    end
  end

  it "has a baseline that is not empty, so a missing file cannot pass for a kept promise" do
    baseline = ApiStability.baseline

    expect(baseline["routes"]).to include("GET /api/v1/open/work_orders", "POST /api/v1/iot/ingest", "GET /api/v1/health")
    expect(baseline["webhooks"]["events"]).to include("work_order.completed")
    expect(baseline["operations"].size).to be > 100
    expect(baseline["answers"].keys).to include("GET /open/work_orders", "POST /iot/ingest (one reading)", "webhook part.low_stock")
    expect(baseline["environment"]).to include("SECRET_KEY_BASE", "APP_URL")
  end

  # The comparison itself: each kind of break is found, and an addition is not one.
  describe "what counts as a break" do
    let(:promised) do
      { "routes" => ["GET /api/v1/open/me"], "environment" => %w[APP_URL],
        "webhooks" => { "events" => %w[work_order.created], "headers" => %w[X-FixFlow-Event],
                        "payloads" => { "asset" => %w[id name] } },
        "operations" => {
          "operation GET /work_orders" => { "type" => "operation" },
          "GET /work_orders param query status" => field("string"),
          "POST /work_orders request work_order.priority" => field("string", enum: %w[low high]),
          "GET /work_orders response 200 data[].title" => field("string")
        },
        "answers" => { "GET /open/me" => { "data" => "object", "data.id" => "number", "data.note" => "null", "(status)" => "200" } } }
    end

    def field(type, nullable: false, required: false, enum: nil)
      { "type" => type, "nullable" => nullable, "required" => required, "enum" => enum }
    end

    # The baseline with the thing at that path (a list of keys) replaced.
    def changed(*path, value)
      copy = Marshal.load(Marshal.dump(promised))
      path[0..-2].inject(copy) { |node, key| node[key] }[path.last] = value
      copy
    end

    it "finds nothing when nothing changed, and nothing in an addition" do
      added = Marshal.load(Marshal.dump(promised))
      added["routes"] << "GET /api/v1/open/new"
      added["environment"] << "NEW_SETTING"
      added["webhooks"]["events"] << "asset.deleted"
      added["webhooks"]["payloads"]["asset"] << "color"
      added["operations"]["GET /work_orders param query color"] = field("string")
      added["operations"]["GET /work_orders response 200 data[].color"] = field("string", nullable: true)
      added["operations"]["POST /work_orders request work_order.priority"]["enum"] << "urgent"
      added["answers"]["GET /open/me"]["data.name"] = "string"

      expect(ApiStability.breaks(promised, promised)).to be_empty
      expect(ApiStability.breaks(promised, added)).to be_empty
    end

    it "finds a route, a setting, a webhook event, a header or a field of a webhook message that is gone" do
      expect(ApiStability.breaks(promised, changed("routes", []))).to include(match(%r{GET /api/v1/open/me is gone}))
      expect(ApiStability.breaks(promised, changed("environment", []))).to include(match(/APP_URL is gone/))
      expect(ApiStability.breaks(promised, changed("webhooks", "events", []))).to include(match(/work_order.created is gone/))
      expect(ApiStability.breaks(promised, changed("webhooks", "headers", []))).to include(match(/X-FixFlow-Event is gone/))
      expect(ApiStability.breaks(promised, changed("webhooks", "payloads", "asset", %w[id]))).to include(match(/name is gone/))
    end

    it "finds an operation, a parameter, or a field of an answer that is gone" do
      gone = Marshal.load(Marshal.dump(promised))
      gone["operations"].delete("operation GET /work_orders")
      gone["operations"].delete("GET /work_orders param query status")
      gone["operations"].delete("GET /work_orders response 200 data[].title")

      expect(ApiStability.breaks(promised, gone)).to contain_exactly(
        match(%r{operation GET /work_orders is gone}), match(/param query status is gone/), match(/data\[\]\.title is gone/)
      )
    end

    it "finds a field that changed its type, and an answer that can now be empty" do
      retyped = changed("operations", "GET /work_orders response 200 data[].title", { "type" => "integer", "nullable" => true })

      expect(ApiStability.breaks(promised, retyped)).to include(match(/was string, is integer/), match(/can now be empty/))
    end

    it "finds a choice a request can no longer send, a parameter that became required, and a new one that is" do
      narrowed = changed("operations", "POST /work_orders request work_order.priority",
                         { "type" => "string", "required" => true, "enum" => %w[low] })
      narrowed["operations"]["GET /work_orders param query color"] = { "type" => "string", "required" => true }

      expect(ApiStability.breaks(promised, narrowed)).to include(match(/no longer accepts high/), match(/is now required/),
                                                                  match(/param query color is new and required/))
    end

    it "finds an answer that is gone, a field that is gone, a changed kind and a changed status, but not a null that was filled" do
      shape = { "data" => "object", "data.id" => "string", "data.note" => "string", "(status)" => "201" }
      gone = changed("answers", "GET /open/me", shape)
      expect(ApiStability.breaks(promised, gone)).to contain_exactly(match(/data.id was number, is string/),
                                                                     match(/\(status\) was 200, is 201/))

      expect(ApiStability.breaks(promised, changed("answers", {}))).to include("GET /open/me: is not answered any more")
      without_id = changed("answers", "GET /open/me", { "(status)" => "200" })
      expect(ApiStability.breaks(promised, without_id)).to include(match(/data.id is gone/))
    end

    it "reads the rows of a list as one, and a null never hides a kind" do
      rows = [{ "id" => 1, "note" => nil }, { "id" => 2, "note" => "x", "extra" => [] }]

      expect(ApiStability.shape({ "data" => rows })).to eq("data" => "array", "data[]" => "object", "data[].id" => "number",
                                                            "data[].note" => "string", "data[].extra" => "array")
    end

    it "refuses to write a baseline that would lose something, so an update cannot hide a break" do
      current = ApiStability.surface(answers: ApiStability.baseline["answers"])
      current["routes"] = current["routes"] - ["GET /api/v1/open/me"]
      expect(ApiStability::BASELINE).not_to receive(:write)

      expect { ApiStability.write_baseline(current) }.to raise_error(%r{this breaks the 1.x promise.*open/me is gone}m)
    end
  end
end
# rubocop:enable RSpec/MultipleMemoizedHelpers
