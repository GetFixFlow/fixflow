Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("ALLOWED_ORIGINS", "http://localhost:3001,http://localhost:5173")
              .split(",").map(&:strip)

    resource "/api/*",
      headers: :any,
      methods: [:get, :post, :patch, :put, :delete, :options, :head],
      expose:  ["Authorization", "X-Request-ID", "X-Total-Count",
                "X-Page", "X-Per-Page", "X-Total-Pages"],
      max_age: 600

    # WebSocket endpoint for ActionCable
    resource "/cable",
      headers: :any,
      methods: [:get, :post, :options]
  end
end
