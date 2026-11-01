require "rails_helper"

RSpec.describe HasCustomValues do
  let(:org) { create(:organization) }
  let!(:centre) { create(:custom_field, organization: org, label: "Cost centre") }
  let!(:risk)   { create(:custom_field, :select, organization: org, label: "Risk") }
  let(:order)   { create(:work_order, organization: org) }

  before { create(:custom_field, :number, organization: org, label: "Budget") }

  def problems(record) = record.tap(&:valid?).errors.full_messages

  it "starts empty" do
    expect(order.custom_values).to eq({})
  end

  describe "setting values" do
    it "keeps them in the form their field stores them" do
      order.update!(custom_values: { "cost_centre" => "  CC-7 ", "budget" => "1500.50", "risk" => "High" })

      expect(order.reload.custom_values).to eq("cost_centre" => "CC-7", "budget" => 1500.5, "risk" => "High")
    end

    it "changes only the fields it is given" do
      order.update!(custom_values: { "cost_centre" => "CC-7", "budget" => 10 })
      order.update!(custom_values: { "budget" => 20 })

      expect(order.reload.custom_values).to eq("cost_centre" => "CC-7", "budget" => 20)
    end

    it "clears a field that is given empty, and one given nothing" do
      order.update!(custom_values: { "cost_centre" => "CC-7", "budget" => 10, "risk" => "Low" })
      order.update!(custom_values: { "cost_centre" => "", "budget" => nil, "risk" => "  " })

      expect(order.reload.custom_values).to eq({})
    end

    it "accepts parameters from a request" do
      order.update!(custom_values: ActionController::Parameters.new("cost_centre" => "CC-9").permit!)

      expect(order.reload.custom_values).to eq("cost_centre" => "CC-9")
    end

    it "treats something that is not a set of values as nothing" do
      order.update!(custom_values: "cost_centre")

      expect(order.reload.custom_values).to eq({})
    end
  end

  describe "refusing" do
    it "a value its field cannot take, naming the field" do
      order.custom_values = { "budget" => "lots", "risk" => "Extreme" }

      expect(problems(order)).to contain_exactly("Budget must be a number", "Risk must be one of: Low, Medium, High")
    end

    it "a field the company does not have" do
      order.custom_values = { "colour" => "red" }

      expect(problems(order)).to eq(["There is no custom field “colour”"])
    end

    it "a field that is turned off" do
      centre.update!(active: false)
      order.custom_values = { "cost_centre" => "CC-1" }

      expect(problems(order)).to eq(["Cost centre is turned off"])
    end

    it "another company's field" do
      other = create(:custom_field, label: "Elsewhere")
      order.custom_values = { other.key => "x" }

      expect(problems(order)).to eq(["There is no custom field “#{other.key}”"])
    end

    it "a part's field on a work order" do
      create(:custom_field, :part, organization: org, label: "Shelf")
      order.custom_values = { "shelf" => "A1" }

      expect(problems(order)).to eq(["There is no custom field “shelf”"])
    end
  end

  describe "a value that is already there" do
    before { order.update!(custom_values: { "cost_centre" => "CC-7", "risk" => "High" }) }

    it "never blocks another change, even when its field has since changed or been turned off" do
      risk.update!(options: %w[Low])
      centre.update!(active: false)

      order.reload
      expect(order.update(title: "New title", status: "assigned")).to be(true)
    end

    it "is not checked again when a form sends it back unchanged, even though it would no longer be accepted" do
      risk.update!(options: %w[Low])
      centre.update!(active: false)
      order.reload
      order.require_custom_values = true
      order.custom_values = { "risk" => "High", "cost_centre" => "CC-7", "budget" => 5 }

      expect(order).to be_valid
      order.custom_values = { "risk" => "Extreme" }
      expect(order).not_to be_valid
    end

    it "is checked again when it is the one that changes" do
      risk.update!(options: %w[Low])

      expect(order.reload.update(custom_values: { "risk" => "High" })).to be(true)
      expect(order.update(custom_values: { "risk" => "Medium" })).to be(false)
    end
  end

  describe "a required field" do
    before { centre.update!(required: true) }

    it "is not demanded just because a value is being set, only where a form asks for it" do
      order.custom_values = { "budget" => 5 }

      expect(order).to be_valid
    end

    it "is not demanded of work that nobody fills a form in for" do
      expect(build(:work_order, organization: org)).to be_valid
      expect(order.update(title: "Changed")).to be(true)
    end

    it "is demanded where a form is filled in" do
      record = build(:work_order, organization: org)
      record.require_custom_values = true

      expect(problems(record)).to eq(["Cost centre is required"])
      record.custom_values = { "cost_centre" => "CC-1" }
      expect(record).to be_valid
    end

    it "is not demanded while it is turned off" do
      centre.update!(active: false)
      record = build(:work_order, organization: org)
      record.require_custom_values = true

      expect(record).to be_valid
    end

    it "cannot be left empty by clearing it" do
      order.update!(custom_values: { "cost_centre" => "CC-1" })
      order.require_custom_values = true
      order.custom_values = { "cost_centre" => "" }

      expect(problems(order)).to eq(["Cost centre is required"])
    end
  end

  describe "on a part" do
    before { create(:custom_field, :part, organization: org, label: "Shelf") }

    it "uses the part's fields only" do
      part = create(:part, organization: org, custom_values: { "shelf" => "A1" })

      expect(part.reload.custom_values).to eq("shelf" => "A1")
      part.custom_values = { "cost_centre" => "x" }
      expect(problems(part)).to eq(["There is no custom field “cost_centre”"])
    end
  end

  describe "#custom_field_keys_changed" do
    it "names the fields the last save changed, and nothing when none did" do
      order.update!(custom_values: { "cost_centre" => "CC-7", "budget" => 10 })
      order.update!(custom_values: { "cost_centre" => "CC-7", "budget" => 20, "risk" => "Low" })
      expect(order.custom_field_keys_changed).to contain_exactly("budget", "risk")

      order.update!(title: "Other")
      expect(order.custom_field_keys_changed).to be_nil
    end
  end
end
