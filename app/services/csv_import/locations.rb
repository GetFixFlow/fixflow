module CsvImport
  class Locations < Base
    COLUMNS  = %w[name type parent].freeze
    REQUIRED = %w[name].freeze
    EXAMPLE  = ["Line 2", "zone", "Plant > Floor 1"].freeze
    ALIASES  = { "location" => "name", "location_name" => "name", "location_type" => "type", "parent_location" => "parent" }.freeze

    private

    # A location can sit under one made earlier in the same file, so rows are checked in order against
    # what exists plus what the rows above them will create.
    def begin_checks
      @locations = LocationLookup.new(organization)
    end

    def check(cells, _number)
      problems = {}
      problems["name"] = "The name is empty." if cells["name"].blank?
      problems["name"] = "The name is longer than 255 characters." if cells["name"].to_s.length > 255
      problems["name"] = "The name cannot contain \">\", which separates the levels of a path." if cells["name"].to_s.include?(">")

      type = cells["type"].to_s.downcase
      unless type.blank? || Location::TYPES.include?(type)
        problems["type"] = "\"#{cells['type']}\" is not a type. Use one of: #{Location::TYPES.join(', ')}."
      end

      parent, why = @locations.find(cells["parent"])
      problems["parent"] = why if why
      path = [parent.is_a?(String) ? parent : parent&.full_path, cells["name"]].compact_blank.join(" > ")
      problems["name"] ||= "\"#{path}\" already exists." if cells["name"].present? && @locations.path_exists?(path)

      @locations.add(path) if problems.empty? # later rows may use it as their parent
      problems
    end

    # Top-level places default to "site", anything below one to "zone".
    def build_attributes(cells)
      type = cells["type"].presence&.downcase
      { name: cells["name"], parent_path: cells["parent"].presence,
location_type: type || (cells["parent"].present? ? "zone" : "site") }
    end

    def create_record(row)
      attrs = row[:attributes]
      # Built from what exists when the first row is created, and told about each location as it is made,
      # so a row can sit under one created by a row above it.
      @creation_lookup ||= LocationLookup.new(organization)
      parent = attrs[:parent_path] && @creation_lookup.find(attrs[:parent_path]).first
      location = organization.locations.create!(name: attrs[:name], location_type: attrs[:location_type], parent: parent)
      @creation_lookup.add(location.full_path, location)
    end
  end
end
