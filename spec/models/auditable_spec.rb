require "rails_helper"

# What gets written to the audit log when someone changes the company's records, and what deliberately does not.
RSpec.describe Auditable do
  let(:org)     { create(:organization) }
  let!(:admin)  { create(:user, :admin, organization: org, first_name: "Ada", last_name: "Admin") }
  let(:pump)    { create(:asset, organization: org, name: "Pump 3") }

  def lines = ActivityLog.where(organization_id: org.id).order(:id)

  # Records are made first (their own lines are cleared), then the one change under test is made "by" the admin.
  def as_admin(&)
    Current.set(user: admin, request_ip: "10.1.2.3", &)
  end

  def since_now
    ActivityLog.delete_all
    yield
    lines.map { |line| [line.action, line.resource_name, line.metadata] }
  end

  describe "who and where" do
    it "names the person making the change, and their address" do
      as_admin { create(:location, organization: org, name: "Plant 1") }
      line = lines.last
      expect(line).to have_attributes(action: "location.created", resource_type: "Location", resource_name: "Plant 1",
                                      user_id: admin.id, ip_address: "10.1.2.3")
    end

    it "leaves the person empty for something the system did (a job, an import without a person)" do
      create(:location, organization: org, name: "Annex")
      expect(lines.last).to have_attributes(action: "location.created", user_id: nil)
    end
  end

  describe "assets" do
    it "writes a line for create, update and delete, naming the fields that changed and never their values" do
      pump
      result = since_now do
        as_admin do
          pump.update!(name: "Pump 4", status: "down", serial_number: "SECRET-SERIAL-1")
          pump.discard
        end
      end
      expect(result).to eq([["asset.updated", "Pump 4", { "changed" => %w[name serial_number status] }],
                            ["asset.deleted", "Pump 4", { "changed" => ["deleted"] }]])
      expect(ActivityLog.pluck(:metadata).to_s).not_to include("SECRET-SERIAL-1")
    end

    it "says restored when a deleted asset comes back" do
      pump.discard
      result = since_now { as_admin { pump.undiscard } }
      expect(result.map(&:first)).to eq(["asset.restored"])
    end

    it "writes nothing for a save that changed nothing" do
      pump
      expect(since_now { as_admin { pump.save! } }).to eq([])
    end
  end

  describe "other records people edit" do
    it "covers locations, work orders, schedules, IoT rules and API keys" do
      pump
      names = since_now do
        as_admin do
          create(:location, organization: org, name: "Plant 2")
          create(:work_order, organization: org, asset: pump)
          create(:preventive_maintenance, organization: org, asset: pump)
          create(:iot_rule, organization: org, asset: pump)
          create(:api_key, organization: org)
        end
      end.map(&:first)
      expect(names).to include("location.created", "work_order.created", "preventive_maintenance.created", "iot_rule.created",
                               "api_key.created")
    end

    it "calls a revoked API key revoked, and never writes its secret" do
      key = create(:api_key, organization: org, name: "Line 2 sensors")
      result = since_now { as_admin { key.update!(active: false) } }
      expect(result).to eq([["api_key.revoked", "Line 2 sensors", { "changed" => ["active"] }]])
      expect(ActivityLog.pluck(:metadata).to_s).not_to include(key.key_digest)
    end

    it "does not write a line each time a work order moves through its states (the transition writes its own)" do
      order = create(:work_order, organization: org, asset: pump)
      result = since_now do
        as_admin do
          order.update!(assignee: admin, status: "assigned", started_at: Time.current)
          order.update!(title: "Replace the seal", priority: "high")
        end
      end
      expect(result).to eq([["work_order.updated", order.work_order_number, { "changed" => %w[priority title] }]])
    end

    it "does not write a line for what the scheduler and the rule engine keep up to date" do
      schedule = create(:preventive_maintenance, organization: org, asset: pump)
      rule = create(:iot_rule, organization: org, asset: pump)
      result = since_now do
        schedule.update!(next_due_at: 3.days.from_now, last_run_at: Time.current, times_generated: 4)
        rule.update!(trigger_count: 9, last_triggered_at: Time.current, breach_started_at: Time.current)
      end
      expect(result).to eq([])
    end

    it "does write a line when a person edits a schedule or a rule" do
      schedule = create(:preventive_maintenance, organization: org, asset: pump)
      rule = create(:iot_rule, organization: org, asset: pump)
      result = since_now do
        as_admin do
          schedule.update!(name: "Quarterly service", priority: "high")
          rule.update!(threshold: 99)
        end
      end
      expect(result.map(&:first)).to eq(%w[preventive_maintenance.updated iot_rule.updated])
      expect(result.first.last).to eq("changed" => %w[name priority])
    end
  end

  describe "deleting for good" do
    it "writes a line naming what was deleted, for every kind of record that can be" do
      place = create(:location, organization: org, name: "Old annex")
      rule = create(:iot_rule, organization: org, asset: pump, name: "Too hot")
      key = create(:api_key, organization: org, name: "Retired gateway")
      schedule = create(:preventive_maintenance, organization: org, asset: pump, name: "Yearly check")
      order = create(:work_order, organization: org, asset: pump)
      result = since_now { as_admin { [place, rule, key, schedule, order].each(&:destroy!) } }
      expect(result.map { |action, name, _| [action, name] }).to contain_exactly(
        ["location.deleted", "Old annex"], ["iot_rule.deleted", "Too hot"], ["api_key.deleted", "Retired gateway"],
        ["preventive_maintenance.deleted", "Yearly check"], ["work_order.deleted", order.work_order_number]
      )
      expect(ActivityLog.where(action: "location.deleted").sole.user_id).to eq(admin.id)
    end

    it "does not write a line when the delete is rolled back" do
      place = create(:location, organization: org, name: "Still here")
      result = since_now do
        Location.transaction do
          place.destroy!
          raise ActiveRecord::Rollback
        end
      end
      expect(result).to eq([])
    end
  end

  describe "people" do
    let!(:person) { create(:user, organization: org, first_name: "Bo", last_name: "Technician") }

    it "writes the person's role (old and new) when it changes, and only the name of any other field" do
      result = since_now { as_admin { person.update!(role: "manager", hourly_rate: 48.5) } }
      expected_metadata = { "changed" => %w[role hourly_rate], "values" => { "role" => %w[technician manager] } }
      expect(result).to eq([["user.updated", "Bo Technician", expected_metadata]])
      expect(ActivityLog.pluck(:metadata).to_s).not_to include("48.5")
    end

    it "says that the password changed, never what it is" do
      new_password = "a-brand-new-pass1"
      result = since_now { as_admin { person.update!(password: new_password, password_confirmation: new_password) } }
      expect(result).to eq([["user.updated", "Bo Technician", { "changed" => ["password"] }]])
      expect(ActivityLog.pluck(:metadata).to_s).not_to include("a-brand-new-pass1")
    end

    it "calls deactivating and reactivating by those words" do
      deactivated = since_now { as_admin { person.update!(deactivated_at: Time.current) } }
      reactivated = since_now { as_admin { person.update!(deactivated_at: nil) } }
      expect([deactivated.first.first, reactivated.first.first]).to eq(%w[user.deactivated user.reactivated])
    end

    it "does not write a line for the counters and tokens that change as people sign in" do
      result = since_now do
        person.update!(sign_in_count: 5, last_sign_in_at: Time.current, jti: SecureRandom.uuid,
                       notification_preferences: { "x" => 1 })
      end
      expect(result).to eq([])
    end

    it "writes a line when someone is added, called by their name" do
      result = since_now { as_admin { create(:user, organization: org, first_name: "Cy", last_name: "New") } }
      expect(result.map { |action, name, _| [action, name] }).to eq([["user.created", "Cy New"]])
    end
  end

  describe "signing in" do
    it "writes a line naming the person, their address and device" do
      person = create(:user, organization: org, first_name: "Di", last_name: "Driver")
      ActivityLog.delete_all
      phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1"
      Current.set(request_ip: "203.0.113.9", user_agent: phone) do
        person.on_jwt_dispatch("token", { "sid" => SecureRandom.uuid, "jti" => person.jti, "exp" => 1.day.from_now.to_i })
      end
      line = lines.last
      expect(line).to have_attributes(action: "user.signed_in", resource_name: "Di Driver", user_id: person.id,
                                      ip_address: "203.0.113.9")
      expect(line.metadata["device"]).to be_present
    end
  end

  describe "bulk work" do
    it "writes no line for each record when told to be silent" do
      result = since_now do
        described_class.silenced { 3.times { |n| create(:location, organization: org, name: "Bulk #{n}") } }
      end
      expect(result).to eq([])
    end

    it "is silent only inside the block" do
      ActivityLog.delete_all
      described_class.silenced { create(:location, organization: org, name: "Quiet") }
      create(:location, organization: org, name: "Loud")
      expect(lines.pluck(:resource_name)).to eq(["Loud"])
    end
  end

  describe "when writing the line fails" do
    it "still saves the record (the log must never lose someone's work)" do
      allow(ActivityLog).to receive(:create!).and_raise(ActiveRecord::StatementInvalid, "disk full")
      expect { create(:location, organization: org, name: "Saved anyway") }.to change(Location, :count).by(1)
    end
  end
end
