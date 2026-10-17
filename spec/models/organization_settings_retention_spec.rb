require "rails_helper"

# The two retention settings and how the rest of the app reads them.
RSpec.describe OrganizationSettings do
  let(:org) { create(:organization) }

  def with_env(value) = stub_const("ENV", ENV.to_h.merge("IOT_RETENTION_DAYS" => value))

  describe "#sensor_retention_days" do
    it "is a year when nobody chose anything" do
      with_env(nil)
      expect(org.sensor_retention_days).to eq(365)
    end

    it "is what the company chose, whatever the server was started with" do
      with_env("90")
      org.assign_company_settings("iot_data_retention_days" => 120)
      expect(org.sensor_retention_days).to eq(120)
    end

    it "falls back to IOT_RETENTION_DAYS (how this was set before it was a company setting) when the company chose nothing" do
      with_env("90")
      expect(org.sensor_retention_days).to eq(90)
    end

    it "shows the same number on the settings screens as the cleanup applies, however it was arrived at" do
      with_env("90")
      expect(org.settings_with_defaults["iot_data_retention_days"]).to eq(org.sensor_retention_days)
      org.assign_company_settings("iot_data_retention_days" => 120)
      expect(org.settings_with_defaults["iot_data_retention_days"]).to eq(120)
      expect(org.sensor_retention_days).to eq(120)
    end

    it "ignores an IOT_RETENTION_DAYS that is not a positive whole number in range, instead of deleting everything" do
      ["0", "-5", "ninety", "", "1.5", "5000"].each do |bad|
        with_env(bad)
        expect(org.sensor_retention_days).to eq(365), bad
      end
    end
  end

  describe "#audit_log_retention_days" do
    it "is nil (kept for ever) by default and when set to 0" do
      expect(org.audit_log_retention_days).to be_nil
      org.assign_company_settings("audit_log_retention_days" => 0)
      expect(org.audit_log_retention_days).to be_nil
    end

    it "is the number of days when there is a limit" do
      org.assign_company_settings("audit_log_retention_days" => 730)
      expect(org.audit_log_retention_days).to eq(730)
    end
  end

  describe "validation" do
    def valid_with?(changes)
      org.assign_company_settings(changes)
      org.valid?
    end

    it "accepts from 1 to 3650 days for sensor data, and refuses 0, negative and enormous numbers" do
      expect([valid_with?("iot_data_retention_days" => 1), valid_with?("iot_data_retention_days" => 3650)]).to eq([true, true])
      [0, -1, 3651, "many"].each { |bad| expect(valid_with?("iot_data_retention_days" => bad)).to be(false), bad.inspect }
    end

    it "accepts 0 (for ever) to 3650 days for the audit log, and refuses negative and enormous numbers" do
      expect([valid_with?("audit_log_retention_days" => 0), valid_with?("audit_log_retention_days" => 3650)]).to eq([true, true])
      [-1, 3651, "soon"].each { |bad| expect(valid_with?("audit_log_retention_days" => bad)).to be(false), bad.inspect }
    end
  end
end
