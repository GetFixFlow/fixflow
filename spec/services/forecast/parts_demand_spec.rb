require "rails_helper"

RSpec.describe Forecast::PartsDemand do
  let(:org)  { create(:organization) }
  let(:now)  { Time.zone.parse("2026-11-15 12:00") }
  let(:work_order) { create(:work_order, organization: org) }

  # The parts logged `days_ago` days before now, one entry per number of units.
  def use(part, quantities, days_ago:)
    Array(quantities).each_with_index do |quantity, index|
      create(:work_order_part, work_order: work_order, part: part, quantity_used: quantity,
                               created_at: now - (days_ago.is_a?(Array) ? days_ago[index] : days_ago).days)
    end
  end

  # The company has logged parts for `days` days (there must be some history for any part to be judged).
  def history(days)
    use(create(:part, organization: org, name: "Old marker"), 1, days_ago: days)
  end

  def rows(**_options) = described_class.for(org, now: now)

  def row_for(name) = rows.find { |row| row.part.name == name }

  # An order for `quantity` belts in the given state, with `received` of them in so far.
  def order(status, quantity, received: 0)
    create(:purchase_order, organization: org, status: status.to_s).tap do |made|
      made.lines.first.update!(part: Part.find_by!(name: "Belt"), quantity: quantity, quantity_received: received)
    end
  end

  describe "a part used steadily" do
    let(:belt) { create(:part, organization: org, name: "Belt", quantity_on_hand: 4, reorder_point: 2) }

    before do
      history(185)
      # 4 a month for six months
      use(belt, [2, 2], days_ago: [5, 20])
      use(belt, [2, 2], days_ago: [35, 50])
      use(belt, [2, 2], days_ago: [65, 80])
      use(belt, [2, 2], days_ago: [95, 110])
      use(belt, [2, 2], days_ago: [125, 140])
      use(belt, [2, 2], days_ago: [155, 170])
    end

    it "expects what has been used, with a range, and says what it rests on" do
      row = row_for("Belt")

      expect(row.expected).to be_within(0.01).of(4.0)
      expect(row.low).to be < row.expected
      expect(row.high).to be > row.expected
      expect(row.high - row.expected).to be >= (Math.sqrt(4) * 1.28) - 0.01 # never calmer than chance use
      expect(row).to have_attributes(periods: 6, uses: 12, used: 4)
    end

    it "is short when stock and what is on order do not cover the expected use" do
      belt.update!(quantity_on_hand: 3)

      row = row_for("Belt")

      expect(row.status).to eq("short")
      expect(row.days_of_stock).to eq(22.5)
      expect(row.suggested_quantity).to be >= 4
    end

    it "is tight when it covers the expected use but not the high end of the range" do
      belt.update!(quantity_on_hand: 5)

      expect(row_for("Belt").status).to eq("tight")
    end

    it "is fine when it covers the high end too, and then suggests nothing" do
      belt.update!(quantity_on_hand: 50)

      expect(row_for("Belt")).to have_attributes(status: "ok", suggested_quantity: 0)
    end

    it "counts what is on order and has not come in, and nothing else" do
      belt.update!(quantity_on_hand: 1)
      order(:ordered, 10, received: 4)
      order(:requested, 100)
      order(:received, 100, received: 100)

      row = row_for("Belt")

      expect(row.on_order).to eq(6)
      expect(row.on_hand).to eq(1)
    end

    it "puts the parts that may run short first" do
      create(:part, organization: org, name: "Plenty", quantity_on_hand: 500).tap do |plenty|
        use(plenty, [1, 1, 1], days_ago: [3, 40, 90])
      end
      belt.update!(quantity_on_hand: 0)

      expect(rows.map { |row| [row.part.name, row.status] }).to eq([["Belt", "short"], ["Plenty", "ok"]])
    end
  end

  describe "what counts more" do
    it "gives the latest month more weight than the older ones" do
      history(170)
      rising = create(:part, organization: org, name: "Rising")
      use(rising, [10, 10], days_ago: [5, 20])
      use(rising, [1], days_ago: [40])
      use(rising, [1, 1], days_ago: [70, 100])
      use(rising, [1], days_ago: [130])

      row = row_for("Rising")

      expect(row.expected).to be > 5.5 # well over the plain average of the six months (4.0)
      expect(row.expected).to be < 20.0 # less than the latest month on its own
    end
  end

  describe "when it has nothing honest to say" do
    it "says nothing about any part until the company's parts have been logged for 90 days" do
      history(60)
      part = create(:part, organization: org)
      use(part, [1, 1, 1, 1], days_ago: [1, 10, 20, 30])

      expect(rows).to eq([])
    end

    it "says nothing about a part used fewer than three times" do
      history(170)
      part = create(:part, organization: org, name: "Rare")
      use(part, [5, 5], days_ago: [10, 100])

      expect(row_for("Rare")).to be_nil
    end

    it "says nothing about use older than six months" do
      history(400)
      part = create(:part, organization: org, name: "Old")
      use(part, [1, 1, 1], days_ago: [200, 250, 300])

      expect(row_for("Old")).to be_nil
    end

    it "uses fewer months when the logs only go back that far" do
      history(100)
      part = create(:part, organization: org, name: "Newish")
      use(part, [2, 2, 2], days_ago: [5, 40, 75])

      expect(row_for("Newish").periods).to eq(3)
    end

    it "says nothing about another company's parts" do
      history(170)
      theirs = create(:part, name: "Theirs")
      use(theirs, [1, 1, 1], days_ago: [3, 40, 90])

      expect(rows.map { |row| row.part.name }).not_to include("Theirs")
    end
  end
end
