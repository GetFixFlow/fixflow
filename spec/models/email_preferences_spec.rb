require "rails_helper"

RSpec.describe EmailPreferences do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }

  it "wants every email until told otherwise (nobody has to open the screen to keep what they had)" do
    expect(user.notification_preferences).to eq({})
    EmailPreferences::EMAIL_EVENTS.each { |event| expect(user.wants_email?(event)).to be(true), event }
  end

  it "stops one email without touching the others" do
    user.update_email_preferences!("rules" => { "wo_assigned" => { "email" => false } })

    expect(user.wants_email?("wo_assigned")).to be(false)
    expect(user.wants_email?("pm_overdue")).to be(true)
  end

  it "stops them all with the master switch, and keeps each choice for when it is switched back on" do
    user.update_email_preferences!("rules" => { "wo_assigned" => { "email" => false } })
    user.update_email_preferences!("email_enabled" => false)
    expect(EmailPreferences::EMAIL_EVENTS.any? { |event| user.wants_email?(event) }).to be(false)

    user.update_email_preferences!("email_enabled" => true)

    expect(user.wants_email?("wo_assigned")).to be(false)
    expect(user.wants_email?("pm_overdue")).to be(true)
  end

  it "never emails a deactivated person, whatever they chose" do
    user.update!(deactivated_at: 1.day.ago)

    expect(user.wants_email?("wo_assigned")).to be(false)
  end

  it "refuses anything but on or off, and changes nothing when it does" do
    ["false", "yes", 0, nil, { "a" => 1 }].each do |junk|
      expect { user.update_email_preferences!("rules" => { "wo_assigned" => { "email" => junk } }) }
        .to raise_error(ActiveRecord::RecordInvalid)
    end
    expect { user.update_email_preferences!("email_enabled" => "off") }.to raise_error(ActiveRecord::RecordInvalid)
    expect(user.reload.notification_preferences).to eq({})
  end

  it "ignores emails the app does not send, and keeps nothing of them" do
    user.update_email_preferences!(
      "rules" => { "launch_missiles" => { "email" => false }, "wo_assigned" => { "email" => false } }
    )

    expect(user.reload.notification_preferences["rules"].keys).to all(satisfy { |key| EmailPreferences::EMAIL_EVENTS.include?(key) })
    expect(user.email_preferences["rules"]).not_to have_key("launch_missiles")
  end

  it "reads damaged stored values as 'on' instead of failing" do
    damaged = { "email_enabled" => "banana", "rules" => { "wo_assigned" => "oops", "pm_overdue" => nil } }
    user.update_columns(notification_preferences: damaged) # rubocop:disable Rails/SkipsModelValidations

    expect(user.email_preferences["rules"]["wo_assigned"]).to eq("email" => true)
    expect(user.wants_email?("pm_overdue")).to be(true)
  end

  it "refuses to be asked about an email that does not exist, so a typo in the app cannot silently mean 'no'" do
    expect { user.wants_email?("wo_asigned") }.to raise_error(ArgumentError)
  end

  describe ".wanting_email" do
    it "picks, out of the people in scope, those who want it" do
      yes, no = create_list(:user, 2, :manager, organization: organization)
      no.update_email_preferences!("rules" => { "pm_overdue" => { "email" => false } })

      expect(organization.users.managers.wanting_email("pm_overdue")).to contain_exactly(yes)
    end
  end
end
