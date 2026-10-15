module CsvImport
  class Parts < Base
    COLUMNS  = %w[name sku quantity_on_hand reorder_point unit unit_cost location].freeze
    REQUIRED = %w[name].freeze
    EXAMPLE  = ["Oil filter", "OF-100", "12", "3", "each", "12.50", "Plant > Stores"].freeze
    ALIASES  = { "part_name" => "name", "quantity" => "quantity_on_hand", "qty" => "quantity_on_hand", "stock" => "quantity_on_hand",
                 "on_hand" => "quantity_on_hand", "reorder_at" => "reorder_point", "cost" => "unit_cost",
                 "location_name" => "location" }.freeze

    private

    def begin_checks
      @locations = LocationLookup.new(organization)
      @skus_in_file = {}
      @existing_skus = organization.parts.where.not(sku: [nil, ""]).pluck(:sku).index_by(&:downcase)
    end

    def check(cells, number)
      problems = {}
      problems["name"] = "The name is empty." if cells["name"].blank?
      %w[quantity_on_hand reorder_point unit_cost].each do |column|
        next if cells[column].blank?

        value = decimal(cells[column])
        problems[column] = "\"#{cells[column]}\" is not a number. Use digits and a decimal point, like 12.5." if value.nil?
        problems[column] = "This cannot be negative." if value&.negative?
      end
      check_sku(cells["sku"], number, problems)
      _, why = @locations.find(cells["location"])
      problems["location"] = why if why
      problems
    end

    def check_sku(sku, number, problems)
      return if sku.blank?

      key = sku.downcase
      if @existing_skus.key?(key)
        problems["sku"] = "A part with the SKU \"#{sku}\" already exists."
      elsif @skus_in_file.key?(key)
        problems["sku"] = "The SKU \"#{sku}\" is also on row #{@skus_in_file[key]}."
      else
        @skus_in_file[key] = number
      end
    end

    def build_attributes(cells)
      location, = @locations.find(cells["location"])
      {
        name: cells["name"], sku: cells["sku"].presence, quantity_on_hand: decimal(cells["quantity_on_hand"]) || 0,
        reorder_point: decimal(cells["reorder_point"]) || 0, unit: cells["unit"].presence || "each",
        unit_cost: decimal(cells["unit_cost"]), location: location
      }
    end

    def create_record(row)
      organization.parts.create!(row[:attributes])
    end
  end
end
