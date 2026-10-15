module CsvImport
  # Finds a location from what someone typed in a spreadsheet: the full path ("Plant > Floor 1 > Line 2")
  # or just a name, as long as only one location has that name. Case and spacing do not matter.
  class LocationLookup
    SEPARATOR = /\s*>\s*/

    def initialize(organization)
      @by_path = Hash.new { |h, k| h[k] = [] }
      @by_name = Hash.new { |h, k| h[k] = [] }
      organization.locations.find_each { |location| add(location.full_path, location) }
    end

    # Makes a location that the file itself is about to create findable by the rows after it.
    def add(path, record = nil)
      key = normalise(path)
      @by_path[key] << (record || path)
      @by_name[normalise(path.split(SEPARATOR).last)] << (record || path)
    end

    def path_exists?(path) = @by_path.key?(normalise(path))

    # Returns [location, nil], [nil, nil] when nothing was typed, or [nil, "why not"].
    def find(text)
      return [nil, nil] if text.blank?

      matches = @by_path[normalise(text)]
      matches = @by_name[normalise(text)] if matches.empty? && text.exclude?(">")
      return [matches.first, nil] if matches.one?

      if matches.empty?
        [nil, "No location is called \"#{text}\". Add it first (import locations), or check the spelling."]
      else
        [nil, "More than one location is called \"#{text}\". Use its full path, such as \"Plant > Floor 1 > #{text}\"."]
      end
    end

    private

    def normalise(text) = text.to_s.strip.split(SEPARATOR).map { |part| part.squish.downcase }.join(" > ")
  end
end
