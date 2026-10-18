require "rails_helper"

RSpec.describe BackupMailer, type: :mailer do
  let(:admin) { create(:user, :admin, first_name: "Ada") }

  it "tells the administrator that the backup failed, why, when the next try is, and where to look" do
    mail = described_class.failed(admin, "RuntimeError: pg_dump failed", Time.utc(2026, 10, 18, 3, 45))

    expect(mail.to).to eq([admin.email])
    expect(mail.subject).to eq("[FixFlow] The nightly backup failed")
    expect(mail.body.encoded).to include(
      "Ada", "RuntimeError: pg_dump failed", "2026-10-18 03:45 UTC", "#{DatabaseBackupJob::ATTEMPTS} tries",
      DatabaseBackupJob::RUNS_AT, "#{EmailSetup.base_url}/settings/data-retention"
    )
  end
end
