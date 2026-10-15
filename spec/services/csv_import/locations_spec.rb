require "rails_helper"

RSpec.describe CsvImport::Locations do
  let(:org)      { create(:organization) }
  let(:importer) { CsvImport::Base.for("locations", org) }

  def messages(result) = result.errors.map { |e| [e.row, e.column, e.message] }

  it "builds a whole site, each row able to sit under one made earlier in the same file" do
    importer.import!("name,type,parent\nPlant,site,\nFloor 1,floor,Plant\nLine 2,zone,Plant > Floor 1\nStores,room,Plant\n")

    expect(org.locations.map(&:full_path)).to contain_exactly("Plant", "Plant > Floor 1", "Plant > Floor 1 > Line 2", "Plant > Stores")
    expect(org.locations.find_by(name: "Line 2")).to have_attributes(location_type: "zone")
  end

  it "puts new places under ones that already exist" do
    plant = create(:location, organization: org, name: "Plant")

    importer.import!("name,parent\nFloor 1,Plant\n")

    expect(org.locations.find_by(name: "Floor 1").parent).to eq(plant)
  end

  it "gives a top-level place the type site and anything below one the type zone, unless told" do
    importer.import!("name,type,parent\nPlant,,\nArea,,Plant\nHall,building,Plant\n")

    expect(org.locations.pluck(:name,
:location_type)).to contain_exactly(["Plant", "site"], ["Area", "zone"], ["Hall", "building"])
  end

  it "reports a parent that does not exist, a type it does not know, and a name that is already taken" do
    create(:location, organization: org, name: "Plant")

    result = importer.preview("name,type,parent\nFloor 1,floor,Factory\nHall,castle,Plant\nPlant,site,\n")

    expect(messages(result)).to eq([
      [2, "parent", 'No location is called "Factory". Add it first (import locations), or check the spelling.'],
      [3, "type", '"castle" is not a type. Use one of: site, building, floor, zone, room, outdoor.'],
      [4, "name", '"Plant" already exists.']
    ])
  end

  it "refuses the same place twice in one file" do
    result = importer.preview("name,parent\nPlant,\nFloor 1,Plant\nFloor 1,Plant\n")

    expect(messages(result)).to eq([[4, "name", '"Plant > Floor 1" already exists.']])
  end

  it "allows the same name under different parents" do
    expect(importer.preview("name,parent\nPlant,\nAnnex,\nStores,Plant\nStores,Annex\n")).to be_valid
  end

  it "refuses a name with the path separator in it" do
    expect(messages(importer.preview("name\nA > B\n")).first.last).to include("cannot contain")
  end

  it "does not let a row sit under a place whose own row had a problem" do
    result = importer.preview("name,type,parent\nPlant,castle,\nFloor 1,floor,Plant\n")

    expect(result.errors.map(&:row)).to eq([2, 3])
  end

  it "creates nothing when any row has a problem" do
    importer.import!("name,parent\nPlant,\nFloor 1,Nowhere\n")

    expect(org.locations.count).to eq(0)
  end
end
