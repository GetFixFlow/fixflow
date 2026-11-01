class CustomFieldBlueprint < Blueprinter::Base
  identifier :id
  fields :entity, :key, :label, :kind, :options, :required, :in_list, :active, :position
end
