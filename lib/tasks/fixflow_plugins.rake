namespace :fixflow do
  desc "List the plugins installed on this server and any that did not load — rails fixflow:plugins (exits 1 when one failed)"
  task plugins: :environment do
    puts "Plugins folder: #{Plugins.directory} (plugin API #{Plugins::API_VERSION})"
    Plugins.load! # again, so a plugin that was just edited is read as it is now
    puts "No plugins installed." if Plugins.installed.empty? && Plugins.failures.empty?

    Plugins.installed.each do |plugin|
      puts "\n#{plugin.key}: #{plugin.title} #{plugin.version}".rstrip
      plugin.reports.each { |report| puts "  report   #{report.key} — #{report.title}#{' (as of now)' unless report.period}" }
      plugin.channels.each { |channel| puts "  channel  #{channel.key} — #{channel.title} (#{channel.fields.map(&:key).join(', ')})" }
    end

    unless Plugins.failures.empty?
      puts "\nDid not load:"
      Plugins.failures.each { |failure| puts "  #{failure.folder}: #{failure.message}" }
      exit 1
    end
  end
end
