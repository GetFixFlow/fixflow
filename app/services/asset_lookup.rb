# Finds the asset a scanned or typed code belongs to. A code can be what the camera read from one of our QR labels (a link
# to the request form, or to the asset page), a barcode, or what a person typed: the tag, the barcode on the machine, or its
# serial number. Capitals do not matter. More than one asset can match (two machines can share a serial number), so the
# answer is a list, the best known first, and the screen asks which one.
class AssetLookup
  LABEL_LINK = %r{/request\?(?:.*&)?asset=([A-Za-z0-9]+)}
  # A link to the asset's page, or the fixflow://assets/7/FF-000042 the old QR download held (it contains /assets/ too).
  ASSET_PAGE = %r{/assets/(\d+)}
  FIELDS = %w[asset_tag barcode serial_number].freeze
  LIMIT = 10
  MAX_LENGTH = 500

  def self.call(organization, text) = new(organization, text).matches

  def initialize(organization, text)
    @assets = organization.assets.kept.includes(:location)
    @code = text.to_s.strip
  end

  # An array of { id, name, asset_tag, barcode, serial_number, location, matched_on }, where matched_on says which of
  # "label", "link", "asset_tag", "barcode" and "serial_number" the code was.
  def matches
    return [] if @code.empty? || @code.length > MAX_LENGTH

    if (label = @code.match(LABEL_LINK))
      describe(@assets.where(public_code: label[1]), ->(_asset) { ["label"] })
    elsif (page = @code.match(ASSET_PAGE))
      describe(@assets.where(id: page[1]), ->(_asset) { ["link"] })
    else
      describe(@assets.where(typed_code_sql, code: @code.downcase), lambda { |asset|
        FIELDS.select { |field|
          asset[field].to_s.downcase == @code.downcase
        }
      })
    end
  end

  private

  def typed_code_sql = FIELDS.map { |field| "lower(assets.#{field}) = :code" }.join(" OR ")

  def describe(scope, matched_on)
    scope.order(:name, :id).limit(LIMIT).map do |asset|
      { id: asset.id, name: asset.name, asset_tag: asset.asset_tag, barcode: asset.barcode, serial_number: asset.serial_number,
        location: asset.location&.name, matched_on: matched_on.call(asset) }
    end
  end
end
