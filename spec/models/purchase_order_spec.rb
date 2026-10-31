require "rails_helper"

RSpec.describe PurchaseOrder, type: :model do
  let(:org)  { create(:organization) }
  let(:seal) { create(:part, organization: org, name: "Seal", quantity_on_hand: 4) }
  let(:belt) { create(:part, organization: org, name: "Belt", quantity_on_hand: 0) }
  let(:order) do
    create(:purchase_order, :ordered, organization: org).tap do |po|
      po.lines.destroy_all
      po.lines.create!(part: seal, quantity: 10, unit_cost: 2)
      po.lines.create!(part: belt, quantity: 3)
      po.reload
    end
  end

  it "numbers the company's orders PO-000001, PO-000002... each company counting for itself" do
    first  = create(:purchase_order, organization: org)
    second = create(:purchase_order, organization: org)
    other  = create(:purchase_order)

    expect([first.number, second.number, other.number]).to eq(%w[PO-000001 PO-000002 PO-000001])
  end

  it "needs at least one part, and no part twice" do
    expect(described_class.new(organization: org)).not_to be_valid

    twice = described_class.new(organization: org)
    2.times { twice.lines.build(part: seal, quantity: 1) }
    expect(twice).not_to be_valid
    expect(twice.errors[:lines]).to include("list the same part twice")
  end

  it "refuses a part or a vendor of another company, and a vendor that is switched off" do
    foreign = described_class.new(organization: org)
    foreign.lines.build(part: create(:part), quantity: 1)
    expect(foreign).not_to be_valid

    expect(build(:purchase_order, organization: org, vendor: create(:vendor))).not_to be_valid
    expect(build(:purchase_order, organization: org, vendor: create(:vendor, organization: org, active: false))).not_to be_valid
  end

  it "needs a quantity above zero and a cost that is not negative" do
    line = build(:purchase_order_line, quantity: 0)
    expect(line).not_to be_valid
    expect(build(:purchase_order_line, unit_cost: -1)).not_to be_valid
  end

  it "can be ordered only once a vendor is chosen" do
    expect(create(:purchase_order, :approved, organization: org).may_place_order?).to be(false)
    vendor = create(:vendor, organization: org)
    expect(create(:purchase_order, :approved, organization: org, vendor: vendor).may_place_order?).to be(true)
  end

  describe "#receive!" do
    it "adds what came in to the stock, and stays partly received until everything has come" do
      arrived = order.receive!(order.lines.first.id => "6")

      expect(arrived).to eq([{ part: "Seal", quantity: 6.0 }])
      expect(seal.reload.quantity_on_hand).to eq(10)
      expect(order.reload).to have_attributes(status: "partially_received", received_at: nil)

      order.receive!(order.lines.first.id => "4", order.lines.last.id => "3")
      expect(order.reload).to have_attributes(status: "received")
      expect(order.received_at).to be_present
      expect(seal.reload.quantity_on_hand).to eq(14)
      expect(belt.reload.quantity_on_hand).to eq(3)
    end

    it "refuses more than is still to come, and changes nothing when any line is refused" do
      expect { order.receive!(order.lines.first.id => "5", order.lines.last.id => "4") }
        .to raise_error(ArgumentError, /Belt: only 3.0 still to come/)

      expect(seal.reload.quantity_on_hand).to eq(4)
      expect(order.lines.reload.map(&:quantity_received)).to all(be_zero)
    end

    it "refuses an empty delivery and an order that has not been placed" do
      expect { order.receive!({}) }.to raise_error(ArgumentError, /at least one part/)
      expect { create(:purchase_order, :approved, organization: org).receive!({}) }.to raise_error(ArgumentError, /Cannot receive/)
    end

    it "can be closed with part of it missing" do
      order.receive!(order.lines.first.id => "10")

      expect(order.reload.may_close?).to be(true)
      order.close
      expect(order.status).to eq("received")
    end
  end

  it "cannot be deleted along with a part or vendor it names" do
    order = create(:purchase_order, :ordered, organization: org)

    expect(order.vendor.destroy).to be(false)
    part = order.lines.first.part
    expect(part.destroy).to be(false)
    expect(part.errors.full_messages.first).to match(/used on work orders or purchase orders/)
  end
end
