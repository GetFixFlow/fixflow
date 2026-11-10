require "rails_helper"

RSpec.describe Asset, type: :model do
  let(:org) { create(:organization) }

  def asset(**attrs) = build(:asset, organization: org, **attrs)

  describe "barcode" do
    it "is optional, and empty means none" do
      expect(asset(barcode: nil)).to be_valid
      expect(create(:asset, organization: org, barcode: "   ").barcode).to be_nil
    end

    it "is tidied: spaces and control characters from a scanner are dropped" do
      expect(create(:asset, organization: org, barcode: "  5012345678900\r\n").barcode).to eq("5012345678900")
      expect(create(:asset, organization: org, barcode: "AB\u0000C").barcode).to eq("ABC")
    end

    it "is at most 64 characters" do
      expect(asset(barcode: "x" * 64)).to be_valid
      expect(asset(barcode: "x" * 65)).not_to be_valid
    end

    describe "uniqueness" do
      before { create(:asset, organization: org, barcode: "ABC-123") }

      it "refuses the same barcode on another asset in the company, whatever the case" do
        other = asset(barcode: "abc-123")

        expect(other).not_to be_valid
        expect(other.errors[:barcode]).to eq(["is already on another asset"])
      end

      it "allows it in another company" do
        expect(build(:asset, barcode: "ABC-123")).to be_valid
      end

      it "allows it once the asset that had it is put away" do
        org.assets.find_by(barcode: "ABC-123").discard!

        expect(asset(barcode: "ABC-123")).to be_valid
      end

      it "lets a put-away asset be saved again though another asset now has its barcode" do
        old = org.assets.find_by(barcode: "ABC-123")
        old.discard!
        create(:asset, organization: org, barcode: "ABC-123")

        expect(old.reload.update(name: "Old pump")).to be(true)
      end

      it "lets an asset keep its own barcode when it is saved again" do
        mine = org.assets.find_by(barcode: "ABC-123")

        expect(mine.update(name: "Renamed")).to be(true)
      end

      it "is held by the database as well" do
        twin = asset(barcode: "ABC-123")

        expect { twin.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
      end
    end

    describe ".search_by_name_or_tag" do
      let!(:pump) { create(:asset, organization: org, name: "Pump", serial_number: "SN-7788", barcode: "5012345678900") }

      it "also finds by serial number and by barcode, in part" do
        expect(org.assets.search_by_name_or_tag("7788")).to eq([pump])
        expect(org.assets.search_by_name_or_tag("567890")).to eq([pump])
      end

      it "treats % and _ as plain characters" do
        create(:asset, organization: org, name: "Fan")

        expect(org.assets.search_by_name_or_tag("%")).to be_empty
      end
    end
  end
end
