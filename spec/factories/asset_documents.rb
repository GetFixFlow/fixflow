FactoryBot.define do
  factory :asset_document do
    association :asset
    user { association :user, organization: asset.organization }
    description { "Manual" }

    transient do
      file_name { "manual.pdf" }
      content_type { "application/pdf" }
    end

    after(:build) do |document, evaluator|
      next if document.file.attached?

      # The type is judged by the contents, so a photo has to be a real one (this is a 1x1 PNG).
      png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
      content = evaluator.content_type == "image/png" ? Base64.decode64(png) : "%PDF-1.4 manual"
      document.file.attach(io: StringIO.new(content), filename: evaluator.file_name, content_type: evaluator.content_type)
    end
  end
end
