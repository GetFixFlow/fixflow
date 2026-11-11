require "rails_helper"

RSpec.describe User, "#locale" do
  it "may be an offered language, or nothing" do
    expect(build(:user, locale: "es")).to be_valid
    expect(build(:user, locale: nil)).to be_valid
  end

  it "turns an empty choice into none, so the company's language applies" do
    expect(create(:user, locale: "  ").locale).to be_nil
  end

  it "refuses a language that is not offered" do
    user = build(:user, locale: "xx")

    expect(user).not_to be_valid
    expect(user.errors[:locale]).to eq(["is not one of the available languages"])
  end
end
