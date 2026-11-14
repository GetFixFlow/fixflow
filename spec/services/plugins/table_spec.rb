require "rails_helper"

RSpec.describe Plugins::Table do
  let(:columns) { [{ key: "name", label: "Name" }, { key: "hours", label: "Hours", kind: "number" }] }

  def build(**parts) = described_class.build({ columns: columns, rows: [] }.merge(parts))

  it "keeps columns, rows and summary in the shape the screen and the CSV use" do
    table = build(rows: [{ "name" => "Pump 3", "hours" => 4.5 }, { name: "Fan", hours: 2 }],
                  summary: [{ label: "Total", value: 6.5, kind: "number" }], note: "Hours are rounded.")

    expect(table.as_json).to eq(
      columns: [{ key: "name", label: "Name", kind: "text" }, { key: "hours", label: "Hours", kind: "number" }],
      rows: [["Pump 3", 4.5], ["Fan", 2]],
      summary: [{ label: "Total", kind: "number", value: 6.5 }],
      note: "Hours are rounded."
    )
  end

  it "takes rows as lists, in the order of the columns" do
    expect(build(rows: [["Pump", 1]]).rows).to eq([["Pump", 1]])
  end

  it "leaves a missing value empty and labels a column by its key when no label is given" do
    table = described_class.build(columns: [{ key: "open_orders" }], rows: [{}])

    expect(table.rows).to eq([[nil]])
    expect(table.columns.first.label).to eq("Open orders")
  end

  it "turns dates, times and numbers into what travels as JSON" do
    table = described_class.build(columns: [{ key: "d", kind: "date" }, { key: "m", kind: "money" }, { key: "t" }],
                                  rows: [[Date.new(2026, 11, 3), BigDecimal("12.50"), Time.utc(2026, 11, 3, 8, 30)]])

    expect(table.rows).to eq([["2026-11-03", 12.5, "2026-11-03T08:30:00Z"]])
  end

  it "reads a number given as text (what a database may give) and rejects one that is not a number" do
    expect(build(rows: [["Pump", "4.5"]]).rows).to eq([["Pump", 4.5]])
    expect { build(rows: [["Pump", "4 hours"]]) }.to raise_error(Plugins::Error, /row 1.*hours.*"4 hours".*not a number/)
  end

  it "turns a number that is not finite into an empty cell" do
    expect(build(rows: [["Pump", Float::NAN], ["Fan", Float::INFINITY]]).rows).to eq([["Pump", nil], ["Fan", nil]])
  end

  it "keeps a whole number whole" do
    expect(build(rows: [["Pump", 3]]).rows.first.last).to be_a(Integer)
  end

  describe "refuses, in words the plugin's author can act on," do
    it "something that is not a table" do
      expect { described_class.build([1, 2]) }.to raise_error(Plugins::Error, /must return a Hash/)
    end

    it "no columns" do
      expect { described_class.build(rows: []) }.to raise_error(Plugins::Error, "The report has no columns.")
    end

    it "a column with no key" do
      expect { described_class.build(columns: [{ label: "x" }]) }.to raise_error(Plugins::Error, "Column 1 has no key.")
    end

    it "a column key used twice" do
      expect {
        described_class.build(columns: [{ key: "a" }, { key: "a" }])
      }.to raise_error(Plugins::Error, 'Column key "a" is used twice.')
    end

    it "a column of an unknown kind" do
      expect {
        described_class.build(columns: [{ key: "a", kind: "currency" }])
      }.to raise_error(Plugins::Error, /unknown kind "currency"/)
    end

    it "more columns than are allowed" do
      many = Array.new(31) { |i| { key: "c#{i}" } }

      expect { described_class.build(columns: many) }.to raise_error(Plugins::Error, /31 columns; at most 30/)
    end

    it "more rows than are allowed" do
      expect { build(rows: Array.new(10_001) { ["a", 1] }) }.to raise_error(Plugins::Error, /10001 rows; at most 10000/)
    end

    it "a list row of the wrong length" do
      expect { build(rows: [["only one"]]) }.to raise_error(Plugins::Error, "Row 1 has 1 values for 2 columns.")
    end

    it "a summary figure without a label, of an unknown kind, or too many of them" do
      expect { build(summary: [{ value: 1 }]) }.to raise_error(Plugins::Error, /no label/)
      expect { build(summary: [{ label: "x", kind: "huge" }]) }.to raise_error(Plugins::Error, /unknown kind/)
      expect { build(summary: Array.new(13) { { label: "x" } }) }.to raise_error(Plugins::Error, /at most 12/)
    end
  end

  describe "#csv" do
    def parse(csv) = CSV.parse(csv.delete_prefix(ExportService::BYTE_ORDER_MARK))

    it "is a spreadsheet file with the labels as the first line, opening cleanly in Excel" do
      csv = build(rows: [["Pump 3", 4.5]]).csv

      expect(csv).to start_with(ExportService::BYTE_ORDER_MARK)
      expect(parse(csv)).to eq([%w[Name Hours], ["Pump 3", "4.5"]])
    end

    it "keeps text that starts like a formula as text, because whoever reports a problem chooses what a cell says" do
      csv = build(rows: [["=HYPERLINK(\"http://evil.test\")", 1]]).csv

      expect(parse(csv).last.first).to start_with("'=")
    end
  end
end
