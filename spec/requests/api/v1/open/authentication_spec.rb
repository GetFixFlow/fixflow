require "rails_helper"

RSpec.describe "Public API: keys and scopes", type: :request do
  let(:org) { create(:organization) }

  describe "signing in with a key" do
    let!(:made) { make_key(org, scopes: %w[read]) }
    let(:key) { made.first }
    let(:raw) { made.last }

    it "takes the key as a bearer token" do
      get "/api/v1/open/me", headers: bearer(raw)

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]).to include("key" => include("name" => "Zapier", "scopes" => ["read"]),
"organization" => include("id" => org.id))
    end

    it "takes the key in the X-API-Key header too" do
      get "/api/v1/open/me", headers: { "X-API-Key" => raw }

      expect(response).to have_http_status(:ok)
    end

    it "refuses a request with no key, a wrong one, or a person's session token, in the API's own error shape" do
      [{}, bearer("fxk_#{'0' * 64}"), bearer("not-a-key"), auth_headers_for(create(:user, organization: org))].each do |headers|
        get "/api/v1/open/me", headers: headers

        expect(response).to have_http_status(:unauthorized)
        expect(json_body.dig("error", "code")).to eq("INVALID_API_KEY")
        expect(response.headers["WWW-Authenticate"]).to start_with("Bearer")
      end
    end

    it "refuses a revoked key and an expired key" do
      key.update!(active: false)
      get "/api/v1/open/me", headers: bearer(raw)
      expect(response).to have_http_status(:unauthorized)

      key.update!(active: true, expires_at: 1.minute.ago)
      get "/api/v1/open/me", headers: bearer(raw)
      expect(response).to have_http_status(:unauthorized)
    end

    it "refuses a key sent in the address, which would end up in logs" do
      get "/api/v1/open/me?api_key=#{raw}"

      expect(response).to have_http_status(:bad_request)
      expect(json_body.dig("error", "code")).to eq("KEY_IN_ADDRESS")
    end

    it "notes when the key was used, at most once a minute" do
      get "/api/v1/open/me", headers: bearer(raw)
      first = key.reload.last_used_at
      expect(first).to be_present

      get "/api/v1/open/me", headers: bearer(raw)
      expect(key.reload.last_used_at).to eq(first)

      travel 2.minutes do
        get "/api/v1/open/me", headers: bearer(raw)
        expect(key.reload.last_used_at).to be > first
      end
    end

    it "does not answer another company's key with this company's data" do
      other = create(:organization)
      create(:work_order, organization: org, title: "Ours")
      create(:work_order, organization: other, title: "Theirs")
      _, other_raw = make_key(other)

      get "/api/v1/open/work_orders", headers: bearer(other_raw)

      expect(json_body["data"].pluck("title")).to eq(["Theirs"])
    end
  end

  describe "the description of the API" do
    it "is served without a key, and says nothing about any company" do
      create(:work_order, organization: org, title: "Secret title")

      get "/api/v1/open/openapi"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("openapi" => "3.0.3", "info" => include("title" => "FixFlow public API"))
      expect(response.body).not_to include("Secret title")
    end
  end

  describe "scopes" do
    it "lets a read key read, and refuses it anything that changes data" do
      _, raw = make_key(org, scopes: %w[read])
      work_order = create(:work_order, organization: org)

      get "/api/v1/open/work_orders", headers: bearer(raw)
      expect(response).to have_http_status(:ok)

      post "/api/v1/open/work_orders", params: { work_order: { title: "No" } }, as: :json, headers: bearer(raw)
      expect(response).to have_http_status(:forbidden)
      expect(json_body.dig("error", "code")).to eq("INSUFFICIENT_SCOPE")

      patch "/api/v1/open/work_orders/#{work_order.id}", params: { work_order: { title: "No" } }, as: :json, headers: bearer(raw)
      expect(response).to have_http_status(:forbidden)

      post "/api/v1/open/work_orders/#{work_order.id}/transitions", params: { event: "cancel" }, as: :json, headers: bearer(raw)
      expect(response).to have_http_status(:forbidden)
      expect(work_order.reload.status).to eq("open")
      expect(WorkOrder.count).to eq(1)
    end

    it "lets a write key read and write" do
      _, raw = make_key(org, scopes: %w[write])

      get "/api/v1/open/work_orders", headers: bearer(raw)
      expect(response).to have_http_status(:ok)

      post "/api/v1/open/work_orders", params: { work_order: { title: "Yes" } }, as: :json, headers: bearer(raw)
      expect(response).to have_http_status(:created)
    end

    it "gives a key that may only send sensor readings no access to the public API" do
      _, raw = make_key(org, scopes: %w[iot])

      get "/api/v1/open/work_orders", headers: bearer(raw)

      expect(response).to have_http_status(:forbidden)
      expect(json_body.dig("error", "message")).to include("iot")
    end

    it "treats a key made before scopes existed (none), or with the old screen's names, as a sensor key" do
      [[], %w[iot_write], %w[iot_read iot_write], %w[iot:write]].each do |scopes|
        _, raw = make_key(org, scopes: scopes)

        get "/api/v1/open/me", headers: bearer(raw)
        expect(json_body.dig("data", "key", "scopes")).to eq(["iot"])

        get "/api/v1/open/work_orders", headers: bearer(raw)
        expect(response).to have_http_status(:forbidden)
      end
    end

    it "still lets such a key send sensor readings, and a read key not" do
      asset = create(:asset, organization: org)
      legacy, legacy_raw = make_key(org, scopes: [])
      _, read_raw = make_key(org, scopes: %w[read])

      post "/api/v1/iot/ingest", params: { asset_id: asset.id, metrics: { temperature: 50 } }, as: :json,
