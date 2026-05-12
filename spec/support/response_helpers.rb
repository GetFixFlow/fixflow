module ResponseHelpers
  def json_body
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include ResponseHelpers, type: :request
end
