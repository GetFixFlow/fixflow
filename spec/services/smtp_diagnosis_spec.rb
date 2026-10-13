require "rails_helper"

RSpec.describe SmtpDiagnosis do
  let(:config) { SmtpConfig.new.assign(host: "smtp.acme.com", port: 587) }

  {
    Net::SMTPAuthenticationError.new("535") => "refused the username or password",
    Errno::ECONNREFUSED.new => "Nothing is accepting connections at smtp.acme.com:587",
    SocketError.new("getaddrinfo") => 'The host "smtp.acme.com" could not be found',
    Net::OpenTimeout.new => "No answer from smtp.acme.com:587",
    Net::ReadTimeout.new => "No answer from smtp.acme.com:587",
    OpenSSL::SSL::SSLError.new("wrong version number") => "Check the Encryption setting",
    Net::SMTPFatalError.new("550 relay denied") => "refused the message: 550 relay denied",
    RuntimeError.new("something odd") => "Could not send: something odd"
  }.each do |error, expected|
    it "explains #{error.class} in plain words" do
      expect(described_class.explain(error, config)).to include(expected)
    end
  end
end
