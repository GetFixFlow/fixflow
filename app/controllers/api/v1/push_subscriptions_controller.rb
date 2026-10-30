module Api
  module V1
    # The browsers and phones of the signed-in person that are pushed to. Each person manages their own.
    class PushSubscriptionsController < Api::V1::BaseController
      # GET /api/v1/push_subscriptions
      # => { public_key, subscriptions: [{ id, endpoint, device, created_at, last_sent_at }] }. The browser compares the
      # endpoint of its own subscription with these to know whether this device is on.
      def index
        response.set_header("Cache-Control", "no-store")
        render json: { public_key: PushKeys.public_key, subscriptions: current_user.push_subscriptions.order(:created_at).map { |s|
          present(s)
        } }
      end

      # POST /api/v1/push_subscriptions  { subscription: { endpoint, keys: { p256dh, auth } } }
      # (what a browser's PushSubscription.toJSON() gives). A device that was another person's (a shared phone) becomes
      # this person's: it is the same browser.
      def create
        details = subscription_params
        subscription = PushSubscription.find_or_initialize_by(endpoint: details[:endpoint])
        subscription.assign_attributes(user: current_user, p256dh: details.dig(:keys, :p256dh), auth: details.dig(:keys, :auth),
                                       user_agent: PushSubscription.clean_agent(request.user_agent), failures: 0)
        was_new = subscription.new_record?
        subscription.save!
        render json: { subscription: present(subscription) }, status: was_new ? :created : :ok
      end

      # DELETE /api/v1/push_subscriptions?endpoint=...  (turning push off on this device)
      def destroy
        current_user.push_subscriptions.where(endpoint: params.require(:endpoint)).destroy_all
        head :no_content
      end

      # POST /api/v1/push_subscriptions/test: a message to every browser this person has on, and what happened.
      def test
        message = PushNotifier::Message.new(title: "FixFlow notifications are on",
                                            body: "This is a test. You will see messages like it here.",
                                            url: "/settings/notifications", tag: "test")
        result = PushNotifier.new.deliver(current_user, message)
        render json: { sent: result.sent, removed: result.removed, failed: result.failed }
      end

      private

      def subscription_params
        params.expect(subscription: [:endpoint, { keys: %i[p256dh auth] }])
      end

      def present(subscription)
        { id: subscription.id, endpoint: subscription.endpoint, device: subscription.device, created_at: subscription.created_at,
          last_sent_at: subscription.last_sent_at }
      end
    end
  end
end
