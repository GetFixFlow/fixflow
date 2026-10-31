require "rails_helper"

RSpec.describe "Api::V1::PurchaseOrders", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:colleague)  { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let(:seal)       { create(:part, organization: org, name: "Seal", quantity_on_hand: 1, unit_cost: 4.5) }
  let(:acme)       { create(:vendor, organization: org, name: "Acme Supply") }

  def ask(as: technician, lines: [{ part_id: seal.id, quantity: 6 }], **order)
    post "/api/v1/purchase_orders", params: { purchase_order: { reason: "Pump keeps leaking", **order }, lines: lines },
                                    headers: auth_headers_for(as), as: :json
  end

  def post_to(order, action, as: manager, **params)
    post "/api/v1/purchase_orders/#{order.id}/#{action}", params: params, headers: auth_headers_for(as), as: :json
  end

  describe "asking for parts" do
    it "lets a technician ask, taking each part's own cost when none is given, and tells the managers" do
      manager
      expect { ask }.to have_enqueued_job(PurchaseRequestedJob)

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("number" => "PO-000001", "status" => "requested", "reason" => "Pump keeps leaking",
                                           "total" => 27.0)
      expect(json_body["data"]["requested_by"]).to include("id" => technician.id)
      expect(json_body["data"]["lines"].first).to include("part_name" => "Seal", "quantity" => 6.0, "unit_cost" => 4.5,
                                                          "quantity_received" => 0.0)
    end

    it "is refused with no parts, or a part of another company, and is not for a requester" do
      ask(lines: [])
      expect(response).to have_http_status(:unprocessable_entity)

      ask(lines: [{ part_id: create(:part).id, quantity: 1 }])
      expect(response).to have_http_status(:unprocessable_entity)

      ask(as: requester)
      expect(response).to have_http_status(:forbidden)
    end

    it "keeps the vendor and delivery date for managers" do
      ask(vendor_id: acme.id)
      expect(response).to have_http_status(:forbidden)

      ask(as: manager, vendor_id: acme.id, expected_on: "2026-11-20")
      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("expected_on" => "2026-11-20")
      expect(json_body["data"]["vendor"]).to include("name" => "Acme Supply")
    end
  end

  describe "who sees what" do
    let!(:mine)   { create(:purchase_order, organization: org, requested_by: technician) }
    let!(:theirs) { create(:purchase_order, organization: org, requested_by: colleague) }

    it "shows a technician only their own requests, and a manager everything with the number waiting" do
      get "/api/v1/purchase_orders", headers: auth_headers_for(technician)
      expect(json_body["purchase_orders"].pluck("id")).to eq([mine.id])
      expect(json_body["waiting_for_approval"]).to be_nil

      get "/api/v1/purchase_orders", headers: auth_headers_for(manager)
      expect(json_body["purchase_orders"].pluck("id")).to eq([theirs.id, mine.id])
      expect(json_body["waiting_for_approval"]).to eq(2)
    end

    it "opens a request for its owner and managers, not for a colleague, another company or a requester" do
      get "/api/v1/purchase_orders/#{mine.id}", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:ok)
      expect(json_body["data"]["lines"].size).to eq(1)

      get "/api/v1/purchase_orders/#{theirs.id}", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)

      get "/api/v1/purchase_orders/#{create(:purchase_order).id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:not_found)

      get "/api/v1/purchase_orders", headers: auth_headers_for(requester)
      expect(response).to have_http_status(:forbidden)
    end

    it "filters by status, vendor, part and search text" do
      theirs.update!(status: "approved", vendor: acme)

      get "/api/v1/purchase_orders", params: { status: "approved,ordered" }, headers: auth_headers_for(manager)
      expect(json_body["purchase_orders"].pluck("id")).to eq([theirs.id])

      get "/api/v1/purchase_orders", params: { vendor_id: acme.id }, headers: auth_headers_for(manager)
      expect(json_body["purchase_orders"].pluck("id")).to eq([theirs.id])

      get "/api/v1/purchase_orders", params: { part_id: mine.lines.first.part_id }, headers: auth_headers_for(manager)
      expect(json_body["purchase_orders"].pluck("id")).to eq([mine.id])

      get "/api/v1/purchase_orders", params: { search: mine.number }, headers: auth_headers_for(manager)
      expect(json_body["purchase_orders"].pluck("id")).to eq([mine.id])
    end
  end

  describe "changing a request" do
    let!(:request_by_tech) { create(:purchase_order, organization: org, requested_by: technician) }

    it "lets the person who asked change the parts and the reason while it waits, replacing the lines sent" do
      line = request_by_tech.lines.first
      patch "/api/v1/purchase_orders/#{request_by_tech.id}", as: :json, headers: auth_headers_for(technician),
                                                              params: { purchase_order: { reason: "Two this time" },
                                                                        lines: [{ id: line.id, part_id: line.part_id, quantity: 2 },
                                                                                { part_id: seal.id, quantity: 1 }] }

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]["reason"]).to eq("Two this time")
      expect(json_body["data"]["lines"].pluck("quantity")).to eq([2.0, 1.0])

      patch "/api/v1/purchase_orders/#{request_by_tech.id}", params: { purchase_order: { reason: "x" }, lines: [] }, as: :json,
                                                              headers: auth_headers_for(technician)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "is not for a colleague, and not for the person who asked once it has been decided" do
      patch "/api/v1/purchase_orders/#{request_by_tech.id}", params: { purchase_order: { reason: "mine now" } }, as: :json,
                                                              headers: auth_headers_for(colleague)
      expect(response).to have_http_status(:forbidden)

      request_by_tech.update!(status: "approved")
      patch "/api/v1/purchase_orders/#{request_by_tech.id}", params: { purchase_order: { reason: "late" } }, as: :json,
                                                              headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)

      patch "/api/v1/purchase_orders/#{request_by_tech.id}", params: { purchase_order: { reason: "ok" } }, as: :json,
                                                              headers: auth_headers_for(manager)
      expect(response).to have_http_status(:ok)
    end

    it "cannot be changed by anyone once it is ordered" do
      request_by_tech.update!(status: "ordered", vendor: acme)

      patch "/api/v1/purchase_orders/#{request_by_tech.id}", params: { purchase_order: { reason: "x" } }, as: :json,
                                                              headers: auth_headers_for(manager)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "the steps, from request to received" do
    let!(:po) { create(:purchase_order, organization: org, requested_by: technician) }

    it "is approved by a manager, who is recorded, and not by a technician" do
      post_to(po, :approve, as: technician)
      expect(response).to have_http_status(:forbidden)

      post_to(po, :approve)
      expect(response).to have_http_status(:ok)
      expect(json_body["data"]).to include("status" => "approved")
      expect(json_body["data"]["decided_by"]).to include("id" => manager.id)
      expect(ActivityLog.where(action: "purchase_order.approved", resource_id: po.id)).to exist
    end

    it "is turned down with a reason, and nothing more can then be done with it" do
      post_to(po, :reject)
      expect(response).to have_http_status(:unprocessable_entity)

      post_to(po, :reject, reason: "Use the stock in Store B")
      expect(json_body["data"]).to include("status" => "rejected", "rejection_reason" => "Use the stock in Store B")

      post_to(po, :approve)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["code"]).to eq("INVALID_TRANSITION")
    end

    it "is ordered from a vendor once approved, and not before, nor without a vendor" do
      post_to(po, :order, vendor_id: acme.id)
      expect(response).to have_http_status(:unprocessable_entity)

      po.update!(status: "approved")
      post_to(po, :order)
      expect(response).to have_http_status(:unprocessable_entity)

      post_to(po, :order, vendor_id: acme.id, expected_on: "2026-11-20", supplier_reference: "Q-1182")
      expect(json_body["data"]).to include("status" => "ordered", "supplier_reference" => "Q-1182")
      expect(json_body["data"]["ordered_at"]).to be_present
    end

    it "adds to the stock as it is received, part by part, and is received once everything is in" do
      po.update!(status: "ordered", vendor: acme)
      po.lines.first.update!(part: seal, quantity: 6)
      line = po.lines.first.id

      post_to(po, :receive, lines: [{ id: line, quantity: 4 }])
      expect(json_body["data"]).to include("status" => "partially_received")
      expect(seal.reload.quantity_on_hand).to eq(5)

      post_to(po, :receive, lines: [{ id: line, quantity: 3 }])
      expect(response).to have_http_status(:unprocessable_entity)
      expect(seal.reload.quantity_on_hand).to eq(5)

      post_to(po, :receive, lines: [{ id: line, quantity: 2 }])
      expect(json_body["data"]).to include("status" => "received")
      expect(seal.reload.quantity_on_hand).to eq(7)
      expect(ActivityLog.where(action: "purchase_order.received", resource_id: po.id).count).to eq(2)
    end

    it "can be received only by a manager, and only once it is ordered" do
      post_to(po, :receive, lines: [])
      expect(response).to have_http_status(:unprocessable_entity)

      po.update!(status: "ordered", vendor: acme)
      post_to(po, :receive, as: technician, lines: [{ id: po.lines.first.id, quantity: 1 }])
      expect(response).to have_http_status(:forbidden)
    end

    it "can be closed short when part of it is not coming" do
      po.update!(status: "ordered", vendor: acme)
      post_to(po, :receive, lines: [{ id: po.lines.first.id, quantity: 1 }])

      post_to(po, :close)
      expect(json_body["data"]).to include("status" => "received")
    end

    it "is cancelled by a manager at any point before it arrives, and by the person who asked while it waits" do
      post_to(po, :cancel, as: colleague)
      expect(response).to have_http_status(:forbidden)

      post_to(po, :cancel, as: technician)
      expect(json_body["data"]).to include("status" => "cancelled")

      other = create(:purchase_order, :ordered, organization: org, requested_by: technician)
      post_to(other, :cancel, as: technician)
      expect(response).to have_http_status(:forbidden)
      post_to(other, :cancel)
      expect(json_body["data"]).to include("status" => "cancelled")
    end
  end

  it "does not let one company reach another's order" do
    foreign = create(:purchase_order)

    post_to(foreign, :approve)

    expect(response).to have_http_status(:not_found)
    expect(foreign.reload.status).to eq("requested")
  end

  describe PurchaseRequestedJob do
    it "tells the other managers, not the person who asked, and nothing once it has been decided" do
      asker = create(:user, :manager, organization: org)
      other = manager
      order = create(:purchase_order, organization: org, requested_by: asker)

      expect { described_class.perform_now(order.id) }.to have_enqueued_mail(PurchaseOrderMailer, :requested).with(other, order).once
      expect(ActionMailer::MailDeliveryJob).not_to have_been_enqueued.with("PurchaseOrderMailer", "requested", "deliver_now",
                                                                           args: [asker, order])

      order.update!(status: "approved")
      expect { described_class.perform_now(order.id) }.not_to have_enqueued_mail(PurchaseOrderMailer, :requested)
    end
  end
end
