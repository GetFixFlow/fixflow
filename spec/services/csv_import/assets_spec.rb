require "rails_helper"

RSpec.describe CsvImport::Assets do
  let(:org)      { create(:organization) }
  let(:importer) { CsvImport::Base.for("assets", org) }
  let!(:plant)   { create(:location, organization: org, name: "Plant") }
  let!(:floor)   { create(:location, organization: org, name: "Floor 1", parent: plant) }
  let!(:stores)  { create(:location, organization: org, name: "Stores", parent: plant) }

  def messages(result) = result.errors.map { |e| [e.row, e.column, e.message] }

  it "brings assets in with their place, status and tag" do
    importer.import!("name,asset_tag,serial_number,status,location\nPump 1,P-001,SN-1,degraded,Plant > Floor 1\nFan,,,,Stores\n")

    pump, fan = org.assets.order(:id)
    expect(pump).to have_attributes(name: "Pump 1", asset_tag: "P-001", serial_number: "SN-1", status: "degraded", location: floor)
    expect(fan).to have_attributes(status: "operational", location: stores)
    expect(fan.asset_tag).to match(/\AFF-\d{6}\z/) # made up as usual when the file has none
  end

  it "finds a place by its full path or, when only one has that name, by the name alone, ignoring case and spacing" do
    result = importer.import!("name,location\nA,plant>floor 1\nB,  STORES \nC,Plant\n")

    expect(result).to be_valid
    expect(org.assets.order(:id).map(&:location)).to eq([floor, stores, plant])
  end

  it "keeps any other column as a custom field, and says which ones" do
    csv = "name,manufacturer,model,year\nPump 1,Grundfos,CM5-6,2021\nFan,,,\n"
    result = importer.import!(csv)

    expect(org.assets.order(:id).first.custom_fields).to eq("manufacturer" => "Grundfos", "model" => "CM5-6", "year" => "2021")
    expect(org.assets.order(:id).last.custom_fields).to eq({})
    expect(result.columns).to eq(known: ["name"], custom: %w[manufacturer model year])
  end

  describe "problems, named by row and column" do
    it "reports an empty name, a status that does not exist, and a place that does not exist" do
      result = importer.preview("name,status,location\nPump,working,Plant\n,operational,Plant\nFan,operational,Basement\n")

      expect(messages(result)).to eq([
        [2, "status", '"working" is not a status. Use one of: operational, degraded, down, decommissioned.'],
        [3, "name", "The name is empty."],
        [4, "location", 'No location is called "Basement". Add it first (import locations), or check the spelling.']
      ])
    end

    it "asks for the full path when a name is shared by two places" do
      other_plant = create(:location, organization: org, name: "Annex")
      create(:location, organization: org, name: "Stores", parent: other_plant)

      result = importer.preview("name,location\nPump,Stores\nFan,Annex > Stores\n")

      shared = 'More than one location is called "Stores". Use its full path, such as "Plant > Floor 1 > Stores".'
      expect(messages(result)).to eq([[2, "location", shared]])
    end

    it "refuses a tag that is used twice in the file, saying where the other one is" do
      result = importer.preview("name,asset_tag\nA,T-1\nB,t-1\n")

      expect(messages(result)).to eq([[3, "asset_tag", 'The tag "t-1" is also on row 2.']])
    end

    it "refuses a tag that already belongs to an asset, whatever its case" do
      create(:asset, organization: org, asset_tag: "P-001")

      expect(messages(importer.preview("name,asset_tag\nA,p-001\n"))).to eq([[2, "asset_tag",
                                                                              'An asset with the tag "p-001" already exists.']])
    end

    it "does not count another company's assets or places" do
      create(:asset, asset_tag: "P-001")
      create(:location, name: "Elsewhere")

      expect(importer.preview("name,asset_tag,location\nA,P-001,Plant\n")).to be_valid
      expect(importer.preview("name,location\nA,Elsewhere\n")).not_to be_valid
    end

    it "lists every problem in one go, not just the first" do
      result = importer.preview("name,status\n,bad\n,bad\n")

      expect(result.errors.size).to eq(4)
    end

    it "creates nothing when any row has a problem" do
      importer.import!("name,status\nGood,operational\nBad,nonsense\n")

      expect(org.assets.count).to eq(0)
    end
  end
end
