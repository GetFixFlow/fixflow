# Fills a company's install with example locations, assets, parts, a preventive maintenance schedule and
# work orders, so a new administrator can see what FixFlow looks like with something in it, and takes them
# out again.
#
# Everything is named "Sample: ..." and recorded in sample_records, so removal touches only these and never
# real data. It creates no users and sends no email. (A separate thing: DemoDataService makes a whole demo
# company with known passwords, for trial installs.)
class SampleDataService
  class AlreadyLoaded < StandardError; end

  PREFIX = "Sample: ".freeze

  PUMP_CHECKLIST = [
    { step: 1, instruction: "Shut down the pump safely", required: true },
    { step: 2, instruction: "Check the seals for leaks", required: true },
    { step: 3, instruction: "Replace the oil filter", required: true },
    { step: 4, instruction: "Run for ten minutes and listen", required: false }
  ].freeze

  def self.loaded?(organization) = SampleRecord.exists?(organization: organization)

  LABELS = { "Location" => "place", "Asset" => "asset", "Part" => "part", "PreventiveMaintenance" => "PM schedule",
"WorkOrder" => "work order" }.freeze

  # "3 places, 5 assets, 4 parts, 1 PM schedule, 9 work orders" from a hash of counts by type.
  def self.sentence(counts)
    LABELS.filter_map { |type, label|
      "#{counts[type]} #{label.pluralize(counts[type])}" if counts[type].to_i.positive?
    }.to_sentence.presence || "nothing"
  end

  def self.counts(organization)
    SampleDataRemoval::ORDER.index_with { |type| SampleRecord.ids_of(type, organization).size }
  end

  def self.load!(organization, user)
    raise AlreadyLoaded, "Sample data is already loaded. Remove it first to load it again." if loaded?(organization)

    new(organization, user).load!
  end

  # Removes what was loaded, except anything real that now depends on it, which is kept and reported.
  def self.remove!(organization) = SampleDataRemoval.new(organization).call

  def initialize(organization, user)
    @organization = organization
    @user = user
  end

  def load!
    ActiveRecord::Base.transaction do
      ActsAsTenant.with_tenant(organization) do
        build_places
        build_parts
        build_assets
        build_schedule_and_work_orders
        build_history
      end
    end
    self.class.counts(organization)
  end

  private

  attr_reader :organization, :user

  def track(record)
    SampleRecord.create!(organization: organization, record_type: record.class.name, record_id: record.id)
    record
  end

  def technician
    @technician ||= organization.users.technicians.active.first || user
  end

  # --- building ------------------------------------------------------------------------------------

  def build_places
    @plant  = track(organization.locations.create!(name: "#{PREFIX}Plant", location_type: "site"))
    @floor  = track(organization.locations.create!(name: "#{PREFIX}Floor 1", location_type: "floor", parent: @plant))
    @stores = track(organization.locations.create!(name: "#{PREFIX}Stores", location_type: "room", parent: @plant))
  end

  def build_parts
    @parts = [
      ["Oil filter", "SAMPLE-OF", 12, 3, 12.50],
      ["V-belt", "SAMPLE-VB", 2, 2, 18.75], # at its reorder point, so the low-stock view has something to show
      ["Air filter", "SAMPLE-AF", 24, 6, 9.20],
      ["Pump seal kit", "SAMPLE-PS", 5, 1, 64.00]
    ].to_h do |name, sku, quantity, reorder_point, cost|
      attributes = { name: "#{PREFIX}#{name}", sku: sku, quantity_on_hand: quantity, reorder_point: reorder_point, unit_cost: cost,
location: @stores }
      [name, track(organization.parts.create!(attributes))]
    end
  end

  def build_assets
    @assets = [
      ["Pump 01", "operational", { manufacturer: "Grundfos", model: "CM5-6", year: "2021" }],
      ["Air compressor", "degraded", { manufacturer: "Atlas Copco", year: "2018" }],
      ["Conveyor belt A", "operational", {}],
      ["HVAC unit 2", "operational", { manufacturer: "Carrier" }],
      ["Forklift 3", "down", {}]
    ].to_h do |name, status, custom|
      [name,
       track(organization.assets.create!(name: "#{PREFIX}#{name}", status: status, location: @floor, custom_fields: custom,
asset_tag: nil))]
    end
  end

  def build_schedule_and_work_orders
    pm = build_pump_schedule
    build_work_order_from(pm)
    work_order("Compressor is rattling and running hot", "open", "high", @assets["Air compressor"], due_date: 2.days.from_now)
    work_order("Replace worn conveyor belt", "assigned", "medium", @assets["Conveyor belt A"], assignee: technician,
due_date: 6.days.from_now)
    work_order("Forklift will not lift", "open", "critical", @assets["Forklift 3"], due_date: 1.day.from_now)
  end

  # Due far enough ahead that the scheduler will not turn it into a real work order (and an email) for weeks.
  def build_pump_schedule
    template = { title: "{asset_name} - monthly service", description: "Monthly service of the pump.", estimated_hours: 1.5,
                 checklist: PUMP_CHECKLIST }
    track(PreventiveMaintenance.create!(
            organization: organization, asset: @assets["Pump 01"], assigned_to: technician, name: "#{PREFIX}Monthly pump service",
            frequency_type: :time_based, frequency_value: 30, frequency_unit: "days", priority: :medium, status: :active,
            start_date: 2.weeks.ago, next_due_at: 45.days.from_now, estimated_hours: 1.5, template: template
          ))
  end

  # What the scheduler would have made from the schedule, so there is a checklist to tick. Made directly, not through
  # the scheduler, which would also email the technician about a work order that is only a sample.
  def build_work_order_from(schedule)
    checklist = schedule.template["checklist"].each_with_index.map { |item, index|
      item.stringify_keys.merge("completed" => index.zero?)
    }
    started = { assignee: technician, started_at: 1.hour.ago, due_date: 3.days.from_now }
    from_schedule = work_order("Monthly pump service", "in_progress", "medium", @assets["Pump 01"], **started)
    from_schedule.update!(preventive_maintenance: schedule, checklist: checklist, estimated_hours: 1.5)
    schedule.pm_executions.create!(work_order: from_schedule, scheduled_date: Date.current, generated_at: 1.hour.ago,
status: :generated)
    schedule.update!(times_generated: 1, last_run_at: 1.hour.ago)
  end

  # A few weeks of finished work, so the dashboard and reports show something.
  def build_history
    [
      ["Replace HVAC filters", "HVAC unit 2", 38, 1.5, { "Air filter" => 2 }],
      ["Change pump oil", "Pump 01", 31, 1.0, { "Oil filter" => 1 }],
      ["Re-tension conveyor", "Conveyor belt A", 24, 2.0, { "V-belt" => 1 }],
      ["Service compressor", "Air compressor", 10, 3.0, { "Oil filter" => 1, "Air filter" => 1 }],
      ["Pump seal replacement", "Pump 01", 3, 2.5, { "Pump seal kit" => 1 }]
    ].each do |title, asset, days_ago, hours, parts|
      finished = days_ago.days.ago
      wo = work_order(title, "completed", "medium", @assets[asset], assignee: technician, created_at: finished - 2.days,
                      started_at: finished - 4.hours, completed_at: finished, actual_hours: hours,
                      completion_notes: "Done and tested. Everything running normally.")
      parts.each do |part, quantity|
        wo.work_order_parts.create!(part: @parts[part], quantity_used: quantity, unit_cost: @parts[part].unit_cost)
      end
      wo.recalculate_parts_cost!
    end
  end

  def work_order(title, status, priority, asset, **attributes)
    note = "Part of the sample data. Remove it any time from Settings, Import / Export."
    base = { title: "#{PREFIX}#{title}", status: status, priority: priority, asset: asset, requester: user, description: note }
    track(organization.work_orders.create!(base.merge(attributes)))
  end
end
