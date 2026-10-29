namespace :fixflow do
  desc "Switch off a person's two-factor sign-in (a lost phone, and no administrator who can) — rails fixflow:reset_two_factor[email]"
  task :reset_two_factor, [:email] => :environment do |_t, args|
    user = ActsAsTenant.without_tenant { User.find_by(email: args[:email].to_s.strip.downcase) }
    abort "There is no user with the email #{args[:email].inspect}." unless user
    abort "#{user.email} does not have two-factor sign-in on." unless user.two_factor_enabled? || user.two_factor_pending?

    user.disable_two_factor!
    user.update!(jti: SecureRandom.uuid) # signs them out everywhere
    puts "Two-factor sign-in is off for #{user.email}; they signed out everywhere and sign in with their password."
  end

  desc "Create initial admin user — usage: rails fixflow:create_admin[email,password,org_name]"
  task :create_admin, %i[email password org_name] => :environment do |_t, args|
    args.with_defaults(email: "admin@fixflow.local", org_name: "FixFlow")
    if args[:password].blank?
      abort "Give the password: rails \"fixflow:create_admin[#{args[:email]},a-long-password,#{args[:org_name]}]\" " \
            "(10 characters or more)."
    end
    ActsAsTenant.without_tenant do
      # One install serves one company: refuse to create a second.
      abort "Setup is already complete (#{Organization.first.name}). Not creating another company." if Organization.setup_complete?

      org  = Organization.create!(name: args[:org_name], subdomain: args[:org_name].parameterize)
      user = User.create!(
        email:                 args[:email],
        password:              args[:password],
        password_confirmation: args[:password],
        first_name:            "Admin",
        last_name:             "User",
        role:                  :admin,
        organization:          org
      )
      puts "Created organization: #{org.name} (id: #{org.id})"
      puts "Created admin user:   #{user.email}"
    end
  end
end
