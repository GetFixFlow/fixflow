require "rails_helper"

RSpec.describe Ai::AssetMatcher do
  let(:org) { create(:organization) }
  let(:third_line) { create(:location, organization: org, name: "Line 3") }
  let(:fourth_line) { create(:location, organization: org, name: "Line 4") }

  def asset(name, location: nil, tag: nil, **attributes)
    create(:asset, organization: org, name: name, location: location, asset_tag: tag, **attributes)
  end

  def names(text) = described_class.for(org, text).map { |match| match.asset.name }

  it "finds the assets whose name has the words, the best first" do
    asset("Coolant pump", location: third_line)
    asset("Hydraulic pump", location: fourth_line)
    asset("Conveyor", location: third_line)

    expect(names("pump on line 3 is leaking oil")).to eq(["Coolant pump", "Hydraulic pump"])
  end

  it "counts the tag more than the name" do
    by_name = asset("Pump 1")
    by_tag = asset("Fan", tag: "PUMP-9")

    expect(described_class.for(org, "pump").map(&:asset)).to eq([by_tag, by_name])
  end

  it "leaves out an asset found only by its place when others are found by name or tag" do
    asset("Conveyor", location: create(:location, organization: org, name: "Pump house"))
    named = asset("Pump 1")

    expect(described_class.for(org, "pump").map(&:asset)).to eq([named])
  end

  it "offers the assets of a place when nothing is found by name or tag, the one with more of the words first" do
    near = asset("Zebra conveyor", location: third_line)
    far = asset("Oven", location: fourth_line)

    expect(described_class.for(org, "something on line 3 is noisy").map(&:asset)).to eq([near, far]) # not just by name
  end

  it "counts a short word like the 3 of line 3 only for an asset something longer has matched" do
    asset("Fan 3")
    asset("Fan 30")
    asset("Coolant pump", location: third_line)

    expect(names("pump on line 3")).to eq(["Coolant pump"])
    expect(names("check the 3")).to eq([])
  end

  it "says where each one is, and why it ranked" do
    asset("Coolant pump", location: third_line)

    match = described_class.for(org, "pump").first

    expect(match).to have_attributes(path: "Line 3", score: 3, named: true)
  end

  it "matches the start of a word, case aside, and not the middle of one" do
    asset("Pump 3")
    asset("Heatpump unit")

    expect(names("PUMP")).to eq(["Pump 3"])
  end

  it "does not offer an asset that has the letters of a word in the middle of one of its own, when nothing else matches" do
    asset("Heatpump unit")

    expect(names("pump")).to eq([])
  end

  it "does not let a word like \"the\" bring in an asset that has it in its name" do
    asset("The old boiler")
    asset("Pump 3")

    expect(names("the pump is fine")).to eq(["Pump 3"])
  end

  it "finds an asset by its tag, and by a number that is a word of its name" do
    asset("Chiller", tag: "CH-007")
    asset("Line 3 oven")
    asset("Line 13 oven")

    expect(names("ch-007 is warm")).to eq(["Chiller"])
    ranked = described_class.for(org, "oven on line 3")
    expect(ranked.map { |match| match.asset.name }).to eq(["Line 3 oven", "Line 13 oven"])
    expect(ranked.first.score).to be > ranked.last.score # the "3" is a word of only one of them
  end

  it "ignores words that say nothing about which machine it is, in English and in Spanish" do
    asset("Pump 3")

    expect(names("the is and a to")).to eq([])
    expect(names("la bomba tiene una falla")).to eq([])
  end

  it "says nothing when no asset has any of the words, or there are no words" do
    asset("Pump 3")

    expect(names("zzzz qqqq")).to eq([])
    expect(names("")).to eq([])
    expect(names(nil)).to eq([])
  end

  it "gives at most ten, from the company's own assets that are still in use" do
    12.times { |n| asset("Pump #{n}") }
    asset("Pump 000 retired").discard
    create(:asset, name: "Pump of another company")

    found = names("pump")

    expect(found.size).to eq(10)
    expect(found).not_to include("Pump 000 retired", "Pump of another company")
  end

  it "is not undone by characters that mean something to the database" do
    asset("Pump (3)")
    asset("Pump 4")

    expect { names("pump (3) .* [x] \\ ' \"; drop table assets;--") }.not_to raise_error
    expect(names("pump (3) .* [x]")).to include("Pump (3)")
    expect(Asset.count).to eq(2)
  end

  it "looks only at the first dozen words" do
    asset("Zeta")
    text = "#{(1..12).map { |n| "word#{n}" }.join(' ')} zeta"

    expect(names(text)).to eq([])
  end
end
