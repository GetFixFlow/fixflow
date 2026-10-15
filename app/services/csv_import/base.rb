require "csv"

module CsvImport
  # Reads a CSV the way people actually produce them (Excel, a text editor, a spreadsheet export),
  # checks every row, and either reports what is wrong or creates everything. A file with any error
  # creates nothing, so a corrected file can be uploaded again without doubling up the rows that were fine.
  class Base
    MAX_BYTES = 5.megabytes
    MAX_ROWS  = 5000
    MAX_ERRORS_SHOWN = 200

    Error = Struct.new(:row, :column, :message, keyword_init: true)

    Result = Struct.new(:kind, :total_rows, :errors, :columns, :preview, :created, keyword_init: true) do
      def valid? = errors.empty?
    end

    # Raised for a file that cannot be read at all, as opposed to rows with problems.
    class Unreadable < StandardError; end

    def self.for(kind, organization)
      { "assets" => Assets, "locations" => Locations, "parts" => Parts }.fetch(kind.to_s).new(organization)
    end

    def initialize(organization)
      @organization = organization
    end

    # What the file would do, without doing it.
    def preview(content)
      analyse(content).first
    end

    # Creates everything in the file, or nothing if any row has a problem.
    def import!(content)
      result, rows = analyse(content)
      return result unless result.valid?

      ActiveRecord::Base.transaction do
        rows.each { |row| create_record(row) }
      end
      result.created = rows.size
      result
    end

    # The file to download, filled in as an example.
    def template
      CSV.generate do |csv|
        csv << self.class::COLUMNS
        csv << self.class::EXAMPLE
      end
    end

    private

    attr_reader :organization

    # Subclasses say which columns they know, which are required, and how to check and create a row.
    def required_columns = self.class::REQUIRED
    def known_columns = self.class::COLUMNS
    def allow_custom_columns? = false

    def analyse(content)
      table, = parse(content)
      headers = table.headers
      errors = header_errors(headers)
      return [build_result(0, errors, headers, []), []] if errors.any?

      rows = read_rows(table)
      begin_checks
      prepared = rows.filter_map do |row|
        problems = check(row[:cells], row[:number])
        errors.concat(problems.map { |column, message| Error.new(row: row[:number], column: column, message: message) })
        row.merge(attributes: build_attributes(row[:cells])) if problems.empty?
      end
      [build_result(rows.size, errors, headers, prepared), prepared]
    end

    def read_rows(table)
      rows = table.each_with_index.filter_map do |csv_row, index|
        cells = csv_row.to_h.transform_values { |v| v.to_s.strip }
        # The number is the spreadsheet's row number: row 1 is the headings.
        { number: index + 2, cells: cells } unless cells.values.all?(&:blank?)
      end
      raise Unreadable, "The file has no rows below the headings." if rows.empty?
      raise Unreadable, "The file has #{rows.size} rows. Import at most #{MAX_ROWS} at a time." if rows.size > MAX_ROWS

      rows
    end

    def build_result(total, errors, headers, prepared)
      custom = allow_custom_columns? ? headers.compact.reject { |h| known_columns.include?(h) } : []
      Result.new(
        kind: self.class.name.demodulize.downcase, total_rows: total, errors: errors,
        columns: { known: headers.compact & known_columns, custom: custom },
        preview: prepared.first(10).pluck(:cells), created: 0
      )
    end

    def header_errors(headers)
      missing = required_columns - headers.compact
      problems = missing.map { |col| Error.new(row: 1, column: col, message: "The file needs a \"#{col}\" column.") }
      duplicated = headers.compact.tally.select { |_, n| n > 1 }.keys
      duplicated.each { |col| problems << Error.new(row: 1, column: col, message: "There is more than one \"#{col}\" column.") }
      unknown = allow_custom_columns? ? [] : headers.compact - known_columns
      unknown.each { |col|
        problems << Error.new(row: 1, column: col,
       message: "\"#{col}\" is not a column this import knows. Columns: #{known_columns.join(', ')}.")
      }
      problems
    end

    # --- reading the file --------------------------------------------------------------------------

    def parse(content)
      text = decode(content)
      delimiter = detect_delimiter(text)
      table = CSV.parse(text, headers: true, col_sep: delimiter, skip_blanks: true,
                              header_converters: ->(h) { normalise_header(h) })
      [table, delimiter]
    rescue CSV::MalformedCSVError => e
      raise Unreadable,
"The file could not be read as CSV (#{e.message.sub(/ in line (\d+)\.?/, ', line \1')}). Check for a quote that is never closed."
    end

    def decode(content)
      raise Unreadable, "The file is empty." if content.blank?
      if content.start_with?("PK")
        raise Unreadable,
"This looks like an Excel file. In Excel choose File, Save As, CSV, and upload that."
      end
      raise Unreadable, "This does not look like a CSV text file." if content.include?("\u0000") || content.b.include?("\x00".b)

      text = content.dup.force_encoding(Encoding::UTF_8)
      # Excel in many countries saves CSV as Windows-1252 rather than UTF-8.
      text = content.dup.force_encoding(Encoding::Windows_1252).encode(Encoding::UTF_8) unless text.valid_encoding?
      text.delete_prefix("﻿")
    end

    # Excel in countries that write 1,5 for one and a half separates columns with ; instead of ,
    def detect_delimiter(text)
      first_line = text.lines.first.to_s
      [",", ";", "\t"].max_by { |d| first_line.count(d) }.then { |d| first_line.count(d).zero? ? "," : d }
    end

    def normalise_header(header)
      name = header.to_s.strip.downcase.gsub(/[\s-]+/, "_")
      self.class::ALIASES.fetch(name, name).presence
    end

    # --- helpers for the kinds ----------------------------------------------------------------------

    def begin_checks; end

    def decimal(value)
      return nil if value.blank?
      return nil unless value.match?(/\A-?\d+([.,]\d+)?\z/)

      BigDecimal(value.tr(",", "."))
    end
  end
end
