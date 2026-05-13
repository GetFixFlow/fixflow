# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :password, :password_confirmation,
  :email, :secret, :token, :_key, :crypt, :salt,
  :certificate, :otp, :ssn, :cvv, :cvc,
  :api_key, :authorization, :jwt, :private_key,
  :mqtt_password, :encryption_key, :key_digest,
  :access_key, :secret_key, :database_url
]
