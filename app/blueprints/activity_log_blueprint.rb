class ActivityLogBlueprint < Blueprinter::Base
  identifier :id

  fields :action, :resource_type, :resource_id, :resource_name, :ip_address, :created_at

  field :metadata do |log|
    log.metadata
  end

  association :user, blueprint: UserBlueprint do |log|
    log.user
  end
end
