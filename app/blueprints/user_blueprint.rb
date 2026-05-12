class UserBlueprint < Blueprinter::Base
  identifier :id
  fields :email, :role, :first_name, :last_name, :phone, :organization_id, :created_at
  field(:full_name) { |user| user.full_name }

  view :extended do
    fields :email, :role, :first_name, :last_name, :phone,
      :organization_id, :sign_in_count, :last_sign_in_at, :created_at
    field(:full_name) { |user| user.full_name }
  end
end
