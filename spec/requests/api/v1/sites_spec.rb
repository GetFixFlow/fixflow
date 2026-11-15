require "rails_helper"

# rubocop:disable RSpec/MultipleMemoizedHelpers, RSpec/NestedGroups, RSpec/LetSetup -- a company with two sites, their places, assets and people

RSpec.describe "Sites", type: :request do
  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:north)   { create(:location, organization: org, name: "North", location_type: "site") }
  let(:south)   { create(:location, organization: org, name: "South", location_type: "site") }
  let(:north_hall) { create(:location, organization: org, name: "North hall", location_type: "building", parent: north) }
  let(:south_hall) { create(:location, organization: org, name: "South hall", location_type: "building", parent: south) }
  let(:north_tech) { create(:user, organization: org, first_name: "Nora", last_name: "North") }
  let(:roamer)     { create(:user, organization: org, first_name: "Rae", last_name: "Roamer") }

  def as(user) = auth_headers_for(user)
  def json_put(path, body, user) = put(path, params: body.to_json, headers: as(user).merge("Content-Type" => "application/json"))
  def json_patch(path, body, user) = patch(path, params: body.to_json, headers: as(user).merge("Content-Type" => "application/json"))
  def json_post(path, body, user) = post(path, params: body.to_json, headers: as(user).merge("Content-Type" => "application/json"))
  def switch_on = org.update!(settings: org.settings.merge("sites_enabled" => true))
  def names(key) = json_body[key].pluck("name")

  before { SiteMembership.create!(user: north_tech, site: north) }

  describe "GET /api/v1/sites" do
    it "needs a sign-in, and is not for a requester" do
      get "/api/v1/sites"
      expect(response).to have_http_status(:unauthorized)

      get "/api/v1/sites", headers: as(create(:user, :requester, organization: org))
      expect(response).to have_http_status(:forbidden)
    end

    it "says sites are off until an administrator switches them on, and lists the sites with what is in them" do
      north_hall
      create(:asset, organization: org, location: north_hall)
      create(:asset, organization: org, location: north_hall).discard
      create(:work_order, organization: org, asset: Asset.first, status: "open")
      south

      get "/api/v1/sites", headers: as(admin)

      expect(response).to have_http_status(:ok)
      expect(json_body["enabled"]).to be(false)
      expect(json_body["sites"].pluck("name")).to eq(%w[North South])
      expect(json_body["sites"].first).to include("assets" => 1, "open_work_orders" => 1, "places" => 1)
      expect(json_body["sites"].first["people"]).to eq([{ "id" => north_tech.id, "full_name" => "Nora North", "role" => "technician" }])
    end

    it "shows the company's calendar, and what each site sets of its own and what is in force there" do
      org.update!(settings: org.settings.merge("timezone" => "America/New_York",
"work_hours" => { "start" => "08:00", "end" => "17:00" }))
      north.update!(settings: { "timezone" => "Asia/Colombo" })

      get "/api/v1/sites", headers: as(admin)

      north_json = json_body["sites"].first
      expect(north_json["settings"]).to eq("timezone" => "Asia/Colombo")
      expect(north_json["effective"]).to include("timezone" => "Asia/Colombo", "work_hours" => { "start" => "08:00", "end" => "17:00" })
      expect(json_body["company"]).to include("timezone" => "America/New_York")
    end

    it "does not tell a technician who works where" do
      north

      get "/api/v1/sites", headers: as(north_tech)

      expect(json_body["sites"].first["people"]).to eq([])
    end

    it "shows a person who works at some sites only those, once sites are on, and says which are theirs" do
      north
      south
      switch_on

      get "/api/v1/sites", headers: as(north_tech)

      expect(json_body["sites"].pluck("name")).to eq(["North"])
      expect(json_body["my_site_ids"]).to eq([north.id])
    end

    it "shows everything to a person at no site, and to an administrator, with sites on" do
      north
      south
      switch_on

      get "/api/v1/sites", headers: as(roamer)
      expect(json_body["sites"].pluck("name")).to eq(%w[North South])
      get "/api/v1/sites", headers: as(admin)
      expect(json_body["sites"].pluck("name")).to eq(%w[North South])
    end

    it "does not show another company's sites" do
      create(:location, name: "Elsewhere", location_type: "site")
      north

      get "/api/v1/sites", headers: as(admin)

      expect(json_body["sites"].pluck("name")).to eq(["North"])
    end

    it "gives an administrator no site ids of their own, even when they are listed at a site" do
      SiteMembership.create!(user: admin, site: north)

      get "/api/v1/sites", headers: as(admin)

      expect(json_body["my_site_ids"]).to eq([])
    end

    it "lists only top-level places of type site, not the buildings in them, a yard, or a place of that type inside a site" do
      create(:location, organization: org, name: "Inner", location_type: "site", parent: north)
      north_hall
      create(:location, organization: org, name: "Yard", location_type: "outdoor")
      north

      get "/api/v1/sites", headers: as(admin)

      expect(json_body["sites"].pluck("name")).to eq(["North"])
    end
  end

  describe "PUT /api/v1/sites/enabled" do
    it "is the administrator's alone, and switches sites on and off, leaving a line in the audit log" do
      json_put("/api/v1/sites/enabled", { enabled: true }, manager)
      expect(response).to have_http_status(:forbidden)
      expect(org.reload.sites_enabled?).to be(false)

      json_put("/api/v1/sites/enabled", { enabled: true }, admin)
      expect(response).to have_http_status(:ok)
      expect(json_body["enabled"]).to be(true)
      expect(org.reload.sites_enabled?).to be(true)
      expect(ActivityLog.where(action: "sites.enabled")).to exist

      json_put("/api/v1/sites/enabled", { enabled: "false" }, admin)
      expect(org.reload.sites_enabled?).to be(false)
      expect(ActivityLog.where(action: "sites.disabled")).to exist
    end
  end

  describe "POST /api/v1/sites" do
    it "adds a site, a top-level place of type site, with its own calendar" do
      settings = { timezone: "Asia/Colombo", work_hours: { start: "07:00", end: "15:30" }, work_days: %w[1 2 3 4 5 6],
                   holidays: [{ date: "2026-12-25", name: "Christmas", repeating: true }] }
      json_post("/api/v1/sites", { site: { name: "East", settings: settings } }, admin)

      expect(response).to have_http_status(:created)
      site = Location.sites.find_by!(name: "East")
      expect(site).to have_attributes(location_type: "site", ancestry: nil)
      expect(site.settings).to include("timezone" => "Asia/Colombo", "work_hours" => { "start" => "07:00", "end" => "15:30" },
"work_days" => [1, 2, 3, 4, 5, 6])
      expect(site.settings["holidays"]).to eq([{ "date" => "2026-12-25", "name" => "Christmas", "repeating" => true }])
      expect(ActivityLog.where(action: "site.created")).to exist
    end

    it "is the administrator's alone" do
      json_post("/api/v1/sites", { site: { name: "East" } }, manager)

      expect(response).to have_http_status(:forbidden)
    end

    it "refuses a site with no name or a setting that is not valid, in words, and saves nothing" do
      [{ name: "" }, { name: "East", settings: { timezone: "Mars/Olympus" } },
       { name: "East", settings: { work_hours: { start: "17:00", end: "08:00" } } }, { name: "East", settings: { work_days: %w[9] } },
       { name: "East", settings: { holidays: [{ date: "tomorrow", name: "X" }] } }].each do |body|
        json_post("/api/v1/sites", { site: body }, admin)
        expect(response).to have_http_status(:unprocessable_entity)
      end
      expect(Location.pluck(:name)).to eq(["North"]) # only the one made for the background
    end

    it "keeps only a site's own settings, and a blank one follows the company" do
      json_post("/api/v1/sites", { site: { name: "East", settings: { timezone: "", currency: "EUR", work_days: [] } } }, admin)

      expect(Location.sites.find_by!(name: "East").settings).to eq({})
    end
  end

  describe "PATCH /api/v1/sites/:id" do
    it "renames a site and changes its calendar, and a setting left blank goes back to following the company" do
      north.update!(settings: { "timezone" => "Asia/Colombo", "work_days" => [1, 2] })

      json_patch("/api/v1/sites/#{north.id}", { site: { name: "North plant", settings: { timezone: "", work_days: %w[1 2 3] } } },
admin)

      expect(response).to have_http_status(:ok)
      expect(north.reload).to have_attributes(name: "North plant", settings: { "work_days" => [1, 2, 3] })
      expect(ActivityLog.where(action: "site.updated")).to exist
    end

    it "leaves the settings alone when only the name is sent" do
      north.update!(settings: { "timezone" => "Asia/Colombo" })

      json_patch("/api/v1/sites/#{north.id}", { site: { name: "North plant" } }, admin)

      expect(north.reload.settings).to eq("timezone" => "Asia/Colombo")
    end

    it "refuses what is not valid, and does not change a place that is not a site" do
      json_patch("/api/v1/sites/#{north.id}", { site: { settings: { timezone: "Mars/Olympus" } } }, admin)
      expect(response).to have_http_status(:unprocessable_entity)

      json_patch("/api/v1/sites/#{north_hall.id}", { site: { name: "Hall" } }, admin)
      expect(response).to have_http_status(:not_found)
    end

    it "is the administrator's alone" do
      json_patch("/api/v1/sites/#{north.id}", { site: { name: "X" } }, manager)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "a site of another company" do
    it "is not found to change or to put people on, and is left as it was" do
      elsewhere = create(:location, name: "Elsewhere", location_type: "site")

      json_patch("/api/v1/sites/#{elsewhere.id}", { site: { name: "Mine now" } }, admin)
      expect(response).to have_http_status(:not_found)
      json_put("/api/v1/sites/#{elsewhere.id}/people", { user_ids: [north_tech.id] }, admin)
      expect(response).to have_http_status(:not_found)
      expect(elsewhere.reload.name).to eq("Elsewhere")
      expect(elsewhere.site_memberships).to be_empty
    end
  end

  describe "PUT /api/v1/sites/:id/people" do
    it "says who works at a site: adds some, removes the rest, and leaves their other sites alone" do
      SiteMembership.create!(user: roamer, site: south)

      json_put("/api/v1/sites/#{north.id}/people", { user_ids: [roamer.id, manager.id] }, admin)

      expect(response).to have_http_status(:ok)
      expect(north.site_memberships.pluck(:user_id)).to contain_exactly(roamer.id, manager.id)
      expect(south.site_memberships.pluck(:user_id)).to eq([roamer.id])
      expect(json_body["data"]["people"].pluck("full_name")).to include("Rae Roamer")
      expect(ActivityLog.where(action: "site.people_changed")).to exist
    end

    it "can empty a site" do
      json_put("/api/v1/sites/#{north.id}/people", { user_ids: [] }, admin)

      expect(north.site_memberships.count).to eq(0)
    end

    it "refuses an administrator (they work at every site), someone from another company, and a manager asking" do
      json_put("/api/v1/sites/#{north.id}/people", { user_ids: [admin.id] }, admin)
      expect(response).to have_http_status(:unprocessable_entity)
      json_put("/api/v1/sites/#{north.id}/people", { user_ids: [create(:user).id] }, admin)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("not in your company")
      json_put("/api/v1/sites/#{north.id}/people", { user_ids: [] }, manager)
      expect(response).to have_http_status(:forbidden)
      expect(north.site_memberships.pluck(:user_id)).to eq([north_tech.id])
    end
  end

  describe "who sees what, once sites are on" do
    let!(:north_asset) { create(:asset, organization: org, name: "North pump", location: north_hall) }
    let!(:south_asset) { create(:asset, organization: org, name: "South pump", location: south_hall) }
    let!(:yard_asset)  { create(:asset, organization: org, name: "Yard pump") }
    let!(:north_order) { create(:work_order, organization: org, asset: north_asset, title: "North job") }
    let!(:south_order) { create(:work_order, organization: org, asset: south_asset, title: "South job") }

    def asset_names = json_body["assets"].pluck("name")
    def order_titles = json_body["work_orders"].pluck("title")

    it "changes nothing while sites are off" do
      get "/api/v1/assets", headers: as(north_tech)

      expect(asset_names).to contain_exactly("North pump", "South pump", "Yard pump")
    end

    context "with sites on" do
      before { switch_on }

      it "lists a technician at the north site only the north site's assets, and the shared ones" do
        get "/api/v1/assets", headers: as(north_tech)

        expect(asset_names).to contain_exactly("North pump", "Yard pump")
      end

      it "lists everything to a person at no site, to a manager at none, and to an administrator" do
        [roamer, manager, admin].each do |person|
          get "/api/v1/assets", headers: as(person)
          expect(asset_names).to contain_exactly("North pump", "South pump", "Yard pump")
        end
      end

      it "does not find another site's asset, work order or place by its number: not found, as if it were not there" do
        get "/api/v1/assets/#{south_asset.id}", headers: as(north_tech)
        expect(response).to have_http_status(:not_found)
        get "/api/v1/work_orders/#{south_order.id}", headers: as(north_tech)
        expect(response).to have_http_status(:not_found)
        get "/api/v1/locations/#{south_hall.id}", headers: as(north_tech)
        expect(response).to have_http_status(:not_found)
        get "/api/v1/assets/#{north_asset.id}", headers: as(north_tech)
        expect(response).to have_http_status(:ok)
      end

      it "lists the work orders of the person's own site only" do
        get "/api/v1/work_orders", headers: as(north_tech)

        expect(order_titles).to eq(["North job"])
      end

      it "shows the place tree without the other sites" do
        get "/api/v1/locations", headers: as(north_tech)

        expect(json_body["locations"].pluck("name")).to eq(["North"])
      end

      it "cannot make a work order for another site's asset, move an asset to another site, or change another site's work order" do
        json_post("/api/v1/work_orders", { work_order: { title: "Sneaky job", asset_id: south_asset.id, priority: "low" } }, north_tech)
        expect(response).to have_http_status(:unprocessable_entity)
        expect(WorkOrder.unscoped.where(title: "Sneaky job")).not_to exist

        json_patch("/api/v1/assets/#{north_asset.id}", { asset: { location_id: south_hall.id } }, manager.tap { |m|
          SiteMembership.create!(user: m, site: north)
        })
        expect(response).to have_http_status(:unprocessable_entity)
        expect(north_asset.reload.location_id).to eq(north_hall.id)

        json_patch("/api/v1/work_orders/#{south_order.id}", { work_order: { title: "Changed" } }, north_tech)
        expect(response).to have_http_status(:not_found)
        expect(south_order.reload.title).to eq("South job")
      end

      it "can make a work order for its own site's asset" do
        json_post("/api/v1/work_orders", { work_order: { title: "Fix the north pump", asset_id: north_asset.id, priority: "low" } },
north_tech)

        expect(response).to have_http_status(:created)
      end

      describe "parts, which are stocked at a place" do
        let!(:north_part)  {
          create(:part, organization: org, name: "North belt", location: north_hall, quantity_on_hand: 1, reorder_point: 5)
        }
        let!(:south_part)  {
          create(:part, organization: org, name: "South belt", location: south_hall, quantity_on_hand: 1, reorder_point: 5)
        }
        let!(:loose_part)  { create(:part, organization: org, name: "Loose belt", quantity_on_hand: 1, reorder_point: 5) }
        let(:north_manager) {
          create(:user, :manager, organization: org).tap { |person|
            SiteMembership.create!(user: person, site: north)
          }
        }

        it "lists the stock of the person's site and of no site, not the other site's, and everything to a person at no site" do
          get "/api/v1/parts", headers: as(north_manager)
          expect(json_body["parts"].pluck("name")).to contain_exactly("North belt", "Loose belt")
          get "/api/v1/parts/low_stock", headers: as(north_manager)
          expect(json_body["parts"].pluck("name")).to contain_exactly("North belt", "Loose belt")
          get "/api/v1/parts", headers: as(roamer)
          expect(json_body["parts"].pluck("name")).to contain_exactly("North belt", "South belt", "Loose belt")
        end

        it "does not find another site's part by its number, nor let it be used on a work order, nor let one be stocked there" do
          get "/api/v1/parts/#{south_part.id}", headers: as(north_manager)
          expect(response).to have_http_status(:not_found)

          json_post("/api/v1/work_orders/#{north_order.id}/parts", { part: { part_id: south_part.id, quantity_used: 1 } },
north_manager)
          expect(response).to have_http_status(:not_found)
          expect(south_part.reload.quantity_on_hand).to eq(1)

          json_post("/api/v1/parts", { part: { name: "Sneaky", location_id: south_hall.id } }, north_manager)
          expect(response).to have_http_status(:unprocessable_entity)
        end

        it "can use its own site's part" do
          json_post("/api/v1/work_orders/#{north_order.id}/parts", { part: { part_id: north_part.id, quantity_used: 1 } },
north_manager)

          expect(response).to have_http_status(:created)
        end
      end

      it "shows a person at both sites both" do
        SiteMembership.create!(user: north_tech, site: south)

        get "/api/v1/assets", headers: as(north_tech)

        expect(asset_names).to contain_exactly("North pump", "South pump", "Yard pump")
      end

      it "stops hiding when sites are switched off again" do
        org.update!(settings: org.settings.merge("sites_enabled" => false))

        get "/api/v1/assets", headers: as(north_tech)

        expect(asset_names).to contain_exactly("North pump", "South pump", "Yard pump")
      end

      it "does not tell a person at one site about another site's work through the dashboard counts" do
        get "/api/v1/dashboard", headers: as(north_tech)

        expect(response.body).not_to include("South job")
        expect(response.body).not_to include("South pump")
      end
    end
  end

  describe "adding and changing sites through the places screen, once sites are on" do
    before { switch_on }

    it "keeps adding, changing and removing a site for an administrator, but lets a manager add a building inside a site" do
      json_post("/api/v1/locations", { location: { name: "New site", location_type: "site" } }, manager)
      expect(response).to have_http_status(:forbidden)
      expect(json_body.dig("error", "code")).to eq("SITE_ADMIN_ONLY")

      json_post("/api/v1/locations", { location: { name: "Annex", location_type: "building", parent_id: north.id } }, manager)
      expect(response).to have_http_status(:created)

      json_patch("/api/v1/locations/#{north.id}", { location: { location_type: "building" } }, manager)
      expect(response).to have_http_status(:forbidden)
      json_patch("/api/v1/locations/#{north.id}", { location: { name: "Renamed" } }, manager)
      expect(response).to have_http_status(:forbidden)

      json_post("/api/v1/locations", { location: { name: "New site", location_type: "site" } }, admin)
      expect(response).to have_http_status(:created)
    end

    it "keeps removing a site for an administrator only" do
      south
      delete "/api/v1/locations/#{south.id}", headers: as(manager)
      expect(response).to have_http_status(:forbidden)
      expect(Location.exists?(south.id)).to be(true)

      delete "/api/v1/locations/#{south.id}", headers: as(admin)
      expect(response).to have_http_status(:no_content)
      expect(Location.exists?(south.id)).to be(false)
    end

    it "does not count a place of type site inside another place as a site: a manager may add one" do
      json_post("/api/v1/locations", { location: { name: "Inner", location_type: "site", parent_id: north.id } }, manager)

      expect(response).to have_http_status(:created)
    end

    it "does not let a manager make a building a site by taking it out of its parent" do
      json_patch("/api/v1/locations/#{north_hall.id}", { location: { parent_id: "", location_type: "site" } }, manager)

      expect(response).to have_http_status(:forbidden)
    end

    it "is as before while sites are off" do
      org.update!(settings: org.settings.merge("sites_enabled" => false))

      json_post("/api/v1/locations", { location: { name: "New site", location_type: "site" } }, manager)

      expect(response).to have_http_status(:created)
    end
  end

  describe "the schedule of one site" do
    let(:schedule_params) { { from: "2026-11-02", to: "2026-11-08", site_id: north.id } }

    before do
      north.update!(settings: { "work_hours" => { "start" => "06:00", "end" => "12:00" }, "work_days" => [1, 2, 3, 4, 5, 6],
                                "holidays" => [{ "date" => "2026-11-03", "name" => "North day", "repeating" => false }] })
      due = Time.zone.parse("2026-11-04 10:00")
      create(:work_order, organization: org, asset: create(:asset, organization: org, location: north_hall), title: "North job",
                          due_date: due, assignee: north_tech)
      create(:work_order, organization: org, asset: create(:asset, organization: org, location: south_hall), title: "South job",
                          due_date: due)
      roamer
      SiteMembership.create!(user: create(:user, organization: org, first_name: "Sol", last_name: "South"), site: south)
    end

    it "uses the site's own calendar and work" do
      get "/api/v1/schedule", params: schedule_params, headers: as(manager)

      data = json_body["data"]
      expect(data["days"].find { |day| day["date"] == "2026-11-03" }).to include("working" => false, "holiday" => "North day")
      expect(data["days"].find { |day| day["date"] == "2026-11-07" }).to include("working" => true, "hours" => 6.0)
      expect(data["work_orders"].pluck("title")).to eq(["North job"])
    end

    it "lists the people who work at the site or at no site, and not those at another" do
      get "/api/v1/schedule", params: schedule_params, headers: as(manager)

      expect(json_body["data"]["technicians"].pluck("name")).to contain_exactly("Nora North", "Rae Roamer")
    end

    it "is the company's calendar and all its work without a site" do
      get "/api/v1/schedule", params: { from: "2026-11-02", to: "2026-11-08" }, headers: as(manager)

      expect(response).to have_http_status(:ok)
    end

    it "does not find a site that is not one of the person's, with sites on" do
      switch_on
      SiteMembership.create!(user: manager, site: north)
      south

      get "/api/v1/schedule", params: { from: "2026-11-02", to: "2026-11-08", site_id: south.id }, headers: as(manager)

      expect(response).to have_http_status(:not_found)
    end
  end
end
# rubocop:enable RSpec/MultipleMemoizedHelpers, RSpec/NestedGroups, RSpec/LetSetup
