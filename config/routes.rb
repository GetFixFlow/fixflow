Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

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

      get "health", to: "health#show"

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
        collection do
          get :dashboard
        end
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
        member do
          patch :adjust_stock
        end
        collection { get :low_stock }
      end

      resources :iot_rules do
        collection do
          post :ingest, to: "iot#ingest"
        end
      end

      namespace :iot do
        post :ingest
      end

      resources :users, only: %i[index show update destroy] do
        collection { get :me }
      end
    end
  end
end
