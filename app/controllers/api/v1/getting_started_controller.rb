module Api
  module V1
    # The few things worth doing first, ticked off from what is really in the install (sample data does not
    # count). Shown to the administrator on the dashboard until they are done or dismissed.
    class GettingStartedController < Api::V1::BaseController
      before_action :require_admin!

      # GET /api/v1/getting_started
      def show
        render json: payload
      end

      # POST /api/v1/getting_started/dismiss
      def dismiss
        current_organization.dismiss_getting_started!
        render json: payload
      end

      private

      def payload
        org = current_organization
        steps = [
          step("assets", "Add your equipment", "Add an asset, or import a spreadsheet of them.", real_assets?(org), "/assets/new"),
          step("work_order", "Create a work order", "Log a job, assign it, and follow it to completion.", real_work_orders?(org),
"/work-orders/new"),
          step("team", "Invite your team", "Technicians, managers and requesters each see what they need.", org.users.many?,
"/settings/users")
        ]
        { steps: steps, all_done: steps.all? { |s| s[:done] }, dismissed: org.getting_started_dismissed?,
          sample_loaded: SampleDataService.loaded?(org) }
      end

      def step(key, title, description, done, path)
        { key: key, title: title, description: description, done: done, path: path }
      end

      def real_assets?(org) = org.assets.where.not(id: SampleRecord.ids_of("Asset", org)).exists?
      def real_work_orders?(org) = org.work_orders.where.not(id: SampleRecord.ids_of("WorkOrder", org)).exists?
    end
  end
end
