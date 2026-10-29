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
end
