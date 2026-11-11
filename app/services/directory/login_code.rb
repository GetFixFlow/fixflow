module Directory
  # What the browser is handed to finish an OpenID Connect sign-in. The provider sends the person back to the API, which
  # cannot answer with a token in a redirect without putting it in an address; so it hands over this note instead,
  # good for one minute and for one use, which the web app swaps for the real session (POST /api/v1/auth/directory).
  module LoginCode
    PURPOSE = "directory_login".freeze
    VALID_FOR = 1.minute

    module_function

    def verifier = Rails.application.message_verifier(PURPOSE)

    def issue(user)
      verifier.generate({ "uid" => user.id, "jti" => user.jti, "n" => SecureRandom.hex(16) }, expires_in: VALID_FOR, purpose: PURPOSE)
    end

    # The person the code was made for, once; nil when it is forged, old, already used, or no longer fits the account.
    def redeem(token)
      data = verifier.verified(token.to_s, purpose: PURPOSE)
      return unless data
      return unless Rails.cache.write("directory_login/#{data['n']}", true, expires_in: VALID_FOR * 2, unless_exist: true)

      user = User.find_by(id: data["uid"])
      user if user && user.jti == data["jti"]
    end
  end
end
