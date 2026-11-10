require "rails_helper"

RSpec.describe AssetLookup do
  let(:org)   { create(:organization) }
  let(:plant) { create(:location, organization: org, name: "Boiler room") }
  let!(:pump) do
    create(:asset, organization: org, name: "Pump 3", asset_tag: "FF-000042", serial_number: "SN-7788", barcode: "5012345678900",
location: plant)
  end

  def lookup(code, organization = org) = described_class.call(organization, code)

  it "finds an asset by its tag, whatever the case, saying so" do
    expect(lookup("ff-000042")).to eq([{ id: pump.id, name: "Pump 3", asset_tag: "FF-000042", barcode: "5012345678900",
                                         serial_number: "SN-7788", location: "Boiler room", matched_on: ["asset_tag"] }])
  end

  it "finds it by the barcode on the machine, and by its serial number" do
    expect(lookup("5012345678900").sole).to include(id: pump.id, matched_on: ["barcode"])
    expect(lookup("sn-7788").sole).to include(id: pump.id, matched_on: ["serial_number"])
  end

  it "ignores the spaces and line ends a scanner adds" do
    expect(lookup(" 5012345678900\r\n").sole[:id]).to eq(pump.id)
  end

  it "finds it by the link on one of our labels, and by a link to its page" do
    expect(lookup("https://fixflow.example.com/request?asset=#{pump.public_code}").sole).to include(id: pump.id, matched_on: ["label"])
    expect(lookup("https://fixflow.example.com/assets/#{pump.id}").sole).to include(id: pump.id, matched_on: ["link"])
    expect(lookup("fixflow://assets/#{pump.id}/FF-000042").sole).to include(id: pump.id, matched_on: ["link"])
  end

  it "does not match a part of a code" do
    expect(lookup("50123456789")).to be_empty
    expect(lookup("FF-00004")).to be_empty
  end

  it "says nothing found for an empty code, a very long one, and one nobody has" do
    expect(lookup("")).to be_empty
    expect(lookup("   ")).to be_empty
    expect(lookup(nil)).to be_empty
    expect(lookup("x" * 501)).to be_empty
    expect(lookup("NOPE")).to be_empty
  end

  it "lists every asset that has the code, nearest the top by name, and says which field matched" do
    twin = create(:asset, organization: org, name: "Pump 1", serial_number: "FF-000042")

    expect(lookup("FF-000042").map { |match| [match[:name], match[:matched_on]] })
      .to eq([["Pump 1", ["serial_number"]], ["Pump 3", ["asset_tag"]]])
    expect(twin).to be_persisted
  end

  it "lists an asset once when the code is in two of its fields" do
    both = create(:asset, organization: org, name: "Both", asset_tag: "SAME-1", barcode: "same-1")

    expect(lookup("SAME-1").sole).to include(id: both.id, matched_on: %w[asset_tag barcode])
  end

  it "shows at most 10" do
    create_list(:asset, 11, organization: org, serial_number: "DUP")

    expect(lookup("DUP").size).to eq(10)
  end

  it "does not find another company's asset, an asset that is put away, or a label link of either" do
    other = create(:asset, barcode: "5012345678900")

    expect(lookup("5012345678900", other.organization).sole[:id]).to eq(other.id)
    expect(lookup("https://x.test/request?asset=#{other.public_code}")).to be_empty
    expect(lookup("https://x.test/assets/#{other.id}")).to be_empty

    pump.discard!
    expect(lookup("FF-000042")).to be_empty
    expect(lookup("https://x.test/request?asset=#{pump.public_code}")).to be_empty
  end

  it "reads % and _ in a code as plain characters" do
    create(:asset, organization: org, asset_tag: "AB_CD")

    expect(lookup("AB_CD").size).to eq(1)
    expect(lookup("AB%")).to be_empty
    expect(lookup("A_")).to be_empty
  end
end
