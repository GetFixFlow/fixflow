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
          patch :transition
          post :complete
        end
        collection do
          get :overdue
          get :unassigned
        end
      end

      resources :preventive_maintenances, path: "pm_schedules" do
        member { post :trigger }
        collection { get :due }
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
