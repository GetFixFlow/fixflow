require "rails_helper"

RSpec.describe SensorAnomaly do
  let(:anomaly) { create(:sensor_anomaly) }
  let(:person) { create(:user, :manager, organization: anomaly.organization) }

  it "says in one line what was read and what is usual" do
    expect(anomaly.message).to eq("temperature reads 91.2 °C; it is usually 62 to 74 °C")
    bare = build(:sensor_anomaly, unit: nil, value: 9, usual_low: 1.5, usual_high: 4)
    expect(bare.message).to eq("temperature reads 9; it is usually 1.5 to 4")
  end

  it "needs the numbers it was flagged by" do
    expect(build(:sensor_anomaly, baseline_count: 0)).not_to be_valid
    expect(build(:sensor_anomaly, metric_name: "")).not_to be_valid
    expect(build(:sensor_anomaly, score: nil)).not_to be_valid
  end

  it "is removed with its asset and with its company" do
    anomaly

    expect { anomaly.asset.destroy! }.to change(described_class, :count).by(-1)
    other = create(:sensor_anomaly)
    expect { other.organization.destroy! }.to change(described_class, :count).by(-1)
  end

  describe "what a person can say about it" do
    it "starts open, and is acknowledged by someone, who is kept with their note" do
      expect(anomaly).to be_open

      anomaly.acknowledge!(by: person, notes: "Bearing is hot")

      expect(anomaly).to have_attributes(status: "acknowledged", acknowledged_by: person, notes: "Bearing is hot")
      expect(anomaly.acknowledged_at).to be_within(5.seconds).of(Time.current)
    end

    it "can be dismissed as nothing, open or acknowledged, and keeps an earlier note when none is given" do
      anomaly.acknowledge!(by: person, notes: "Looking")
      anomaly.dismiss!(by: person)

      expect(anomaly).to have_attributes(status: "dismissed", notes: "Looking")
      expect(create(:sensor_anomaly).tap { |one| one.dismiss!(by: person, notes: "Sensor was moved") }).to be_dismissed
    end

    it "cannot be moved again once it is over, and says why" do
      anomaly.dismiss!(by: person)

      expect { anomaly.dismiss!(by: person) }.to raise_error(described_class::InvalidTransition, "This flag is already dismissed")
      expect { anomaly.acknowledge!(by: person) }
        .to raise_error(described_class::InvalidTransition, "This flag is dismissed, so it cannot be acknowledged")
    end
  end
end
