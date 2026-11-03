require "rails_helper"

RSpec.describe ScheduledReportsJob, type: :job do
  let(:org)     { create(:organization, name: "Acme Plant") }
  let(:owner)   { create(:user, :manager, organization: org, first_name: "Olive", last_name: "Owner") }
  let(:ana)     { create(:user, :manager, organization: org) }
  let(:monday)  { Time.utc(2026, 11, 2, 8, 0) } # a Monday, weekday 1
  let!(:saved)  {
    create(:saved_report, organization: org, user: owner, name: "Weekly work orders", send_on: 1, recipient_ids: [owner.id, ana.id])
  }

  before { ActionMailer::Base.deliveries.clear }

  def emails = ActionMailer::Base.deliveries

  it "emails the PDF to each person chosen, on the weekday, with the dates it is about" do
    described_class.perform_now(monday)

    expect(emails.flat_map(&:to)).to contain_exactly(owner.email, ana.email)
    mail = emails.first
    expect(mail.subject).to eq("[FixFlow] Weekly work orders: 3 Oct to 1 Nov 2026")
    expect(mail.attachments.size).to eq(1)
    expect(mail.attachments.first.filename).to eq("work_orders_summary_2026-11-01.pdf")
    expect(mail.attachments.first.content_type).to start_with("application/pdf")
    expect(mail.attachments.first.body.decoded).to start_with("%PDF")
    expect(mail.body.parts.first.body.to_s).to include("Olive Owner set this up to be emailed every Monday to 2 people")
  end

  it "remembers it was sent, and writes one line to the audit log naming how many" do
    described_class.perform_now(monday)

    expect(saved.reload).to have_attributes(last_sent_on: Date.new(2026, 11, 2), last_error: nil)
    expect(saved.last_sent_at).to be_present
    line = ActivityLog.where(action: "saved_report.sent", resource_id: saved.id).sole
    expect(line.metadata).to include("recipients" => 2)
  end

  it "sends it once a day however often the job runs, and again the next week" do
    described_class.perform_now(monday)
    described_class.perform_now(monday + 3.hours)
    expect(emails.size).to eq(2)

    described_class.perform_now(monday + 7.days)
    expect(emails.size).to eq(4)
  end

  it "waits for 7 in the morning, and for its weekday" do
    described_class.perform_now(Time.utc(2026, 11, 2, 6, 59))
    described_class.perform_now(Time.utc(2026, 11, 3, 9, 0))
    described_class.perform_now(Time.utc(2026, 11, 1, 9, 0))
    expect(emails).to be_empty

    described_class.perform_now(Time.utc(2026, 11, 2, 7, 0))
    expect(emails.size).to eq(2)
  end

  it "does not send a report that is not emailed" do
    saved.update!(send_on: nil, recipient_ids: [])
    described_class.perform_now(monday)

    expect(emails).to be_empty
  end

  it "reads the weekday and the hour in the company's time zone" do
    org.update!(settings: org.settings.merge("timezone" => "Pacific/Auckland"))

    described_class.perform_now(Time.utc(2026, 11, 1, 17, 0)) # Monday 06:00 in Auckland: too early
    expect(emails).to be_empty

    described_class.perform_now(Time.utc(2026, 11, 1, 19, 0)) # Monday 08:00 in Auckland
    expect(emails.size).to eq(2)
    expect(saved.reload.last_sent_on).to eq(Date.new(2026, 11, 2))
  end

  it "makes each company's report in its own time, and one company's report does not wait on another's" do
    other = create(:organization, settings: { "timezone" => "Pacific/Auckland" })
    boss = create(:user, :manager, organization: other)
    create(:saved_report, organization: other, user: boss, send_on: 1, recipient_ids: [boss.id])

    described_class.perform_now(Time.utc(2026, 11, 1, 19, 0)) # Monday morning in Auckland, Sunday evening in UTC

    expect(emails.flat_map(&:to)).to eq([boss.email])
  end

  describe "who gets it" do
    it "leaves out a person who turned it off in Settings, Notifications" do
      ana.update!(notification_preferences: { "rules" => { "report_scheduled" => { "email" => false } } })
      described_class.perform_now(monday)

      expect(emails.flat_map(&:to)).to eq([owner.email])
    end

    it "leaves out a person who is no longer a manager" do
      ana.update!(role: "technician")
      described_class.perform_now(monday)

      expect(emails.flat_map(&:to)).to eq([owner.email])
    end

    it "sends nothing, and says why, when nobody is left, and does not try again that day" do
      [owner, ana].each { |person| person.update!(notification_preferences: { "email_enabled" => false }) }
      described_class.perform_now(monday)
      described_class.perform_now(monday + 1.hour)

      expect(emails).to be_empty
      expect(saved.reload.last_error).to include("Nobody to send it to")
      expect(saved.last_sent_on).to eq(Date.new(2026, 11, 2))
    end
  end

  describe "when the report cannot be made" do
    before { owner.update!(role: "technician") }

    it "sends nothing, keeps the reason on the report, and does not mark it sent" do
      described_class.perform_now(monday)

      expect(emails).to be_empty
      expect(saved.reload.last_error).to match(/Failed: Olive Owner is no longer a manager/)
      expect(saved.last_sent_on).to be_nil
    end

    it "tries again the next hour, and sends when it works, clearing the reason" do
      described_class.perform_now(monday)
      owner.update!(role: "manager")
      described_class.perform_now(monday + 1.hour)

      expect(emails.size).to eq(2)
      expect(saved.reload).to have_attributes(last_error: nil, last_sent_on: Date.new(2026, 11, 2))
    end

    it "does not stop the other reports" do
      healthy_owner = create(:user, :manager, organization: org)
      create(:saved_report, organization: org, user: healthy_owner, name: "Healthy", send_on: 1, recipient_ids: [healthy_owner.id])
      described_class.perform_now(monday)

      expect(emails.map(&:subject)).to contain_exactly(a_string_including("Healthy"))
    end
  end

  describe "when an email cannot be delivered" do
    def fail_first(count)
      calls = 0
      allow(ReportMailer).to receive(:scheduled).and_wrap_original do |original, *args|
        calls += 1
        original.call(*args).tap do |delivery|
          allow(delivery).to receive(:deliver_now).and_raise(Net::SMTPFatalError, "550 no such user") if calls <= count
        end
      end
    end

    it "still sends to the others, counts the report as sent, and names who it could not reach" do
      fail_first(1)
      described_class.perform_now(monday)
      described_class.perform_now(monday + 1.hour)

      expect(emails.size).to eq(1)
      expect(saved.reload.last_sent_on).to eq(Date.new(2026, 11, 2))
      expect(saved.last_error).to match(/Could not email .*@/)
      expect(ActivityLog.where(action: "saved_report.sent").sole.metadata).to include("recipients" => 1)
    end

    it "keeps the reason and tries again next hour when it reached nobody" do
      fail_first(2)
      described_class.perform_now(monday)

      expect(saved.reload.last_sent_on).to be_nil
      expect(saved.last_error).to include("No email could be delivered")

      described_class.perform_now(monday + 1.hour)
      expect(emails.size).to eq(2)
      expect(saved.reload).to have_attributes(last_error: nil, last_sent_on: Date.new(2026, 11, 2))
    end
  end
end
