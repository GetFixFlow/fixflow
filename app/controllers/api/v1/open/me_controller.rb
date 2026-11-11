module Api
  module V1
    module Open
      # GET /api/v1/open/me: which key this is and which company it belongs to. What a program calls first to check that its
      # key works ("test connection").
      class MeController < BaseController
        skip_before_action :require_scope_for_request! # any valid key may ask who it is

        def show
          render_data({ key: { id: api_key.id, name: api_key.name, scopes: api_key.effective_scopes, expires_at: api_key.expires_at },
                      organization: { id: organization.id, name: organization.name } })
        end
      end
    end
  end
end
