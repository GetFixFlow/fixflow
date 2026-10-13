# Settings that decide how invitation links are built and whether email can be sent.
module Invitations
  def self.base_url = EmailSetup.base_url
  def self.email_configured? = EmailSetup.configured?
end
