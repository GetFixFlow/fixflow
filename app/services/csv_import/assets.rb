module CsvImport
  class Assets < Base
    COLUMNS  = %w[name asset_tag serial_number status location].freeze
    REQUIRED = %w[name].freeze
    EXAMPLE  = ["Pump 1", "P-001", "SN-12345", "operational", "Plant > Floor 1"].freeze
    ALIASES  = { "asset_name" => "name", "tag" => "asset_tag", "serial" => "serial_number", "location_name" => "location",
                 "state" => "status" }.freeze

    # Any other column is kept with the asset as a custom field (manufacturer, model, year and so on).
    def allow_custom_columns? = true

    private

    def begin_checks
      @locations = LocationLookup.new(organization)
      @tags_in_file = {}
      @existing_tags = organization.assets.where.not(asset_tag: [nil, ""]).pluck(:asset_tag).index_by(&:downcase)
    end

    def check(cells, number)
      problems = {}
      problems["name"] = "The name is empty." if cells["name"].blank?
      problems["name"] = "The name is longer than 255 characters." if cells["name"].to_s.length > 255

      status = cells["status"].to_s.downcase
      unless status.blank? || Asset::STATUSES.include?(status)
        problems["status"] =
          "\"#{cells['status']}\" is not a status. Use one of: #{Asset::STATUSES.join(', ')}."
      end

      check_tag(cells["asset_tag"], number, problems)
      _, why = @locations.find(cells["location"])
      problems["location"] = why if why
      problems
    end

    def check_tag(tag, number, problems)
      return if tag.blank?

      key = tag.downcase
      if @existing_tags.key?(key)
        problems["asset_tag"] = "An asset with the tag \"#{tag}\" already exists."
      elsif @tags_in_file.key?(key)
        problems["asset_tag"] = "The tag \"#{tag}\" is also on row #{@tags_in_file[key]}."
      else
        @tags_in_file[key] = number
      end
    end

    def build_attributes(cells)
      location, = @locations.find(cells["location"])
      custom = cells.except(*COLUMNS).compact_blank
      {
        name: cells["name"], asset_tag: cells["asset_tag"].presence, serial_number: cells["serial_number"].presence,
        status: cells["status"].presence&.downcase || "operational", location: location, custom_fields: custom
      }
    end

    def create_record(row)
      organization.assets.create!(row[:attributes])
    end
  end
end
