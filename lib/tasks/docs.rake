namespace :docs do
  desc "Write docs/api-endpoints.md from the routes"
  task api: :environment do
    require "fixflow_api_docs"
    Rails.root.join("docs/api-endpoints.md").write(FixflowApiDocs.markdown)
    puts "Wrote docs/api-endpoints.md"
  end
end
