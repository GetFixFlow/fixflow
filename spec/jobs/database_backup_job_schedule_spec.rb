require "rails_helper"

RSpec.describe DatabaseBackupJob do
  describe "the schedule" do
    it "runs at the time the Data Retention page tells people it does" do
      schedule = YAML.load_file(Rails.root.join("config/sidekiq.yml")).fetch(:scheduler).fetch(:schedule)
      minute, hour = schedule.dig("db_backup", :cron).split
      expect(format("%<hour>02d:%<minute>02d UTC", hour: hour.to_i, minute: minute.to_i)).to eq(described_class::RUNS_AT)
    end

    it "makes backups only on a production server" do
      expect(described_class.runs_here?).to be(Rails.env.production?)
    end
  end
end
