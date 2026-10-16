require "rails_helper"

# Every email the app sends about work is checked against the person's choices.
RSpec.describe "Emails and email preferences", type: :job do
  include ActiveJob::TestHelper

  let(:org) { create(:organization) }

  def recipients_of(subject)
    perform_enqueued_jobs
    ActionMailer::Base.deliveries.select { |mail| mail.subject.match?(subject) }.flat_map(&:to)
  end

  before { ActionMailer::Base.deliveries.clear }

  it "covers every email the app has a choice for" do
    expect(EmailPreferenceCases::ALL.pluck(:event).to_set).to eq(EmailPreferences::EMAIL_EVENTS.to_set)
  end

  EmailPreferenceCases::ALL.each do |kase|
    describe kase[:label] || kase[:event] do
      let!(:person) { create(:user, role: kase[:role], organization: org) }

      # Creates what the email is about, and returns what makes the app send it.
      let!(:send_it) { instance_exec(org, person, &kase[:setup]) }

      it "is sent to a person who has not chosen anything" do
        send_it.call

        expect(recipients_of(kase[:subject])).to eq([person.email])
      end

      it "is not sent to a person who switched this email off" do
        person.update_email_preferences!("rules" => { kase[:event] => { "email" => false } })

        send_it.call

        expect(recipients_of(kase[:subject])).to be_empty
      end

      it "is not sent to a person who switched all email off" do
        person.update_email_preferences!("email_enabled" => false)

        send_it.call

        expect(recipients_of(kase[:subject])).to be_empty
      end

      it "is still sent when only a different email was switched off" do
        other = (EmailPreferences::EMAIL_EVENTS - [kase[:event]]).first
        person.update_email_preferences!("rules" => { other => { "email" => false } })

        send_it.call

        expect(recipients_of(kase[:subject])).to eq([person.email])
      end

      it "is not sent to a deactivated person" do
        person.update!(deactivated_at: 1.day.ago)

        send_it.call

        expect(recipients_of(kase[:subject])).to be_empty
      end
    end
  end

  it "still tells someone who reported through the public form (no account, so no choices) when it is done" do
    work_order = create(:work_order, :public_request, organization: org, requester: nil)

    NotifyRequesterJob.perform_now(work_order.id)

    expect(recipients_of(/Maintenance Request Has Been Completed/)).to eq([work_order.requester_email])
  end

  it "does not let one person's choice decide for the others in the same company" do
    keeps, drops = create_list(:user, 2, :manager, organization: org)
    drops.update_email_preferences!("rules" => { "wo_new_request" => { "email" => false } })

    NotifyNewRequestJob.perform_now(create(:work_order, organization: org).id)

    expect(recipients_of(/New Maintenance Request/)).to eq([keeps.email])
  end
end
