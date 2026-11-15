require "rails_helper"

# A person who works at one site must not read what happened at another through the audit log, the dashboard's recent activity,
# or a report emailed to them (security review before 1.0).
# rubocop:disable RSpec/MultipleMemoizedHelpers -- a company with two sites, what happened at each, and who may read it
RSpec.describe "Sites and what people can read about other sites", type: :request do
  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:north)   { create(:location, organization: org, name: "North", location_type: "site") }
  let(:south)   { create(:location, organization: org, name: "South", location_type: "site") }
  let(:north_manager) { create(:user, :manager, organization: org, first_name: "Nora", last_name: "North") }
  let(:roaming_manager) { create(:user, :manager, organization: org, first_name: "Rae", last_name: "Roamer") }
  let(:north_hall) { create(:location, organization: org, parent: north, location_type: "building") }
  let(:south_hall) { create(:location, organization: org, parent: south, location_type: "building") }
  let!(:north_asset) { create(:asset, organization: org, location: north_hall, name: "North pump") }
  let!(:south_asset) { create(:asset, organization: org, location: south_hall, name: "South pump") }

  before do
    org.update!(settings: org.settings.merge("sites_enabled" => true))
    SiteMembership.create!(user: north_manager, site: north)
    ActivityLog.delete_all
    [north_asset, south_asset].each do |asset|
      ActivityLog.create!(organization: org, user: admin, action: "asset.updated", resource_type: "Asset", resource_id: asset.id,
                          resource_name: asset.name)
    end
    ActivityLog.create!(organization: org, user: admin, action: "organization_settings.updated", resource_type: "Organization",
                        resource_id: org.id, resource_name: "Acme")
  end

  def names_in_log(person)
    get "/api/v1/activity_logs", headers: auth_headers_for(person)
    json_body["activity_logs"].pluck("resource_name")
  end

  it "shows a person at one site the audit log without the other site's records, and an administrator everything" do
    expect(names_in_log(north_manager)).to include("North pump", "Acme")
    expect(names_in_log(north_manager)).not_to include("South pump")
    expect(names_in_log(admin)).to include("North pump", "South pump", "Acme")
  end

  it "does the same for the export" do
    get "/api/v1/activity_logs.csv", headers: auth_headers_for(north_manager)

    expect(response.body).to include("North pump")
    expect(response.body).not_to include("South pump")
  end

  it "does the same for the dashboard's recent activity" do
    get "/api/v1/dashboard", headers: auth_headers_for(north_manager)
    texts = json_body.fetch("recent_activity").pluck("description")

    expect(texts).to include("North pump")
    expect(texts).not_to include("South pump")
  end

  describe "a purchase order" do
    let(:belt_north) { create(:part, organization: org, location: north_hall, name: "North belt") }
    let(:belt_south) { create(:part, organization: org, location: south_hall, name: "South belt") }

    def order_with(part, person)
      post "/api/v1/purchase_orders", params: { purchase_order: { reason: "Restock" }, lines: [{ part_id: part.id, quantity: 2 }] },
                                      headers: auth_headers_for(person), as: :json
    end

    it "cannot include a part kept at a site the person does not work at" do
      order_with(belt_south, north_manager)

      expect(response).to have_http_status(:not_found)
      expect(PurchaseOrder.count).to eq(0)
    end

    it "can include a part at their own site" do
      order_with(belt_north, north_manager)

      expect(response).to have_http_status(:created)
    end
  end

  describe "a report saved by an administrator, who sees every site" do
    it "cannot be emailed to a person who works at one site only" do
      report = build(:saved_report, organization: org, user: admin, recipient_ids: [north_manager.id, roaming_manager.id], send_on: 1)

      expect(report).not_to be_valid
      expect(report.errors[:recipient_ids].join).to include("Nora North")
      expect(report.errors[:recipient_ids].join).not_to include("Rae Roamer")
    end

    it "is not sent to such a person even if they were added before sites were set up" do
      report = create(:saved_report, organization: org, user: admin, recipient_ids: [roaming_manager.id], send_on: 1)
      report.recipient_ids = [north_manager.id, roaming_manager.id] # as saved before sites existed
      report.save!(validate: false)

      expect(report.people_to_email).to contain_exactly(roaming_manager)
    end

    it "is not offered to a person at one site in the list of people to email it to" do
      roaming_manager
      get "/api/v1/saved_reports", headers: auth_headers_for(admin)

      ids = json_body["eligible_recipients"].pluck("id")
      expect(ids).to include(roaming_manager.id)
      expect(ids).not_to include(north_manager.id)
    end
  end

  it "lets a person at one site email a report they made to colleagues at the same site" do
    north_peer = create(:user, :manager, organization: org)
    SiteMembership.create!(user: north_peer, site: north)

    report = build(:saved_report, organization: org, user: north_manager, recipient_ids: [north_peer.id], send_on: 1)

    expect(report).to be_valid
  end
end
# rubocop:enable RSpec/MultipleMemoizedHelpers
