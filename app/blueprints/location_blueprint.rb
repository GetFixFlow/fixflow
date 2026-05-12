class LocationBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :location_type, :ancestry, :created_at, :updated_at

  field(:parent_id) { |loc| loc.parent_id }
  field(:depth)     { |loc| loc.depth }
  field(:children)  { |loc| loc.children.map { |c| { id: c.id, name: c.name, location_type: c.location_type } } }

  view :extended do
    fields :name, :location_type, :ancestry, :created_at, :updated_at
    field(:parent_id)  { |loc| loc.parent_id }
    field(:depth)      { |loc| loc.depth }
    field(:full_path)  { |loc| loc.full_path }
    field(:children)   { |loc| loc.children.map { |c| { id: c.id, name: c.name, location_type: c.location_type } } }
  end

  view :tree do
    fields :name, :location_type, :ancestry
    field(:parent_id) { |loc| loc.parent_id }
    field(:depth)     { |loc| loc.depth }
    association :children, blueprint: LocationBlueprint, view: :tree
  end
end
