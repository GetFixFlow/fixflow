# Demo data for local development. For any other environment use:
#   rails fixflow:demo_data    (set CONFIRM=yes in production)
return unless Rails.env.development?

puts "Seeding development data..."
begin
  logins = DemoDataService.load!
rescue DemoDataService::Refused => e
  abort e.message
end

puts ""
puts "✅  Demo data seeded!"
logins.each { |email| puts "    #{email.ljust(17)} / #{DemoDataService::DEMO_PASSWORD}" }
