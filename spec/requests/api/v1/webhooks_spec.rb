require "rails_helper"

RSpec.describe "Webhooks (administrators)", type: :request do
  let(:org)   { create(:organization) }
  let(:admin) { create(:user, :admin, organization: org) }
  let(:headers) { auth_headers_for(admin) }
  let(:url) { "https://hooks.example.test/in/abc" }

  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  def make(attrs = {})
    post("/api/v1/webhooks",
  params: { webhook: { name: "n8n", url: url, events: %w[work_order.completed], **attrs } }, as: :json, headers: headers)
  end

  describe "who may" do
    it "is for administrators only, in every way" do # rubocop:disable RSpec/ExampleLength
      hook = create(:webhook, organization: org)
      delivery = Webhooks.ping(hook)

      [create(:user, :manager, organization: org), create(:user, organization: org),
       create(:user, :requester, organization: org)].each do |person|
        h = auth_headers_for(person)
        get "/api/v1/webhooks", headers: h
        expect(response).to have_http_status(:forbidden)
        post "/api/v1/webhooks", params: { webhook: { name: "x", url: url, events: %w[work_order.created] } }, as: :json, headers: h
        expect(response).to have_http_status(:forbidden)
        %w[rotate_secret enable test].each do |action|
          post "/api/v1/webhooks/#{hook.id}/#{action}", headers: h
          expect(response).to have_http_status(:forbidden)
        end
        post "/api/v1/webhooks/deliveries/#{delivery.id}/redeliver", headers: h
        expect(response).to have_http_status(:forbidden)
        delete "/api/v1/webhooks/#{hook.id}", headers: h
        expect(response).to have_http_status(:forbidden)
      end
      expect(Webhook.exists?(hook.id)).to be(true)
    end

    it "needs a sign-in, and an API key is not one" do
      get "/api/v1/webhooks"
      expect(response).to have_http_status(:unauthorized)

      _, raw = make_key(org, scopes: %w[write])
      get "/api/v1/webhooks", headers: bearer(raw)
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "making one" do
    it "saves it and sends the secret once, and never again" do
      make

      expect(response).to have_http_status(:created)
      secret = json_body["secret"]
      expect(secret).to start_with("whsec_")
      expect(json_body["webhook"]).to include("name" => "n8n", "url" => url, "events" => %w[work_order.completed], "active" => true,
"enabled" => true)
      expect(json_body["webhook"].keys).not_to include("secret", "secret_ciphertext")

      get "/api/v1/webhooks", headers: headers
      expect(response.body).not_to include(secret)
      get "/api/v1/webhooks/#{json_body['webhooks'].first['id']}", headers: headers
      expect(response.body).not_to include(secret)
      expect(Webhook.last.secret).to eq(secret)
      expect(Webhook.last.secret_ciphertext).not_to include(secret)
    end

    it "lists the events that can be chosen, with words" do
      get "/api/v1/webhooks", headers: headers

      expect(json_body["events"]).to include("key" => "work_order.completed", "label" => "Work is finished")
      expect(json_body["events"].size).to eq(Webhooks::EVENTS.size)
    end

    it "refuses an address at this server, one that is not a web address, and one with a login" do
      ["http://127.0.0.1/x", "http://169.254.169.254/latest", "ftp://example.test/x", "https://u:p@example.test/x", ""].each do |bad|
        make(url: bad)
        expect(response).to have_http_status(:unprocessable_entity), bad
      end
      expect(Webhook.count).to eq(0)
    end

    it "refuses no events, and events that do not exist" do
      make(events: [])
      expect(response).to have_http_status(:unprocessable_entity)
      make(events: %w[work_order.exploded])
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("work_order.exploded")
    end

    it "refuses a name that is missing, and more than twenty webhooks" do
      make(name: "")
      expect(response).to have_http_status(:unprocessable_entity)

      create_list(:webhook, 20, organization: org)
      make
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("20 webhooks")
    end

    it "notes who made it, and writes it in the audit log (without the secret)" do
      make

      expect(Webhook.last.created_by).to eq(admin)
      line = ActivityLog.where(action: "webhook.created").last
      expect(line).to be_present
      expect(ActivityLog.all.map(&:metadata).to_json).not_to include(json_body["secret"])
    end
  end

  describe "changing and removing" do
    let!(:hook) { create(:webhook, organization: org) }

    it "changes the name, address, events and whether it is on" do
      change = { name: "Zapier", url: "https://hooks.zapier.test/x", events: %w[asset.created], active: false }
      patch "/api/v1/webhooks/#{hook.id}", params: { webhook: change },
                                           as: :json, headers: headers

      expect(response).to have_http_status(:ok)
      expect(hook.reload).to have_attributes(name: "Zapier", url: "https://hooks.zapier.test/x", events: %w[asset.created],
active: false)
    end

    it "refuses a change to a bad address" do
      patch "/api/v1/webhooks/#{hook.id}", params: { webhook: { url: "http://127.0.0.1/x" } }, as: :json, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(hook.reload.url).to eq(url)
    end

    it "removes it with its record of messages" do
      Webhooks.ping(hook)

      delete "/api/v1/webhooks/#{hook.id}", headers: headers

      expect(response).to have_http_status(:no_content)
      expect(Webhook.exists?(hook.id)).to be(false)
      expect(WebhookDelivery.count).to eq(0)
    end

    it "does not reach another company's" do
      theirs = create(:webhook, organization: create(:organization))

      patch "/api/v1/webhooks/#{theirs.id}", params: { webhook: { name: "Taken" } }, as: :json, headers: headers
      expect(response).to have_http_status(:not_found)
      delete "/api/v1/webhooks/#{theirs.id}", headers: headers
      expect(response).to have_http_status(:not_found)
      get "/api/v1/webhooks", headers: headers
      expect(json_body["webhooks"].pluck("id")).to eq([hook.id])
    end

    it "stays when the person who made it is deleted" do
      maker = create(:user, organization: org)
      hook.update!(created_by: maker)

      maker.destroy!

      expect(hook.reload.created_by).to be_nil
    end
  end

  describe "the secret" do
    let!(:hook) { create(:webhook, organization: org) }

    it "can be renewed: a new one is sent once, and the old one stops signing" do
      old = hook.secret

      post "/api/v1/webhooks/#{hook.id}/rotate_secret", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body["secret"]).to start_with("whsec_").and(satisfy { |s| s != old })
      expect(hook.reload.secret).to eq(json_body["secret"])
      expect(ActivityLog.where(action: "webhook.secret_renewed")).to exist
    end
  end

  describe "testing" do
    let!(:hook) { create(:webhook, organization: org) }

    it "sends a test message now and answers with what the receiver said" do
      stub = stub_request(:post, url).with(headers: { "X-FixFlow-Event" => "ping" }).to_return(status: 200, body: "got it")

      post "/api/v1/webhooks/#{hook.id}/test", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body["delivery"]).to include("event" => "ping", "status" => "delivered", "response_code" => 200,
"response_excerpt" => "got it", "attempts" => 1)
      expect(stub).to have_been_requested
    end

    it "says what went wrong, in words, when the receiver refuses or cannot be reached" do
      stub_request(:post, url).to_return(status: 404)
      post "/api/v1/webhooks/#{hook.id}/test", headers: headers
      expect(json_body["delivery"]).to include("response_code" => 404, "error" => "The receiver answered 404.", "status" => "pending")

      stub_request(:post, url).to_timeout
      post "/api/v1/webhooks/#{hook.id}/test", headers: headers
      expect(json_body.dig("delivery", "error")).to match(/Could not reach the receiver/)
    end

    it "tests a webhook that is switched off too (that is how an address is checked before switching on)" do
      hook.update!(active: false)
      stub_request(:post, url).to_return(status: 200)

      post "/api/v1/webhooks/#{hook.id}/test", headers: headers

      expect(json_body.dig("delivery", "status")).to eq("delivered")
    end
  end

  describe "switching on again" do
    it "clears what switched it off" do
      hook = create(:webhook, organization: org, disabled_at: Time.current, disabled_reason: "failing", consecutive_failures: 10)

      post "/api/v1/webhooks/#{hook.id}/enable", headers: headers

      expect(json_body["webhook"]).to include("enabled" => true, "disabled_reason" => nil, "consecutive_failures" => 0)
    end
  end

  describe "the record of messages" do
    let!(:hook) { create(:webhook, organization: org) }

    it "shows the latest messages of a webhook, newest first, with what happened" do
      stub_request(:post, url).to_return(status: 200)
      first = Webhooks.ping(hook)
      second = Webhooks.ping(hook)
      WebhookDeliveryJob.perform_now(first.id)

      get "/api/v1/webhooks/#{hook.id}", headers: headers

      expect(json_body["deliveries"].pluck("id")).to eq([second.id, first.id])
      expect(json_body["deliveries"].last).to include("status" => "delivered", "response_code" => 200)
      expect(json_body["deliveries"].first).to include("status" => "pending", "attempts" => 0)
    end

    it "sends a message again as a new delivery with the same event id" do
      stub_request(:post, url).to_return(status: 200)
      old = Webhooks.ping(hook)

      post "/api/v1/webhooks/deliveries/#{old.id}/redeliver", headers: headers

      expect(response).to have_http_status(:created)
      expect(json_body["delivery"]).to include("event" => "ping", "event_id" => old.event_id, "status" => "pending")
      expect(json_body.dig("delivery", "id")).not_to eq(old.id)
      expect(WebhookDelivery.where(event_id: old.event_id).count).to eq(2)
    end

    it "does not redeliver another company's message" do
      theirs = Webhooks.ping(create(:webhook, organization: create(:organization)))

      post "/api/v1/webhooks/deliveries/#{theirs.id}/redeliver", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
