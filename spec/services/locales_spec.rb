require "rails_helper"

RSpec.describe Locales do
  let(:org) { create(:organization) }

  it "offers English first and then the languages that have files, each by its own name" do
    expect(described_class.codes).to eq(%w[en es])
    expect(described_class.names).to eq("en" => "English", "es" => "Español")
  end

  it "offers the same languages as the screens do, so a person is never offered one the server refuses or the reverse" do
    screens = Rails.root.join("apps/web/src/locales").children.select(&:directory?).map { |dir| dir.basename.to_s }

    expect(described_class.codes).to match_array(screens)
  end

  it "knows which codes are offered, and refuses anything else" do
    expect(described_class.available?("es")).to be(true)
    expect(described_class.available?("xx")).to be(false)
    expect(described_class.available?("")).to be(false)
    expect(described_class.available?(nil)).to be(false)
  end

  describe ".for_user" do
    it "uses what the person chose" do
      org.update!(settings: { "language" => "es" })
      expect(described_class.for_user(create(:user, organization: org, locale: "en"))).to eq("en")
    end

    it "uses the company's language for someone who has not chosen" do
      org.update!(settings: { "language" => "es" })
      expect(described_class.for_user(create(:user, organization: org))).to eq("es")
    end

    it "uses English when neither is set, or when what was stored is no longer offered" do
      user = create(:user, organization: org)
      user.update_column(:locale, "xx") # rubocop:disable Rails/SkipsModelValidations
      expect(described_class.for_user(user)).to eq("en")
      expect(described_class.for_user(nil)).to eq("en")
    end
  end

  it "runs a block in the person's language and puts the language back afterwards" do
    user = create(:user, organization: org, locale: "es")
    seen = described_class.with_user(user) { I18n.locale }

    expect(seen).to eq(:es)
    expect(I18n.locale).to eq(:en)
  end
end
