require "rails_helper"

RSpec.describe CustomField, type: :model do
  let(:org) { create(:organization) }

  def field(**attrs) = build(:custom_field, organization: org, **attrs)

  describe "the key" do
    it "is made from the label, once" do
      created = create(:custom_field, organization: org, label: "  Cost   centre ")

      expect(created).to have_attributes(label: "Cost centre", key: "cost_centre")
      created.update!(label: "Cost code")
      expect(created.key).to eq("cost_centre")
    end

    it "cannot be given to two fields of one kind of record in a company, but a part can have it too" do
      create(:custom_field, organization: org, label: "Cost centre")

      expect(field(label: "Cost-Centre")).not_to be_valid
      expect(field(label: "Cost centre", entity: "part")).to be_valid
      expect(build(:custom_field, label: "Cost centre")).to be_valid
    end

    it "is made up when the label has no Latin letters in it" do
      expect(create(:custom_field, organization: org, label: "කොටස").key).to match(/\Afield_\h{6}\z/)
    end

    it "needs a label" do
      expect(field(label: "")).not_to be_valid
      expect(field(label: "x" * 61)).not_to be_valid
    end
  end

  it "takes only the kinds it knows" do
    expect(field(kind: "photo")).not_to be_valid
    CustomField::KINDS.each { |kind| expect(field(kind: kind, options: %w[a])).to be_valid }
  end

  describe "what cannot change" do
    it "keeps its kind, its key and its record type once made" do
      created = create(:custom_field, organization: org)

      expect(created.update(kind: "number")).to be(false)
      expect(created.errors[:kind]).to be_present
      expect(created.reload.update(entity: "part")).to be(false)
      expect(created.reload.update(key: "other")).to be(false)
    end
  end

  describe "choices" do
    it "are needed for a choice list, tidied and not repeated" do
      expect(field(kind: "select", options: [])).not_to be_valid

      list = create(:custom_field, organization: org, kind: "select", options: [" Low ", "", "Low", "High"])
      expect(list.options).to eq(%w[Low High])
    end

    it "are dropped from any other kind" do
      expect(create(:custom_field, organization: org, kind: "text", options: %w[a b]).options).to eq([])
    end

    it "are limited" do
      expect(field(kind: "select", options: (1..51).map(&:to_s))).not_to be_valid
      expect(field(kind: "select", options: ["x" * 101])).not_to be_valid
    end
  end

  it "does not let a yes/no box be required" do
    expect(field(kind: "checkbox", required: true)).not_to be_valid
  end

  it "is limited to 20 for each kind of record" do
    create_list(:custom_field, 20, organization: org)

    expect(field).not_to be_valid
    expect(field(entity: "part")).to be_valid
  end

  describe "#cast" do
    it "trims text and refuses what is too long" do
      text = field(kind: "text")

      expect(text.cast("  hello ")).to eq("hello")
      expect { text.cast("x" * 501) }.to raise_error(ArgumentError, /too long/)
      expect { text.cast(5) }.to raise_error(ArgumentError)
    end

    it "reads numbers from numbers and from digits, and keeps whole ones whole" do
      number = field(kind: "number")

      expect(number.cast("12")).to eq(12)
      expect(number.cast(12.5)).to eq(12.5)
      expect(number.cast(" -3.25 ")).to eq(-3.25)
      expect(number.cast("12")).to be_a(Integer)
    end

    it "refuses what is not a number, not finite or enormous" do
      number = field(kind: "number")

      ["abc", "12abc", "NaN", "Infinity", "1e30", true, [1]].each do |value|
        expect { number.cast(value) }.to raise_error(ArgumentError), value.inspect
      end
    end

    it "takes dates in ISO form and refuses the rest" do
      date = field(kind: "date")

      expect(date.cast("2026-11-01")).to eq("2026-11-01")
      expect { date.cast("11/01/2026") }.to raise_error(ArgumentError)
      expect { date.cast("2026-02-30") }.to raise_error(ArgumentError)
    end

    it "takes one of the choices" do
      list = field(kind: "select", options: %w[Low High])

      expect(list.cast(" High ")).to eq("High")
      expect { list.cast("Medium") }.to raise_error(ArgumentError, /Low, High/)
    end

    it "takes yes or no" do
      box = field(kind: "checkbox")

      expect([box.cast(true), box.cast("true"), box.cast(false), box.cast("FALSE")]).to eq([true, true, false, false])
      expect { box.cast("maybe") }.to raise_error(ArgumentError)
    end

    it "treats an empty value as no value, for every kind" do
      %w[text number date checkbox].each { |kind| expect(field(kind: kind).cast("  ")).to be_nil }
      expect(field(kind: "text").cast(nil)).to be_nil
    end
  end

  describe "#display" do
    it "writes a yes/no box as Yes or No, and nothing as nothing" do
      box = field(kind: "checkbox")

      expect([box.display(true), box.display(false), box.display(nil)]).to eq(["Yes", "No", ""])
      expect(field(kind: "number").display(12)).to eq("12")
    end
  end

  it "is written to the audit log" do
    created = create(:custom_field, organization: org)

    expect(ActivityLog.where(action: "custom_field.created", resource_id: created.id)).to exist
  end
end
