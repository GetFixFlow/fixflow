require "rails_helper"

RSpec.describe CsvImport::Parts do
  let(:org)      { create(:organization) }
  let(:importer) { CsvImport::Base.for("parts", org) }
  let!(:stores)  { create(:location, organization: org, name: "Stores") }

  def messages(result) = result.errors.map { |e| [e.row, e.column, e.message] }

  it "brings in parts with their stock, reorder point, cost and place" do
    importer.import!("name,sku,quantity_on_hand,reorder_point,unit,unit_cost,location\nOil filter,OF-100,12,3,each,12.50,Stores\n")

    expect(org.parts.first).to have_attributes(
      name: "Oil filter", sku: "OF-100", quantity_on_hand: 12, reorder_point: 3, unit: "each", unit_cost: 12.5, location: stores
    )
  end

  it "fills in the usual things when they are left out" do
    importer.import!("name\nGasket\n")

    expect(org.parts.first).to have_attributes(sku: nil, quantity_on_hand: 0, reorder_point: 0, unit: "each", unit_cost: nil,
location: nil)
  end

  it "reads a decimal comma but not a thousands separator, which would be ambiguous" do
    importer.import!("name;unit_cost\nA;12,5\n")
    expect(org.parts.first.unit_cost).to eq(12.5)

    result = importer.preview("name,unit_cost\nB,\"1,234.50\"\n")
    expect(messages(result).first.last).to include('"1,234.50" is not a number')
  end

  it "reports what is not a number, and what is negative, naming the column" do
    result = importer.preview("name,quantity_on_hand,reorder_point,unit_cost\nA,lots,2,5\nB,3,-1,5\nC,3,2,free\n")

    expect(messages(result).map { |row, column, _|
      [row, column]
    }).to eq([[2, "quantity_on_hand"], [3, "reorder_point"], [4, "unit_cost"]])
    expect(messages(result)[1].last).to eq("This cannot be negative.")
  end

  it "refuses a SKU that is repeated in the file or already used, whatever its case" do
    create(:part, organization: org, sku: "OF-100")

    result = importer.preview("name,sku\nA,of-100\nB,N-1\nC,n-1\n")

    expect(messages(result)).to eq([
      [2, "sku", 'A part with the SKU "of-100" already exists.'],
      [4, "sku", 'The SKU "n-1" is also on row 3.']
    ])
  end

  it "lets any number of parts have no SKU" do
    expect(importer.preview("name,sku\nA,\nB,\nC,\n")).to be_valid
  end

  it "does not count another company's parts" do
    create(:part, sku: "OF-100")

    expect(importer.preview("name,sku\nA,OF-100\n")).to be_valid
  end

  it "reports a place that does not exist" do
    expect(messages(importer.preview("name,location\nA,Cellar\n")).first.last).to include('No location is called "Cellar"')
  end
end
