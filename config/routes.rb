Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # ActionCable
  mount ActionCable.server => "/cable"

  devise_for :users,
    path: "api/v1/auth",
    path_names: { sign_in: "sign_in", sign_out: "sign_out", registration: "sign_up" },
    controllers: {
      sessions: "api/v1/auth/sessions",
      registrations: "api/v1/auth/registrations"
    }

  namespace :api do
    namespace :v1 do
      get "auth/me", to: "auth/profile#show"
      get "health",  to: "health#show"

      resources :organizations, only: %i[show update]

      resources :locations do
        collection { get :tree }
      end

      resources :assets do
        member do
          get  :work_orders
          get  :sensor_readings
          get  :iot_rules
          get  :history
          post :qr_code
        end
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
        resources :parts, only: %i[create destroy], controller: "work_order_parts"
        collection do
          get :overdue
          get :unassigned
        end
      end

      scope "requests", as: "work_requests" do
        post "/",       to: "work_requests#create", as: ""
        get  "/:token", to: "work_requests#show",   as: "status"
      end

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
        member do
          patch :acknowledge
          patch :resolve
        end
      end

      # ── IoT rules management ──────────────────────────────────────────────
      resources :iot_rules do
        member do
          patch :pause
          patch :resume
          post  :test
        end
      end

      # ── API key management (admin only) ───────────────────────────────────
      resources :api_keys, only: %i[index create destroy]

      resources :users, only: %i[index show update destroy] do
        collection { get :me }
      end

      # ── Dashboard ─────────────────────────────────────────────────────────
      get "dashboard", to: "dashboard#index"

      # ── Reports ───────────────────────────────────────────────────────────
      namespace :reports do
        get "work_orders/summary",                to: "work_orders#summary"
        get "work_orders/mttr",                   to: "work_orders#mttr"
        get "work_orders/backlog",                to: "work_orders#backlog"
        get "work_orders/technician_performance", to: "work_orders#technician_performance"

        get "assets/health",                      to: "assets#health"
        get "assets/cost_analysis",               to: "assets#cost_analysis"
        get "assets/:id/history",                 to: "assets#history", as: :asset_history

        get "pm/compliance",                      to: "pm#compliance"
        get "pm/schedule_forecast",               to: "pm#schedule_forecast"

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
