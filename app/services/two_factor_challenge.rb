# What the first step of signing in (the password) hands back for a person with two-factor sign-in on, to be sent
# with the code in the second step. A signed note naming the person, good for five minutes; it is not a session, and
# changing the password (which renews the person's jti) cancels it.
module TwoFactorChallenge
  PURPOSE = "two_factor_challenge".freeze
  VALID_FOR = 5.minutes

  def self.verifier = Rails.application.message_verifier(PURPOSE)

  def self.issue(user)
    verifier.generate({ "uid" => user.id, "jti" => user.jti }, expires_in: VALID_FOR, purpose: PURPOSE)
  end

  # The person a challenge was made for, or nil when it is forged, old, or no longer matches.
  def self.user_for(token)
    data = verifier.verified(token.to_s, purpose: PURPOSE)
    user = data && User.find_by(id: data["uid"])
    user if user && user.jti == data["jti"]
  end
end
