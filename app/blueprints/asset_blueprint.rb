class AssetBlueprint < Blueprinter::Base
  identifier :id

  fields :name, :asset_tag, :public_code, :serial_number, :status,
    :location_id, :organization_id, :custom_fields, :created_at, :updated_at, :warranty_expires_on

  association :location, blueprint: LocationBlueprint, default: nil

  view :extended do
    fields :name, :asset_tag, :public_code, :serial_number, :status,
      :location_id, :organization_id, :custom_fields, :created_at, :updated_at, :warranty_expires_on

    association :location, blueprint: LocationBlueprint, default: nil

    association :sensor_readings, blueprint: SensorReadingBlueprint do |asset, _opts|
      asset.sensor_readings.recent.limit(5)
    end

    field(:open_work_orders_count) { |asset| asset.work_orders.open.count }
  end
end
