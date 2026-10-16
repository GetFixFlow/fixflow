class IotRuleBlueprint < Blueprinter::Base
  identifier :id

  # ─── Default view ──────────────────────────────────────────────────────────

  fields :name, :status, :metric_name, :operator, :threshold, :threshold_max,
    :unit, :wo_priority, :auto_create_wo, :cooldown_minutes,
    :last_triggered_at, :trigger_count, :created_at, :updated_at

  field(:asset) do |rule|
    rule.asset ? { id: rule.asset.id, name: rule.asset.name, asset_tag: rule.asset.asset_tag } : nil
  end

  # The names the screens and the rule form use, for the same values. For an "outside range" rule the
  # lower limit is `threshold`, as threshold_min.
  field :asset_id
  field :unit, name: :metric_unit
  field(:threshold_value)    { |rule| rule.threshold.to_f }
  field(:threshold_min)      { |rule| rule.threshold.to_f if rule.outside_range? }
  field(:sustained_minutes)  { |rule| (rule.sustained_duration_seconds / 60.0).round if rule.sustained_duration_seconds }
  field :assigned_to_id, name: :wo_assignee_id
  field :active?, name: :enabled

  # ─── Extended view ─────────────────────────────────────────────────────────

  view :extended do
    fields :name, :description, :status, :metric_name, :operator, :threshold,
      :threshold_max, :unit, :wo_priority, :auto_create_wo, :cooldown_minutes,
      :wo_title_template, :wo_description_template,
      :sustained_duration_seconds, :breach_started_at,
      :last_triggered_at, :last_wo_created_at, :trigger_count, :times_acknowledged,
      :created_at, :updated_at

    field(:asset) do |rule|
      rule.asset ? { id: rule.asset.id, name: rule.asset.name, asset_tag: rule.asset.asset_tag } : nil
    end

    field :asset_id
    field :unit, name: :metric_unit
    field(:threshold_value)    { |rule| rule.threshold.to_f }
    field(:threshold_min)      { |rule| rule.threshold.to_f if rule.outside_range? }
    field(:sustained_minutes)  { |rule| (rule.sustained_duration_seconds / 60.0).round if rule.sustained_duration_seconds }
    field :assigned_to_id, name: :wo_assignee_id
    field :active?, name: :enabled
    field(:wo_assignee) do |rule|
      rule.assigned_to ? { id: rule.assigned_to.id, full_name: rule.assigned_to.full_name } : nil
    end

    field(:assigned_to) do |rule|
      rule.assigned_to ? { id: rule.assigned_to.id, full_name: rule.assigned_to.full_name } : nil
    end

    field(:recent_alerts) do |rule|
      rule.iot_alerts.recent.limit(5).map do |a|
        { id: a.id, status: a.status, triggered_value: a.triggered_value, created_at: a.created_at }
      end
    end
  end
end
