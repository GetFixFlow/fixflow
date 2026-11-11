# The languages FixFlow speaks. A language is a set of files in config/locales (and apps/web/src/locales for the screens):
# the file named for its code (es.yml) is what makes it offered, so there is no list to keep here. (I18n's own list is
# not used: libraries such as Faker add dozens of languages to it that FixFlow does not speak.)
module Locales
  module_function

  FILE = /\A([a-z]{2,3}(?:-[A-Z]{2})?)\.yml\z/

  # Codes such as "en" and "es", English first, then the rest in order.
  def codes
    @codes ||= Rails.root.join("config/locales").children.filter_map { |file| file.basename.to_s[FILE, 1] }
                    .sort_by { |code| [code == default ? 0 : 1, code] }.freeze
  end

  def default = I18n.default_locale.to_s

  def available?(code) = code.present? && codes.include?(code.to_s)

  # Each language by its own name ("Español"), the way a person looking for theirs expects to read it.
  def names
    codes.index_with { |code| I18n.t("language_name", locale: code, default: code) }
  end

  # What a person reads: their own choice, else the company's, else English.
  def for_user(user)
    return default unless user

    [user.locale, user.organization&.language].find { |code| available?(code) } || default
  end

  def for_organization(organization)
    code = organization&.language
    available?(code) ? code : default
  end

  # Runs the block in the person's language (a mailer builds its subject and text inside it).
  def with_user(user, &) = I18n.with_locale(for_user(user), &)

  def with_organization(organization, &) = I18n.with_locale(for_organization(organization), &)
end
