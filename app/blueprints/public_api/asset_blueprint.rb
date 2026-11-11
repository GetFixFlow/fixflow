module PublicApi
  class AssetBlueprint < Blueprinter::Base
    identifier :id

    fields :name, :asset_tag, :serial_number, :status, :barcode, :warranty_expires_on, :custom_fields, :created_at, :updated_at
    field(:location) { |asset| asset.location && { id: asset.location.id, name: asset.location.name } }
    field(:url) { |asset| "#{EmailSetup.base_url}/assets/#{asset.id}" }
  end
end
