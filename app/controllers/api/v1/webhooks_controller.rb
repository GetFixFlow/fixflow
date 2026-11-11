module Api
  module V1
    # The company's webhooks: where FixFlow sends messages when things happen. Administrators only. A webhook's secret is
    # sent once, when it is made or renewed, and never again.
    class WebhooksController < Api::V1::BaseController
      before_action :require_admin!
      before_action :set_webhook, only: %i[show update destroy rotate_secret test enable]

      # GET /api/v1/webhooks
      def index
        render json: { webhooks: WebhookBlueprint.render_as_hash(current_organization.webhooks.order(:name)),
                       events: Webhooks::EVENTS.map { |key, label| { key: key, label: label } } }
      end

      # GET /api/v1/webhooks/:id: with the latest deliveries.
      def show
        deliveries = @webhook.deliveries.recent.limit(50)
        render json: { webhook: WebhookBlueprint.render_as_hash(@webhook),
                       deliveries: WebhookDeliveryBlueprint.render_as_hash(deliveries) }
      end

      # POST /api/v1/webhooks { webhook: { name, url, events: [...] } }
      def create
        webhook = current_organization.webhooks.new(webhook_params.merge(created_by: current_user))
        webhook.save!
        render json: { webhook: WebhookBlueprint.render_as_hash(webhook), secret: webhook.secret }, status: :created
      end

      # PATCH /api/v1/webhooks/:id
      def update
        @webhook.update!(webhook_params)
        render json: { webhook: WebhookBlueprint.render_as_hash(@webhook) }
      end

      # DELETE /api/v1/webhooks/:id
      def destroy
        @webhook.destroy!
        head :no_content
      end

      # POST /api/v1/webhooks/:id/rotate_secret
      def rotate_secret
        secret = @webhook.rotate_secret!
        ActivityLogService.log(action: "webhook.secret_renewed", resource: @webhook)
        render json: { webhook: WebhookBlueprint.render_as_hash(@webhook), secret: secret }
      end

      # POST /api/v1/webhooks/:id/enable: switched on again after it was switched off for failing.
      def enable
        @webhook.enable!
        render json: { webhook: WebhookBlueprint.render_as_hash(@webhook) }
      end

      # POST /api/v1/webhooks/:id/test: sends a test message now and answers with what the receiver said.
      def test
        delivery = Webhooks.ping(@webhook)
        WebhookDeliveryJob.perform_now(delivery.id)
        render json: { delivery: WebhookDeliveryBlueprint.render_as_hash(delivery.reload) }
      end

      # POST /api/v1/webhooks/deliveries/:id/redeliver: the same message again, as a new delivery (the receiver sees the same
      # event id, so it can tell it is one it has had).
      def redeliver
        old = current_organization.webhook_deliveries.find(params[:id])
        delivery = old.webhook.deliveries.create!(organization: current_organization, event: old.event, event_id: old.event_id,
payload: old.payload)
        WebhookDeliveryJob.perform_later(delivery.id)
        render json: { delivery: WebhookDeliveryBlueprint.render_as_hash(delivery) }, status: :created
      end

      private

      def set_webhook
        @webhook = current_organization.webhooks.find(params[:id])
      end

      def webhook_params
        params.expect(webhook: [:name, :url, :active, { events: [] }])
      end
    end
  end
end
