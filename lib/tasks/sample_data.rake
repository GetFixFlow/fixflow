namespace :fixflow do
  desc "Add sample locations, assets, parts and work orders to this company, to look around in"
  task sample_data: :environment do
    org = Organization.order(:id).first or abort "There is no company yet. Finish the first-run setup first."
    admin = org.users.where(role: "admin").order(:id).first or abort "The company has no administrator."
    SampleDataService.load!(org, admin)
    puts "Sample data loaded: #{SampleDataService.sentence(SampleDataService.counts(org))}."
    puts "Remove it any time with: bin/rails fixflow:remove_sample_data"
  rescue SampleDataService::AlreadyLoaded => e
    abort e.message
  end

  desc "Remove the sample data again (anything you built on it is kept)"
  task remove_sample_data: :environment do
    org = Organization.order(:id).first or abort "There is no company yet."
    report = SampleDataService.remove!(org)
    puts "Removed: #{SampleDataService.sentence(report[:removed])}."
    report[:kept].each { |k| puts "Kept #{SampleDataService::LABELS[k[:type]]} \"#{k[:name]}\": #{k[:reason]}." }
  end
end
