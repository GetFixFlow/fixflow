# Loads the plugins in the plugins folder (see app/services/plugins.rb and docs/plugins.md): when the server starts, and again
# in development each time code is reloaded (the plugins' registrations belong to the classes that were reloaded).
# The web server and the background worker both run this, so a report can be made and a channel can deliver in either.
Rails.application.config.to_prepare do
  Plugins.load!
end
