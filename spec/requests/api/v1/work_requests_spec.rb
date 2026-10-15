require "rails_helper"

RSpec.describe "Public work requests", type: :request do
  # The install's one company is the first one created.
  let!(:company)  { create(:organization) }
  let!(:location) { ActsAsTenant.with_tenant(company) { create(:location, organization: company, name: "Boiler room") } }
  let!(:asset)    { ActsAsTenant.with_tenant(company) { create(:asset, organization: company, location: location, name: "Pump 3") } }
  let!(:manager)  { create(:user, :manager, organization: company) }

  let(:valid_params) do
    { work_request: { requester_name: "Kamal Perera", requester_email: "Kamal@Example.com",
                      description: "The pump is leaking onto the floor", asset_code: asset.public_code } }
  end

  def submit(params = valid_params, headers: {})
    post "/api/v1/work_requests", params: params, as: :json, headers: headers
  end

  def work_order_of(token)
    ActsAsTenant.without_tenant { WorkOrder.find_by!(public_token: token) }
  end

  describe "POST /api/v1/work_requests" do
    it "creates a work order for the company without any sign-in" do
      expect { submit }.to change { ActsAsTenant.without_tenant { WorkOrder.count } }.by(1)

      expect(response).to have_http_status(:created)
      work_order = work_order_of(json_body["token"])
      expect(work_order).to have_attributes(
        organization_id: company.id, asset_id: asset.id, status: "open", requester_id: nil,
        requester_name: "Kamal Perera", requester_email: "kamal@example.com",
        title: "The pump is leaking onto the floor"
      )
    end

    it "tells the managers" do
      expect { submit }.to have_enqueued_job(NotifyNewRequestJob)
    end

    it "gives an unguessable link: 128 random bits, different every time" do
      submit
      first = json_body["token"]
      submit(valid_params.deep_merge(work_request: { description: "Another problem entirely" }))
      second = json_body["token"]

      expect(first).to match(/\A[A-Za-z0-9_-]{22}\z/)
      expect(second).to match(/\A[A-Za-z0-9_-]{22}\z/)
      expect(first).not_to eq(second)
    end

    it "uses the company's default priority and ignores any priority, status or company the caller sends" do
      other = create(:organization)
      submit(valid_params.deep_merge(work_request: { priority: "critical", status: "completed",
                                                      organization_id: other.id, assignee_id: manager.id,
                                                      public_token: "chosen-by-caller" }))

      expect(response).to have_http_status(:created)
      work_order = work_order_of(json_body["token"])
      expect(work_order).to have_attributes(priority: "medium", status: "open", organization_id: company.id, assignee_id: nil)
      expect(work_order.public_token).not_to eq("chosen-by-caller")
    end

    it "works without an equipment code or an email, keeping what was typed about the place and equipment" do
      submit({ work_request: { requester_name: "Visitor", description: "Lift door will not close",
                               location_description: "Block B, floor 2", asset_description: "Lift 4" } })

      expect(response).to have_http_status(:created)
      work_order = work_order_of(json_body["token"])
      expect(work_order.asset_id).to be_nil
      expect(work_order.requester_email).to be_nil
      expect(work_order.description).to eq("Lift door will not close\n\nLocation: Block B, floor 2\n\nEquipment: Lift 4")
    end

    it "does not take an asset id for an equipment code" do
      submit({ work_request: { requester_name: "X", description: "Something is broken here", asset_code: asset.id.to_s } })

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "rejects an unknown or removed equipment code" do
      removed = ActsAsTenant.with_tenant(company) { create(:asset, :discarded, organization: company) }

      ["nope", removed.public_code].each do |code|
        submit(valid_params.deep_merge(work_request: { asset_code: code }))
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_body.dig("error", "code")).to eq("VALIDATION_ERROR")
      end
    end

    it "rejects an equipment code from another company's install" do
      other = create(:organization)
      foreign = ActsAsTenant.with_tenant(other) { create(:asset, organization: other) }

      submit(valid_params.deep_merge(work_request: { asset_code: foreign.public_code }))

      expect(response).to have_http_status(:unprocessable_entity)
    end

    {
      "no name"             => { requester_name: "" },
      "a name over 100"     => { requester_name: "n" * 101 },
      "a short description" => { description: "broken" },
      "a description over 2000" => { description: "d" * 2001 },
      "a bad email"         => { requester_email: "not an email" },
      "an email over 254"   => { requester_email: "#{'a' * 250}@x.com" },
      "a location over 200" => { location_description: "l" * 201 },
      "equipment text over 200" => { asset_description: "e" * 201 }
    }.each do |label, change|
      it "rejects #{label}" do
        expect { submit(valid_params.deep_merge(work_request: change)) }
          .not_to(change { ActsAsTenant.without_tenant { WorkOrder.count } })

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_body.dig("error", "code")).to eq("VALIDATION_ERROR")
      end
    end

    it "takes control characters and null bytes out instead of failing on them" do
      submit(valid_params.deep_merge(work_request: { requester_name: "Ka\u0000mal\u0007",
description: "Leak\u0000 near\r\npump\u001B[31m now" }))

      expect(response).to have_http_status(:created)
      work_order = work_order_of(json_body["token"])
      expect(work_order.requester_name).to eq("Kamal")
      expect(work_order.description).to eq("Leak near\npump[31m now")
    end

    it "does not run markup or scripts (mail is plain text, the page escapes) but keeps the words as typed" do
      submit(valid_params.deep_merge(work_request: { description: "<script>alert(1)</script> pump is leaking" }))

      expect(response).to have_http_status(:created)
      expect(json_body.dig("data", "description")).to eq("<script>alert(1)</script> pump is leaking")
    end

    it "pretends to succeed for a bot that filled the hidden field (a person cannot see it), and creates nothing" do
      expect { submit(valid_params.deep_merge(work_request: { leave_empty: "http://spam.example" })) }
        .not_to(change { ActsAsTenant.without_tenant { WorkOrder.count } })

      expect(response).to have_http_status(:created)
      expect(json_body["data"]["token"]).to match(/\A[A-Za-z0-9_-]{22}\z/)
      expect(NotifyNewRequestJob).not_to have_been_enqueued
    end

    it "refuses a body over 16 KB before reading it" do
      expect { submit(valid_params, headers: { "CONTENT_LENGTH" => (17 * 1024).to_s }) }
        .not_to(change { ActsAsTenant.without_tenant { WorkOrder.count } })

      expect(response).to have_http_status(:content_too_large)
    end

    it "asks for the fields when none are sent" do
      post "/api/v1/work_requests", params: {}, as: :json

      expect(response).to have_http_status(:bad_request)
    end

    it "is not found before the company is set up" do
      ActsAsTenant.without_tenant { Organization.destroy_all }

      submit

      expect(response).to have_http_status(:not_found)
    end

    it "ignores a stale sign-in token sent along, instead of answering 401 (which would send the page to the login screen)" do
      submit(valid_params, headers: { "Authorization" => "Bearer stale.token.value" })

      expect(response).to have_http_status(:created)
    end

    it "is never cached, indexed or leaked through the Referer header" do
      submit

      expect(response.headers["Cache-Control"]).to eq("no-store")
      expect(response.headers["X-Robots-Tag"]).to include("noindex")
      expect(response.headers["Referrer-Policy"]).to eq("no-referrer")
    end
  end

  describe "GET /api/v1/work_requests/:token" do
    let!(:work_order) do
      ActsAsTenant.with_tenant(company) do
        create(:work_order, :public_request, organization: company, asset: asset, public_token: "a" * 22,
                                             requester_name: "Kamal Perera", requester_email: "kamal@example.com",
                                             title: "Pump leaking", description: "Leak near pump")
      end
    end

    it "shows the progress of that one request, and nothing else" do
      get "/api/v1/work_requests/#{'a' * 22}"

      expect(response).to have_http_status(:ok)
      expect(json_body["data"].keys).to contain_exactly("token", "title", "description", "status", "created_at", "updated_at")
      expect(json_body["data"]).to include("status" => "received", "title" => "Pump leaking", "description" => "Leak near pump")
    end

    it "does not show who asked, who is on it, what it costs, or how many work orders there are" do
      ActsAsTenant.with_tenant(company) do
        work_order.update!(assignee: manager)
        create(:comment, commentable: work_order, user: manager, body: "internal chatter about the budget")
      end

      get "/api/v1/work_requests/#{'a' * 22}"

      body = response.body
      ["kamal@example.com", "Kamal Perera", manager.email, manager.first_name.to_s, "internal chatter",
       work_order.work_order_number, "labor_cost", "parts_cost", "assignee", "requester", "organization", "\"id\""].each do |secret|
        expect(body).not_to include(secret), "the status leaked #{secret.inspect}"
      end
    end

    it "shows the stages in words anyone can follow, whatever the team calls them" do
      {
        "open" => "received", "assigned" => "assigned", "in_progress" => "in_progress",
        "on_hold" => "in_progress", "pending_parts" => "in_progress",
        "completed" => "completed", "verified" => "completed", "cancelled" => "cancelled"
      }.each do |internal, shown|
        work_order.update_columns(status: internal) # rubocop:disable Rails/SkipsModelValidations -- the team moves it through states that need people

        get "/api/v1/work_requests/#{'a' * 22}"

        expect(json_body.dig("data", "status")).to eq(shown), "#{internal} should show as #{shown}"
      end
    end

    it "does not show the team's reasons for cancelling or rejecting" do
      work_order.update_columns(status: "cancelled", cancellation_reason: "Budget frozen, secret reason", rejection_reason: "secret") # rubocop:disable Rails/SkipsModelValidations

      get "/api/v1/work_requests/#{'a' * 22}"

      expect(response.body).not_to include("secret")
    end

    it "is not found for a wrong token, and says the same as for one that never existed" do
      get "/api/v1/work_requests/#{'b' * 22}"
      wrong = [response.status, json_body.dig("error", "code")]
      get "/api/v1/work_requests/#{'a' * 21}"
      short = [response.status, json_body.dig("error", "code")]

      expect(wrong).to eq([404, "RESOURCE_NOT_FOUND"])
      expect(short).to eq(wrong)
    end

    it "cannot be used to read other work orders by their id or number" do
      internal = ActsAsTenant.with_tenant(company) { create(:work_order, organization: company) }

      [internal.id.to_s, internal.work_order_number, "WO-000001", "0", "1"].each do |guess|
        get "/api/v1/work_requests/#{guess}"
        expect(response).to have_http_status(:not_found), "#{guess} was answered"
      end
    end

    it "is not found for a link that belongs to another company" do
      other = create(:organization)
      ActsAsTenant.with_tenant(other) do
        create(:work_order, :public_request, organization: other, public_token: "z" * 22)
      end

      get "/api/v1/work_requests/#{'z' * 22}"

      expect(response).to have_http_status(:not_found)
    end

    it "needs no sign-in and sets the privacy headers" do
      get "/api/v1/work_requests/#{'a' * 22}"

      expect(response.headers["Cache-Control"]).to eq("no-store")
      expect(response.headers["X-Robots-Tag"]).to include("noindex")
      expect(response.headers["Referrer-Policy"]).to eq("no-referrer")
    end

    it "sees a request made through the form" do
      submit
      get "/api/v1/work_requests/#{json_body['token']}"

      expect(response).to have_http_status(:ok)
      expect(json_body.dig("data", "status")).to eq("received")
    end
  end

  describe "GET /api/v1/public_assets/:code" do
    it "tells whoever scanned the label which equipment it is, and nothing more" do
      get "/api/v1/public_assets/#{asset.public_code}"

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]).to eq("name" => "Pump 3", "asset_tag" => asset.asset_tag, "location" => "Boiler room")
    end

    it "is not found for an unknown code, an asset id, a tag or a removed asset" do
      removed = ActsAsTenant.with_tenant(company) { create(:asset, :discarded, organization: company) }

      ["unknowncode12", asset.id.to_s, asset.asset_tag, removed.public_code].each do |code|
        get "/api/v1/public_assets/#{code}"
        expect(response).to have_http_status(:not_found), "#{code} was answered"
      end
    end
  end
end
