# Turns what goes wrong when sending through a mail server into something an administrator can act on.
module SmtpDiagnosis
  def self.explain(error, config)
    where = "#{config.host}:#{config.port}"
    case error
    when Net::SMTPAuthenticationError
      "The mail server at #{where} refused the username or password."
    when Errno::ECONNREFUSED
      "Nothing is accepting connections at #{where}. Check the host and port."
    when SocketError
      "The host \"#{config.host}\" could not be found. Check the spelling."
    when Net::OpenTimeout, Net::ReadTimeout, Errno::ETIMEDOUT, Errno::EHOSTUNREACH
      "No answer from #{where}. Check the host and port, and that this server may connect out to it."
    when OpenSSL::SSL::SSLError
      "The secure connection to #{where} failed. Check the Encryption setting " \
      "(port 465 usually needs SSL/TLS, port 587 STARTTLS). #{error.message}"
    when Net::SMTPSyntaxError, Net::SMTPFatalError, Net::SMTPServerBusy
      "The mail server refused the message: #{error.message.to_s.lines.first.to_s.strip}"
    else
      "Could not send: #{error.message}"
    end
  end
end
