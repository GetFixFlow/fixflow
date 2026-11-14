require "csv"

module Plugins
  # The one shape a plugin report answers with, so FixFlow can draw it and offer it as CSV without knowing what is in it.
  #
  #   columns: [{ key:, label:, kind: }]    kind: text (default), number, money, percent (0 to 100), date, datetime
  #   rows:    [{ key => value }]  or  [[value, ...]] in the order of the columns
  #   summary: [{ label:, value:, kind: }]  (optional) figures shown above the table
  #   note:    "..."                        (optional) a line under the table
  #
  # Checked here, with sentences a plugin author can act on, rather than failing later on a screen.
  class Table
    KINDS = %w[text number money percent date datetime].freeze
    MAX_COLUMNS = 30
    MAX_ROWS = 10_000
    MAX_SUMMARY = 12
    MAX_TEXT = 2_000
    NUMERIC = %w[number money percent].freeze

    Column = Struct.new(:key, :label, :kind, keyword_init: true)

    attr_reader :columns, :rows, :summary, :note

    def self.build(raw) = new(raw)

    def initialize(raw)
      unless raw.respond_to?(:to_h) && !raw.is_a?(Array)
        raise Error,
"The report must return a Hash with columns and rows, but returned #{raw.class}."
      end

      data = raw.to_h.with_indifferent_access
      @columns = build_columns(data[:columns])
      @rows = build_rows(data[:rows])
      @summary = build_summary(data[:summary])
      @note = data[:note].to_s.scrub.first(MAX_TEXT).presence
    end

    def as_json(*)
      { columns: columns.map(&:to_h), rows: rows, summary: summary, note: note }
    end

    # The same table as a spreadsheet file (opens in Excel; text that starts like a formula is kept as text).
    def csv
      body = CSV.generate do |csv|
        csv << columns.map { |column| ExportService.cell(column.label) }
        rows.each { |row| csv << row.map { |value| ExportService.cell(value) } }
      end
      ExportService::BYTE_ORDER_MARK + body
    end

    private

    def build_columns(list)
      list = Array(list)
      raise Error, "The report has no columns." if list.empty?
      raise Error, "The report has #{list.size} columns; at most #{MAX_COLUMNS} are allowed." if list.size > MAX_COLUMNS

      columns = list.each_with_index.map { |spec, index| build_column(spec, index) }
      duplicate = columns.map(&:key).tally.find { |_key, count| count > 1 }&.first
      raise Error, "Column key #{duplicate.inspect} is used twice." if duplicate

      columns
    end

    def build_column(spec, index)
      spec = spec.to_h.with_indifferent_access
      key = spec[:key].to_s
      raise Error, "Column #{index + 1} has no key." if key.empty?

      kind = (spec[:kind].presence || "text").to_s
      raise Error, "Column #{key} has the unknown kind #{kind.inspect} (use #{KINDS.join(', ')})." unless KINDS.include?(kind)

      Column.new(key: key, label: (spec[:label].presence || key.humanize).to_s.first(200), kind: kind)
    end

    def build_rows(list)
      list = Array(list)
      raise Error, "The report has #{list.size} rows; at most #{MAX_ROWS} are allowed. Narrow it down." if list.size > MAX_ROWS

      list.each_with_index.map { |row, index| build_row(row, index) }
    end

    def build_row(row, index)
      values = row.is_a?(Array) ? row : columns.map { |column| lookup(row, column.key) }
      raise Error, "Row #{index + 1} has #{values.size} values for #{columns.size} columns." unless values.size == columns.size

      values.each_with_index.map { |value, position| cell(value, columns[position], "row #{index + 1}") }
    end

    def lookup(row, key)
      return nil unless row.respond_to?(:to_h)

      hash = row.to_h
      hash.key?(key) ? hash[key] : hash[key.to_sym]
    end

    def build_summary(list)
      list = Array(list)
      raise Error, "The summary has #{list.size} figures; at most #{MAX_SUMMARY} are allowed." if list.size > MAX_SUMMARY

      list.each_with_index.map do |item, index|
        item = item.to_h.with_indifferent_access
        raise Error, "Summary figure #{index + 1} has no label." if item[:label].blank?

        kind = (item[:kind].presence || "text").to_s
        raise Error, "Summary figure #{item[:label]} has the unknown kind #{kind.inspect}." unless KINDS.include?(kind)

        { label: item[:label].to_s.first(200), kind: kind,
          value: cell(item[:value], Column.new(key: item[:label], kind: kind), "summary figure #{item[:label]}") }
      end
    end

    # A value as it will travel as JSON. Numbers must be numbers (not "12 h"), so a screen can format them in the company's way.
    def cell(value, column, where)
      return nil if value.nil?
      return numeric(value, column, where) if NUMERIC.include?(column.kind)

      case value
      when Date, Time, DateTime, ActiveSupport::TimeWithZone then value.iso8601
      else value.to_s.scrub.first(MAX_TEXT)
      end
    end

    def numeric(value, column, where)
      number = Float(value, exception: false) unless value.is_a?(String) && value.strip.empty?
      if number.nil? && !value.to_s.strip.empty?
        raise Error, "In #{where}, #{column.key} is #{value.to_s.first(40).inspect}, which is not a number."
      end
      return nil if number.nil? || !number.finite?

      value.is_a?(Integer) ? value : number
    end
  end
end
