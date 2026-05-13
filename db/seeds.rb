return unless Rails.env.development?

puts "Seeding development data..."

ActsAsTenant.without_tenant do
  # ── Organization + Users ────────────────────────────────────────────────────
  org = Organization.find_or_create_by!(name: "Demo Manufacturing Co.") do |o|
    o.subdomain = "demo"
  end

  admin = User.find_or_create_by!(email: "admin@demo.com") do |u|
    u.password = u.password_confirmation = "password123"
    u.first_name = "Alice"; u.last_name = "Admin"
    u.role = :admin; u.organization = org
  end

  manager = User.find_or_create_by!(email: "manager@demo.com") do |u|
    u.password = u.password_confirmation = "password123"
    u.first_name = "Bob"; u.last_name = "Manager"
    u.role = :manager; u.organization = org
  end

  tech1 = User.find_or_create_by!(email: "tech1@demo.com") do |u|
    u.password = u.password_confirmation = "password123"
    u.first_name = "Carlos"; u.last_name = "Tech"
    u.role = :technician; u.organization = org
  end

  tech2 = User.find_or_create_by!(email: "tech2@demo.com") do |u|
    u.password = u.password_confirmation = "password123"
    u.first_name = "Diana"; u.last_name = "Tech"
    u.role = :technician; u.organization = org
  end

  ActsAsTenant.with_tenant(org) do
    # ── Locations ─────────────────────────────────────────────────────────────
    site      = Location.find_or_create_by!(name: "Main Factory") { |l| l.location_type = :site }
    bldg_b    = Location.find_or_create_by!(name: "Building B")   { |l| l.location_type = :building; l.parent = site }
    floor_1   = Location.find_or_create_by!(name: "Floor 1")      { |l| l.location_type = :floor; l.parent = site }
    mech_room = Location.find_or_create_by!(name: "Mechanical Room") { |l| l.location_type = :room; l.parent = bldg_b }

    # ── Assets ────────────────────────────────────────────────────────────────
    pump1 = Asset.find_or_create_by!(name: "Pump-01") do |a|
      a.serial_number = "SN-PUMP-001"; a.status = :operational; a.location = floor_1
      a.custom_fields = { manufacturer: "Grundfos", model: "CM5-6", year: 2021 }
    end
    pump2 = Asset.find_or_create_by!(name: "Pump-02")      { |a| a.status = :degraded;    a.location = floor_1   }
    hvac1 = Asset.find_or_create_by!(name: "HVAC-01")      { |a| a.status = :operational; a.location = mech_room }
    _gen  = Asset.find_or_create_by!(name: "Generator-01") { |a| a.status = :operational; a.location = mech_room }

    # ── Parts ─────────────────────────────────────────────────────────────────
    [
      { name: "Oil Filter",      sku: "PT-001", quantity_on_hand: 12, reorder_point: 3 },
      { name: "V-Belt Drive",    sku: "PT-002", quantity_on_hand: 4,  reorder_point: 2 },
      { name: "HVAC Air Filter", sku: "PT-003", quantity_on_hand: 24, reorder_point: 6 },
      { name: "Pump Seal Kit",   sku: "PT-004", quantity_on_hand: 2,  reorder_point: 1 }
    ].each { |a| Part.find_or_create_by!(sku: a[:sku]) { |p| p.assign_attributes(a.merge(location: mech_room)) } }

    # ── Work Orders ───────────────────────────────────────────────────────────
    WorkOrder.find_or_create_by!(title: "Pump-01 Oil Change") do |wo|
      wo.priority = :high; wo.status = :in_progress
      wo.asset = pump1; wo.assignee = tech1; wo.requester = manager
      wo.due_date = 2.days.from_now; wo.description = "Scheduled oil change and filter replacement."
    end
    WorkOrder.find_or_create_by!(title: "HVAC-01 Filter Replacement") do |wo|
      wo.priority = :medium; wo.status = :open; wo.asset = hvac1; wo.requester = manager
      wo.due_date = 5.days.from_now
    end
    WorkOrder.find_or_create_by!(title: "Pump-02 Vibration Investigation") do |wo|
      wo.priority = :critical; wo.status = :assigned
      wo.asset = pump2; wo.assignee = tech2; wo.requester = admin; wo.due_date = Date.today
    end

    # ── PM Schedules ──────────────────────────────────────────────────────────
    PreventiveMaintenance.find_or_create_by!(name: "Monthly Pump Oil Change") do |pm|
      pm.asset = pump1; pm.assigned_to = tech1
      pm.frequency_type = :time_based; pm.frequency_value = 30; pm.frequency_unit = "days"
      pm.priority = :medium; pm.status = :active
      pm.start_date = 1.month.ago; pm.next_due_at = 5.days.from_now; pm.estimated_hours = 1.5
      pm.template = {
        title: "{asset_name} - Monthly Oil Change", description: "Monthly oil change.",
        checklist: [
          { step: 1, instruction: "Shut down pump safely",  required: true },
          { step: 2, instruction: "Drain old oil",           required: true },
          { step: 3, instruction: "Replace oil filter",      required: true },
          { step: 4, instruction: "Fill with new oil",       required: true },
          { step: 5, instruction: "Test run 10 minutes",     required: true }
        ], estimated_hours: 1.5
      }
    end
    PreventiveMaintenance.find_or_create_by!(name: "Quarterly HVAC Service") do |pm|
      pm.asset = hvac1; pm.assigned_to = tech2
      pm.frequency_type = :time_based; pm.frequency_value = 90; pm.frequency_unit = "days"
      pm.priority = :medium; pm.status = :active
      pm.start_date = 3.months.ago; pm.next_due_at = 3.days.from_now; pm.estimated_hours = 3.0
      pm.template = {
        title: "{asset_name} - Quarterly Service", description: "Full HVAC quarterly service.",
        checklist: [
          { step: 1, instruction: "Replace air filters",       required: true },
          { step: 2, instruction: "Clean condenser coils",     required: true },
          { step: 3, instruction: "Check refrigerant levels",  required: true }
        ], estimated_hours: 3.0
      }
    end

    # ── IoT Rules ─────────────────────────────────────────────────────────────
    IotRule.find_or_create_by!(name: "Pump-01 High Vibration Alert") do |r|
      r.asset = pump1; r.created_by = admin
      r.metric_name = "vibration"; r.operator = :gt; r.threshold = 8.5; r.unit = "mm/s"
      r.status = :active; r.auto_create_wo = true; r.wo_priority = :critical
      r.cooldown_minutes = 60; r.sustained_duration_seconds = 300; r.assigned_to = tech1
      r.wo_title_template = "{asset_name} - High Vibration Alert ({value} {unit})"
      r.wo_description_template = "Vibration {value} {unit} exceeded threshold {threshold} {unit}."
    end
    IotRule.find_or_create_by!(name: "HVAC-01 High Temperature") do |r|
      r.asset = hvac1; r.created_by = admin
      r.metric_name = "temperature"; r.operator = :gt; r.threshold = 85.0; r.unit = "celsius"
      r.status = :active; r.auto_create_wo = true; r.wo_priority = :high
      r.cooldown_minutes = 30; r.assigned_to = tech2
      r.wo_title_template = "{asset_name} - High Temperature Alert"
      r.wo_description_template = "Temperature {value}°C exceeded {threshold}°C."
    end

    # ── Sample Sensor Readings ────────────────────────────────────────────────
    [[pump1, "vibration", "mm/s"], [hvac1, "temperature", "celsius"]].each do |asset, metric, unit|
      next if SensorReading.where(asset: asset, metric_name: metric).exists?
      48.times do |i|
        SensorReading.create!(
          asset: asset, metric_name: metric,
          value: (asset == pump1 ? 2.5 + rand * 4.0 : 65.0 + rand * 15.0).round(2),
          unit: unit, source: :rest_api,
          recorded_at: (48 - i).hours.ago, received_at: (48 - i).hours.ago
        )
      end
    end
  end
end

puts ""
puts "✅  Demo data seeded!"
puts "    admin@demo.com   / password123"
puts "    manager@demo.com / password123"
puts "    tech1@demo.com   / password123"
puts "    tech2@demo.com   / password123"