headers: { "X-API-Key" => read_raw }
      expect(response).to have_http_status(:forbidden)

      post "/api/v1/iot/ingest", params: { asset_id: asset.id, metrics: { temperature: 50 } }, as: :json,
headers: { "X-API-Key" => legacy_raw }
      expect(response).to have_http_status(:ok)
      expect(legacy.reload.last_used_at).to be_present
    end
  end

  describe "keys made by administrators" do
    let(:admin) { create(:user, :admin, organization: org) }

    it "may be given scopes, and nothing else" do
      post "/api/v1/api_keys", params: { api_key: { name: "n8n", scopes: %w[read write] } }, as: :json, headers: auth_headers_for(admin)

      expect(response).to have_http_status(:created)
      body = json_body["data"]
      expect(body).to include("scopes" => %w[read write], "prefix" => body["key"].first(12))
      get "/api/v1/open/me", headers: bearer(body["key"])
      expect(response).to have_http_status(:ok)

      post "/api/v1/api_keys", params: { api_key: { name: "bad", scopes: %w[admin] } }, as: :json, headers: auth_headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "is shown by its first characters, never the secret" do
      _, raw = make_key(org)

      get "/api/v1/api_keys", headers: auth_headers_for(admin)

      expect(response.body).not_to include(raw)
      expect(json_body["api_keys"].first["prefix"]).to eq(raw.first(12))
    end
  end

  describe "ApiKey.authenticate" do
    it "still finds a key made before key hints and before fast digests (bcrypt, no hint), and gives it a hint" do
      raw = "fxk_#{SecureRandom.hex(32)}"
      old = create(:api_key, organization: org, key_digest: BCrypt::Password.create(raw), key_hint: nil, scopes: [])

      expect(ApiKey.authenticate(raw)).to eq(old)
      expect(old.reload.key_hint).to eq(raw.first(12))
    end

    it "finds nothing for a key of another shape, or a near miss" do
      key, raw = make_key(org)

      expect(ApiKey.authenticate(nil)).to be_nil
      expect(ApiKey.authenticate("")).to be_nil
      expect(ApiKey.authenticate(raw.chop)).to be_nil
      expect(ApiKey.authenticate(raw.sub(/.\z/) { |c| c == "a" ? "b" : "a" })).to be_nil
      expect(ApiKey.authenticate(raw)).to eq(key)
    end

    it "stores a new key as a hash, not the key" do
      key, raw = make_key(org)

      expect(key.key_digest).to start_with("sha256:")
      expect(key.key_digest).not_to include(raw)
    end
  end
end
