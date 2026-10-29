# The rules for a password somebody chooses (a new account, an accepted invitation, a reset, a change), beyond the
# length Devise checks (config/initializers/devise.rb: 10 to 128 characters). Only a password being set is checked, so
# people who already have a shorter or weaker one keep signing in until they change it.
#
# What is refused is what guessers try first: the most common passwords (also with digits or symbols added to them),
# one character or a short stretch repeated, a run of digits, the app's name, and anything built from the person's own email or name.
# Nothing is asked of the characters used: length and not being guessable matter more than a capital and a symbol.
module PasswordPolicy
  extend ActiveSupport::Concern

  COMMON = %w[
    password passw0rd p@ssw0rd pa55word passwort qwerty qwertyuiop qwertyui asdfghjkl asdfghjk zxcvbnm qazwsx zaq12wsx
    1q2w3e4r 1qaz2wsx 1q2w3e4r5t 123456 1234567 12345678 123456789 1234567890 0123456789 987654321 9876543210 abc123
    abcdefgh abcdefghij iloveyou loveyou letmein welcome admin administrator root toor default secret guest login master
    hello hello123 freedom whatever trustno1 sunshine princess dragon monkey shadow superman batman football baseball
    soccer hockey mustang jordan harley ranger buster thomas tigger robert charlie pepper daniel joshua matrix hannah
    jessica michael george andrew hunter killer access flower loveme changeme starwars solo summer winter spring autumn
    maintenance maintain workorder cmms company test testing temp temporary demo
  ].to_set.freeze
  SEQUENCE = "01234567890123456789".freeze
  NAME_PART_MIN = 4

  included do
    # Demo and sample data have a well-known password on purpose; nothing else should switch the rules off.
    attr_accessor :skip_password_policy

    validate :password_meets_policy, if: -> { password.present? && !skip_password_policy }
  end

  private

  def password_meets_policy
    plain = password.downcase
    squashed = plain.gsub(/[^a-z0-9]/, "")

    errors.add(:password, "is too common or too easy to guess") if easy_to_guess?(plain, squashed)
    errors.add(:password, "can't contain your name or email address") if built_from_identity?(squashed)
  end

  def easy_to_guess?(plain, squashed)
    return true if squashed.empty? || squashed.chars.uniq.one?
    return true if squashed.match?(/\A(.+?)\1+\z/) # "letmeinletmein", "abcabcabcabc"
    return true if squashed.match?(/\A\d+\z/) && (SEQUENCE.include?(squashed) || SEQUENCE.reverse.include?(squashed))
    return true if squashed.include?("fixflow")

    # "Password123", "welcome!" and "p@ssw0rd" are the list's words with something added or a letter swapped for a look-alike.
    spelled = plain.tr("@$04315!", "asoaesii").gsub(/[^a-z0-9]/, "")
    candidates = [plain, squashed, spelled].flat_map { |text| [text, text.sub(/\A\d+/, "").sub(/\d+\z/, "")] }
    candidates.any? { |candidate| COMMON.include?(candidate) }
  end

  def built_from_identity?(squashed)
    parts = [email.to_s.split("@").first, first_name, last_name].map { |part| part.to_s.downcase.gsub(/[^a-z0-9]/, "") }
    parts.any? { |part| part.length >= NAME_PART_MIN && squashed.include?(part) }
  end
end
