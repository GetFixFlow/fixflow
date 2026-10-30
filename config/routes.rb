Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # ActionCable
  mount ActionCable.server => "/cable"

  devise_for :users,
    path: "api/v1/auth",
    skip: :passwords, # forgot and reset password are Api::V1::Auth::PasswordsController, below
    path_names: { sign_in: "sign_in", sign_out: "sign_out", registration: "sign_up" },
    controllers: {
      sessions: "api/v1/auth/sessions",
      registrations: "api/v1/auth/registrations"
    }

  # The second step of signing in for a person with two-factor sign-in on (the first, sign_in, answers with a challenge)
  devise_scope :user do
    post "api/v1/auth/two_factor", to: "api/v1/auth/two_factor_sessions#create"
  end

  namespace :api do
    namespace :v1 do
      get "auth/me", to: "auth/profile#show"

      # Where the signed-in person is signed in, and ending one of those sessions
      delete "sessions/all", to: "user_sessions#destroy_all"
      resources :sessions, only: %i[index destroy], controller: "user_sessions"

      # Forgot password (public): ask for a link, then use it to choose a new password
      post  "auth/password", to: "auth/passwords#create"
      match "auth/password", to: "auth/passwords#update", via: %i[put patch]

      # Company settings: anyone signed in can read them, only admins change them
      resource :organization_settings, only: %i[show update], controller: "organization_settings"
      resource :branding, only: %i[show update], controller: "branding"
      resource :notification_preferences, only: %i[show update], controller: "notification_preferences"
      resource :localization_settings, only: %i[show update], controller: "localization_settings"

      # Push notifications to this person's browsers (Web Push): the server's public key and the browsers subscribed, a
      # browser subscribing or stopping, and a test message
      get    "push_subscriptions",      to: "push_subscriptions#index"
      post   "push_subscriptions",      to: "push_subscriptions#create"
      delete "push_subscriptions",      to: "push_subscriptions#destroy"
      post   "push_subscriptions/test", to: "push_subscriptions#test"

      # Example data to look around in, and the first things to do
      resource :sample_data, only: %i[show create destroy], controller: "sample_data"
      get  "getting_started",         to: "getting_started#show"
      post "getting_started/dismiss", to: "getting_started#dismiss"

      # Bring assets, locations or parts in from a CSV file
      get  "imports/:kind/template", to: "imports#template"
      post "imports/:kind/preview",  to: "imports#preview"
      post "imports/:kind",          to: "imports#create"
      resource :email_settings, only: %i[show update destroy], controller: "email_settings" do
        post :test
      end

      # Where chat messages (Slack, Teams...) go
      resource :chat_settings, only: %i[show update destroy], controller: "chat_settings" do
        post :test
      end

      # The signed-in user's own details and password
      resource :profile, only: %i[show update], controller: "profile" do
        patch :password
      end
      # Two-factor sign-in with an authenticator app: set it up, switch it off, get new recovery codes
      resource :two_factor, path: "profile/two_factor", only: %i[show create destroy], controller: "two_factor" do
        post :confirm
        post :recovery_codes
      end
      get "health",  to: "health#show"
      get "system_health", to: "system_health#show"
      get "data_usage", to: "data_usage#show"
      get "backups", to: "backups#index"
      # `format: false`: the name ends in .sql.gz, which Rails would otherwise take for a format.
      get "backups/:name/download", to: "backups#download", format: false, constraints: { name: %r{[^/]+} }
      get "setup/status", to: "setup#status"

      resources :locations do
        collection { get :tree }
      end

      resources :assets do
        member do
          get  :work_orders
          get  :sensor_readings
          get  :iot_rules
          get  :iot_alerts
          get  :history
          post :qr_code
        end
        resources :meters, only: %i[index create]
      end

      # Meters (running hours, kilometres, cycles) and their readings
      resources :meters, only: %i[update destroy] do
        resources :readings, only: %i[index create], controller: "meter_readings"
      end

      resources :work_orders do
        member do
          patch :assign
          patch :start
          patch :complete
          patch :verify
          patch :reject
          patch :hold
          patch :cancel
          patch :transition
        end
        resources :comments,    only: %i[index create destroy]
        resources :attachments, only: %i[index create destroy]
        resources :parts, only: %i[index create destroy], controller: "work_order_parts"
        collection do
          get :overdue
          get :unassigned
        end
      end

      # Public, no account: report a problem (from an asset's QR label) and follow it with a link
      resources :work_requests, only: %i[create show], param: :token
      get "public_assets/:code", to: "work_requests#asset"
      get "public_request_form", to: "work_requests#form"

      resources :preventive_maintenances do
        collection { get :dashboard }
        member do
          patch :pause
          patch :resume
          patch :trigger
          get   :preview
        end
        resources :executions, only: %i[index], controller: "pm_executions" do
          member { patch :skip }
        end
      end

      resources :parts do
        member     { patch :adjust_stock }
        collection { get :low_stock }
      end

      # ── IoT data ingestion (API key auth) ─────────────────────────────────
      post "iot/ingest",              to: "iot#ingest"

      # ── IoT data retrieval (JWT auth) ─────────────────────────────────────
      get "iot/assets/:id/readings",  to: "iot#readings",  as: :iot_asset_readings
      get "iot/assets/:id/latest",    to: "iot#latest",    as: :iot_asset_latest

      # ── IoT alerts ────────────────────────────────────────────────────────
      resources :iot_alerts, only: %i[index show] do
        collection do
          patch :bulk_acknowledge
          patch :bulk_resolve
        end
        member do
          patch :acknowledge
          patch :resolve
          patch :suppress
        end
      end

      # ── IoT rules management ──────────────────────────────────────────────
      resources :iot_rules do
        member do
          patch :pause
          patch :resume
          patch :archive
          post  :duplicate
          post  :test
        end
      end

      # ── API key management (admin only) ───────────────────────────────────
      resources :api_keys, only: %i[index create destroy]

      resources :users, only: %i[index show update destroy] do
        collection do
          get   :me
          post  :invite
          patch :bulk_role
          patch :bulk_deactivate
        end
        member do
          post  :resend_invitation
          post  :reset_password
          post  :reset_two_factor
          post  :unlock
          patch :deactivate
          patch :reactivate
          patch :role
        end
      end

      # Public: look up and accept an invitation by its emailed token
      get  "invitations/:token",        to: "invitations#show",   as: :invitation
      post "invitations/:token/accept", to: "invitations#accept", as: :accept_invitation

      # ── Dashboard ─────────────────────────────────────────────────────────
      get "dashboard", to: "dashboard#index"

      # ── Reports ───────────────────────────────────────────────────────────
      namespace :reports do
        get "work_orders/summary",                to: "work_orders#summary"
        get "work_orders/mttr",                   to: "work_orders#mttr"
        get "work_orders/backlog",                to: "work_orders#backlog"
        get "work_orders/technician_performance", to: "work_orders#technician_performance"

        get "costs/summary",                      to: "costs#summary"
        get "costs/by_asset",                     to: "costs#by_asset"
        get "costs/by_location",                  to: "costs#by_location"

        get "assets/health",                      to: "assets#health"
        get "assets/cost_analysis",               to: "assets#cost_analysis"
        get "assets/:id/history",                 to: "assets#history", as: :asset_history

        get "pm/compliance",                      to: "pm#compliance"
        get "pm/schedule_forecast",               to: "pm#schedule_forecast"

        get "iot/dashboard",                      to: "iot#dashboard"
        get "iot/alerts",                         to: "iot#alerts"
        get "iot/rule_effectiveness",             to: "iot#rule_effectiveness"
        get "iot/alert_summary",                  to: "iot#alert_summary"
        get "iot/sensor_trends",                  to: "iot#sensor_trends"
      end

      # ── AI ────────────────────────────────────────────────────────────────
      namespace :ai do
        get "config", to: "config#show"
        post "assist", to: "assist#create"
      end

      # ── Activity logs ─────────────────────────────────────────────────────
      resources :activity_logs, only: [:index]
    end
  end
end
