class UserBlueprint < Blueprinter::Base
  identifier :id
  fields :email, :role, :first_name, :last_name, :phone, :organization_id, :created_at
  field(:full_name) { |user| user.full_name }
  field(:active) { |user| user.active? }
  field(:invitation_pending) { |user| user.invitation_pending? }
  field(:two_factor_enabled) { |user| user.two_factor_enabled? }
  # Too many wrong passwords; an administrator can unlock it (it also opens by itself after 30 minutes).
  field(:locked) { |user| user.access_locked? }
  # The company requires it and this person has not set it up: the web app sends them to do so before anything else.
  field(:two_factor_setup_required) { |user| !user.two_factor_enabled? && user.organization.require_two_factor? }
  # Users who signed up themselves have no invitation, so they count as accepted.
  field :invitation_accepted_at do |user|
    user.invitation_accepted_at || (user.invitation_sent_at ? nil : user.created_at)
  end

  # Pay is for administrators: pass `show_rate: true` to include it.
  field(:hourly_rate) { |user, options| options[:show_rate] ? user.hourly_rate&.to_f : nil }

  view :extended do
    fields :email, :role, :first_name, :last_name, :phone, :job_title, :department,
      :organization_id, :sign_in_count, :last_sign_in_at, :created_at
    field(:full_name) { |user| user.full_name }
    field(:organization_name) { |user| user.organization.name }
  end
end
