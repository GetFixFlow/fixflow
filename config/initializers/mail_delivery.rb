# Registered once the app's own classes can be loaded; Rails looks the method up when an email is sent.
Rails.application.config.to_prepare do
  ActionMailer::Base.add_delivery_method :fixflow, FixflowMailDelivery
end
