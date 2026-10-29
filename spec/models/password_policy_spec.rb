require "rails_helper"

RSpec.describe PasswordPolicy do
  def user_with(password, **attrs)
    build(:user, skip_password_policy: false, password: password, password_confirmation: password,
                 email: "pat.lee@example.test", first_name: "Patricia", last_name: "Lee", **attrs)
  end

  def problems(password, **attrs)
    person = user_with(password, **attrs)
    person.validate
    person.errors[:password]
  end

  it "accepts a long password that is not guessable, with or without capitals and symbols" do
    ["Blue-Ladder-4721-Kite", "correct horse battery staple", "xk3v9pq2m7zt", "Sm0ke-Pass-2026"].each do |password|
      expect(problems(password)).to eq([]), password
    end
  end

  it "refuses fewer than ten characters, whatever they are" do
    expect(problems("Xq7!mR2$k")).to include(a_string_matching(/too short \(minimum is 10 characters\)/))
  end

  it "refuses the common passwords, also with digits or symbols added, and in any case" do
    ["password123", "Password1234", "PASSWORD!!!!!", "qwertyuiop", "Welcome12345", "iloveyou123", "p@ssw0rd2026", "1q2w3e4r5t",
     "letmein-2026", "administrator", "changeme2026"].each do |password|
      expect(problems(password)).to include("is too common or too easy to guess"), password
    end
  end

  it "refuses one character repeated, a run of digits, and the name of the app" do
    ["aaaaaaaaaaaa", "1111111111", "letmein-letmein", "abcabcabcabc", "1234567890", "9876543210", "0123456789012",
     "xx-FixFlow-vv", "My fixflow login"].each do |password|
      expect(problems(password)).to include("is too common or too easy to guess"), password
    end
  end

  it "refuses a password built from the person's email or name, ignoring short name parts" do
    ["pat.lee-2026-xyz", "PatLee!!!!!!", "Patricia-2026-xx"].each do |password|
      expect(problems(password)).to include("can't contain your name or email address"), password
    end
    # "lee" is three letters: too short to count as the person's name, or every password with "lee" would be refused.
    expect(problems("sleeping-bag-77")).to eq([])
  end

  it "checks only a password that is being set" do
    person = create(:user, password: "password123", password_confirmation: "password123", skip_password_policy: true)

    # A record read afresh, as a request does: it does not remember the password it was built with.
    fresh = User.find(person.id)
    fresh.skip_password_policy = false
    expect(fresh.update(first_name: "Changed")).to be(true), fresh.errors.full_messages.to_sentence
    expect(fresh.update(password: "password123", password_confirmation: "password123")).to be(false)
  end

  it "can be switched off for the demo accounts and for the unusable password an invitation starts with" do
    expect(user_with("password123", skip_password_policy: true)).to be_valid
  end
end
