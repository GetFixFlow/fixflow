require "rails_helper"

RSpec.describe OrganizationBranding do
  it "reads contrast against white as expected for known colours" do
    expect(described_class.contrast_with_white("#000000")).to be_within(0.1).of(21)
    expect(described_class.contrast_with_white("#ffffff")).to be_within(0.01).of(1)
    expect(described_class.contrast_with_white("#2563eb")).to be > 5
  end
end
