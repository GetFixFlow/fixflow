# How the company's install looks: a logo, a favicon, one primary colour that restyles the app,
# and the headline on the sign-in page. The text and colour live in the settings jsonb column
# (under "branding"); the images are attachments.
module OrganizationBranding
  extend ActiveSupport::Concern

  DEFAULTS = {
    "primary_color" => "#2563eb",
    "login_headline" => "Sign in to FixFlow",
    "login_subtitle" => "Enter your credentials to continue"
  }.freeze
  COLOR_FORMAT = /\A#[0-9a-f]{6}\z/
  # White text goes on this colour (buttons, active items), so it must not be too light to read.
  MIN_CONTRAST_WITH_WHITE = 3.0
  LOGO_TYPES = %w[image/png image/jpeg image/webp].freeze
  FAVICON_TYPES = %w[image/png image/x-icon image/vnd.microsoft.icon image/webp].freeze
  LOGO_MAX_BYTES = 2.megabytes
  FAVICON_MAX_BYTES = 512.kilobytes

  included do
    has_one_attached :logo
    has_one_attached :favicon
    validate :branding_is_acceptable
  end

  def branding
    DEFAULTS.merge(((settings || {})["branding"] || {}).slice(*DEFAULTS.keys))
  end

  # Merge changes from the form; the checks run when the organization is saved.
  def assign_branding(changes)
    changes = changes.to_h.stringify_keys.slice(*DEFAULTS.keys)
    changes["primary_color"] = changes["primary_color"].to_s.strip.downcase if changes.key?("primary_color")
    %w[login_headline login_subtitle].each { |key| changes[key] = changes[key].to_s.strip if changes.key?(key) }
    self.settings = (settings || {}).merge("branding" => branding.merge(changes))
  end

  # WCAG contrast of a #rrggbb colour against white.
  def self.contrast_with_white(hex)
    channels = hex.delete("#").scan(/../).map { |c| c.to_i(16) / 255.0 }
    linear = channels.map { |c| c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055)**2.4 }
    luminance = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
    1.05 / (luminance + 0.05)
  end

  private

  def branding_is_acceptable
    values = branding
    color = values["primary_color"]
    if !color.match?(COLOR_FORMAT)
      errors.add(:base, "The colour must look like #2563eb.")
    elsif OrganizationBranding.contrast_with_white(color) < MIN_CONTRAST_WITH_WHITE
      errors.add(:base, "That colour is too light for white text to be readable on it. Choose a darker one.")
    end
    errors.add(:base, "The sign-in headline must be 1 to 80 characters.") unless values["login_headline"].length.between?(1, 80)
    errors.add(:base, "The sign-in subtitle must be 160 characters or fewer.") if values["login_subtitle"].length > 160

    check_image(logo, "The logo", LOGO_TYPES, LOGO_MAX_BYTES)
    check_image(favicon, "The favicon", FAVICON_TYPES, FAVICON_MAX_BYTES)
  end

  def check_image(attachment, name, types, max_bytes)
    return unless attachment.attached? && attachment.blob.new_record?

    unless types.include?(attachment.blob.content_type)
      errors.add(:base,
"#{name} must be a PNG, JPEG or WebP image#{' (or ICO)' if types.include?('image/x-icon')}.")
    end
    errors.add(:base, "#{name} must be #{max_bytes / 1.kilobyte} KB or smaller.") if attachment.blob.byte_size > max_bytes
  end
end
