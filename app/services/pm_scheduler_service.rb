class PmSchedulerService
  # ─── Public Interface ─────────────────────────────────────────────────────

  def self.calculate_next_due(pm)
    base = pm.last_run_at&.to_date || pm.start_date || Date.today

    case pm.frequency_type.to_sym
    when :time_based
      advance_by_unit(base, pm.frequency_value, pm.frequency_unit)
    when :calendar_based
      next_calendar_occurrence(base, pm.frequency_value, pm.frequency_unit)
    when :meter_based, :condition_based
      nil
    end
  end

  def self.generate_work_order(pm)
    ActiveRecord::Base.transaction do
      title       = interpolate(pm.template["title"].to_s, pm)
      description = build_description(pm)
      checklist   = build_checklist(pm.template["checklist"])

      work_order = WorkOrder.create!(
        organization:           pm.organization,
        asset:                  pm.asset,
        assignee:               pm.assigned_to,
        preventive_maintenance: pm,
        title:                  title,
        description:            description,
        priority:               pm.priority,
        checklist:              checklist,
        estimated_hours:        pm.template["estimated_hours"] || pm.estimated_hours,
        due_date:               pm.next_due_at
      )

      execution = pm.pm_executions.create!(
        work_order:     work_order,
        scheduled_date: pm.next_due_at&.to_date || Date.today,
        generated_at:   Time.current,
        status:         :generated
      )

      next_due = calculate_next_due(pm)
      pm.update_columns(
        last_run_at:     Time.current,
        next_due_at:     next_due,
        times_generated: pm.times_generated + 1
      )

      PmMailer.work_order_generated(pm, work_order).deliver_later if pm.assigned_to

      work_order
    end
  end

  def self.should_generate?(pm)
    return false unless pm.status_active?
    return false if pm.next_due_at.nil?
    return false if pm.next_due_at > Time.current + 24.hours
    return false if pm.end_date && pm.end_date < Date.today
    return false if open_work_order_exists?(pm)

    true
  end

  def self.preview_schedule(pm, count: 12)
    return [] if pm.next_due_at.nil?

    dates   = []
    current = pm.next_due_at

    count.times do
      dates << current
      current = advance_by_unit(current.to_date, pm.frequency_value, pm.frequency_unit)
      break if current.nil?
      break if pm.end_date && current.to_date > pm.end_date
    end

    dates
  end

  # ─── Private Helpers ─────────────────────────────────────────────────────

  def self.advance_by_unit(base, value, unit)
    case unit.to_s
    when "days"   then base + value.days
    when "weeks"  then base + value.weeks
    when "months" then base + value.months
    when "hours"  then base + value.hours
    when "cycles" then nil
    else base + value.days
    end
  end
  private_class_method :advance_by_unit

  def self.next_calendar_occurrence(base, day_of_month, unit)
    candidate = base.to_date.next_month.change(day: [day_of_month.to_i, 28].min)
    candidate.to_datetime
  rescue Date::Error
    base + 1.month
  end
  private_class_method :next_calendar_occurrence

  def self.interpolate(text, pm)
    text
      .gsub("{asset_name}", pm.asset&.name.to_s)
      .gsub("{asset_tag}",  pm.asset&.asset_tag.to_s)
      .gsub("{location}",   pm.asset&.location&.full_path.to_s)
      .gsub("{pm_name}",    pm.name.to_s)
  end
  private_class_method :interpolate

  def self.build_description(pm)
    parts = []
    parts << interpolate(pm.template["description"].to_s, pm) if pm.template["description"].present?
    parts << pm.description if pm.description.present?
    parts.join("\n\n").presence || "Preventive maintenance: #{pm.name}"
  end
  private_class_method :build_description

  def self.build_checklist(template_checklist)
    return [] unless template_checklist.is_a?(Array)

    template_checklist.map.with_index(1) do |item, i|
      {
        "step"        => item["step"] || i,
        "instruction" => item["instruction"].to_s,
        "required"    => item["required"] != false,
        "completed"   => false
      }
    end
  end
  private_class_method :build_checklist

  def self.open_work_order_exists?(pm)
    WorkOrder
      .where(preventive_maintenance_id: pm.id)
      .where(status: %w[open assigned in_progress on_hold pending_parts])
      .exists?
  end
  private_class_method :open_work_order_exists?
end
