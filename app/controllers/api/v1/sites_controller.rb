module Api
  module V1
    # Several sites in one install (see SiteAccess). A site is a top-level location of type "site". Anyone who is not a requester can
    # list the sites they may see; an administrator switches sites on, adds and changes them, and says who works at each.
    class SitesController < Api::V1::BaseController
      before_action :require_technician_or_above!, only: :index
      before_action :require_admin!, except: :index
      before_action :set_site, only: %i[update people]

      # GET /api/v1/sites
      def index
        sites = current_organization.locations.sites.order(:name)
        render json: { enabled: current_organization.sites_enabled?, sites: sites.map { |site| payload(site) },
                       company: company_calendar, my_site_ids: my_site_ids }
      end

      # PUT /api/v1/sites/enabled  { enabled: true|false }
      def enabled
        on = ActiveModel::Type::Boolean.new.cast(params.require(:enabled))
        current_organization.update!(settings: (current_organization.settings || {}).merge("sites_enabled" => on))
        ActivityLogService.log(action: on ? "sites.enabled" : "sites.disabled", resource: current_organization)
        index
      end

      # POST /api/v1/sites  { site: { name, settings: { timezone, work_hours, work_days, holidays } } }
      def create
        site = current_organization.locations.build(name: site_params[:name], location_type: "site")
        own = SiteSettings.clean(site_params[:settings])
        return render_invalid(site, own) unless valid?(site, own)

        site.settings = own
        site.save!
        ActivityLogService.log(action: "site.created", resource: site, metadata: { name: site.name })
        render json: { data: payload(site) }, status: :created
      end

      # PATCH /api/v1/sites/:id  { site: { name, settings } }: a setting left blank follows the company
      def update
        own = site_params.key?(:settings) ? SiteSettings.clean(site_params[:settings]) : @site.settings
        @site.name = site_params[:name] if site_params.key?(:name)
        return render_invalid(@site, own) unless valid?(@site, own)

        @site.settings = own
        @site.save!
        ActivityLogService.log(action: "site.updated", resource: @site, metadata: { name: @site.name })
        render json: { data: payload(@site) }
      end

      # PUT /api/v1/sites/:id/people  { user_ids: [1, 2] }: the people who work at this site (everyone else is unchanged)
      def people
        ids = Array(params[:user_ids]).filter_map { |value| Integer(value, exception: false) }.uniq
        users = current_organization.users.where(id: ids)
        if users.size != ids.size
          return render_error("Some of those people are not in your company", :unprocessable_entity,
code: "VALIDATION_ERROR")
        end
        if users.any?(&:admin?)
          return render_error("Administrators work at every site and are not assigned", :unprocessable_entity,
code: "VALIDATION_ERROR")
        end

        SiteMembership.transaction do
          @site.site_memberships.where.not(user_id: ids).delete_all
          (ids - @site.site_memberships.pluck(:user_id)).each { |id| @site.site_memberships.create!(user_id: id) }
        end
        ActivityLogService.log(action: "site.people_changed", resource: @site, metadata: { name: @site.name, people: ids.size })
        render json: { data: payload(@site) }
      end

      private

      def set_site
        @site = current_organization.locations.sites.find(params[:id])
      end

      def site_params
        params.expect(site: [:name,
                             { settings: [:timezone, { work_hours: %i[start end] }, { work_days: [] },
                                          { holidays: [%i[date name repeating]] }] }])
      end

      def valid?(site, own)
        site.valid? && SiteSettings.new(own).tap(&:validate).errors.none?
      end

      def render_invalid(site, own)
        errors = SiteSettings.new(own).tap(&:validate).errors
        message = site.errors.full_messages.first || errors.full_messages.first
        render_error(message, :unprocessable_entity, code: "VALIDATION_ERROR", details: site.errors.as_json.merge(errors.as_json))
      end

      def my_site_ids
        return [] if current_user.admin?

        SiteMembership.where(user_id: current_user.id).pluck(:site_id)
      end

      def company_calendar
        current_organization.settings_with_defaults.slice(*SiteSettings::KEYS)
      end

      # A site as the Sites screen shows it: what it sets of its own, what is in force, how much is in it, and who works there.
      def payload(site)
        places = site.subtree_ids
        assets = Asset.kept.where(location_id: places)
        {
          id: site.id, name: site.name, settings: (site.settings || {}).slice(*SiteSettings::KEYS), effective: SiteSettings.for(site),
          assets: assets.count, open_work_orders: WorkOrder.open.where(asset_id: assets.select(:id)).count, places: places.size - 1,
          people: people_of(site)
        }
      end

      def people_of(site)
        return [] unless current_user.admin? || current_user.manager?

        site.site_memberships.includes(:user).map { |membership|
          { id: membership.user.id, full_name: membership.user.full_name, role: membership.user.role }
        }
      end
    end
  end
end
