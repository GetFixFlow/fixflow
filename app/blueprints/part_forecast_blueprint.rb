# One part and what is expected of it over the next 30 days (Forecast::PartsDemand::Row).
class PartForecastBlueprint < Blueprinter::Base
  field(:part) do |row|
    { id: row.part.id, name: row.part.name, sku: row.part.sku, unit: row.part.unit }
  end
  fields :status, :suggested_quantity, :periods, :uses
  field :used, name: :used_last_30_days
  field(:expected) { |row| row.expected.round(1) }
  field(:low) { |row| row.low.round(1) }
  field(:high) { |row| row.high.round(1) }
  field(:on_hand) { |row| row.on_hand.round(2) }
  field(:on_order) { |row| row.on_order.round(2) }
  field(:days_of_stock) { |row| row.days_of_stock&.round }
end
