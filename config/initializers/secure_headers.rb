SecureHeaders::Configuration.default do |config|
  config.x_frame_options         = "DENY"
  config.x_content_type_options  = "nosniff"
  config.x_xss_protection        = "0"           # deprecated header; CSP is the modern replacement
  config.x_download_options      = "noopen"
  config.x_permitted_cross_domain_policies = "none"
  config.referrer_policy         = "strict-origin-when-cross-origin"

  config.hsts = "max-age=#{1.year.to_i}; includeSubDomains; preload"

  # API-only app — no frames, scripts, or media needed from the server
  config.csp = {
    default_src:    %w['none'],
    connect_src:    %w['self'],
    frame_ancestors: %w['none'],
    script_src:     SecureHeaders::OPT_OUT
  }
end
