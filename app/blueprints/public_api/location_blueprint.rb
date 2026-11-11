module PublicApi
  class LocationBlueprint < Blueprinter::Base
    identifier :id

    fields :name, :location_type, :created_at, :updated_at
    field(:parent_id, &:parent_id)
  end
end
