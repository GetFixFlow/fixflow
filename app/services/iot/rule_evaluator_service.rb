module Iot
  class RuleEvaluatorService
    # Evaluate all active rules for the given asset + sensor reading.
    def self.evaluate(asset, sensor_reading)
      rules = IotRule
        .where(asset_id: asset.id, metric_name: sensor_reading.metric_name)
        .where(status: :active)

      rules.each do |rule|
        if check_threshold(rule, sensor_reading.value)
          handle_breach(rule, sensor_reading)
        else
          handle_clear(rule)
        end
      end
    end

    # Returns true when the reading value breaches the rule threshold.
    def self.check_threshold(rule, value)
      rule.breach?(value)
    end

    def self.handle_breach(rule, sensor_reading)
      return if rule.on_cooldown?

      # Sustained duration check
      if rule.sustained_duration_seconds.to_i > 0
        if rule.breach_started_at.nil?
          rule.update_columns(breach_started_at: Time.current)
          return
        end

        elapsed = Time.current - rule.breach_started_at
        return if elapsed < rule.sustained_duration_seconds
      end

      alert = create_alert(rule, sensor_reading)

      work_order = nil
      if rule.auto_create_wo
        work_order = generate_work_order(rule, sensor_reading, alert)
        alert.update_columns(work_order_id: work_order.id)
      end

      rule.increment!(:trigger_count)
      rule.update_columns(
        last_triggered_at:  Time.current,
        last_wo_created_at: work_order ? Time.current : rule.last_wo_created_at,
        breach_started_at:  nil
      )

      Iot::AlertNotificationJob.perform_later(alert.id)

      alert
    end

    def self.handle_clear(rule)
      rule.update_columns(breach_started_at: nil) if rule.breach_started_at.present?
    end

    def self.generate_work_order(rule, sensor_reading, alert)
      asset = sensor_reading.asset
      vars  = template_vars(rule, sensor_reading)

      WorkOrder.create!(
        organization:     asset.organization,
        asset:            asset,
        iot_rule:         rule,
        iot_alert:        alert,
        title:            rule.build_wo_title(vars),
        description:      rule.build_wo_description(vars),
        priority:         rule.wo_priority,
        status:           "open",
        assignee:         rule.assigned_to
      )
    end

    private_class_method def self.create_alert(rule, sensor_reading)
      IotAlert.create!(
        iot_rule:        rule,
        asset:           sensor_reading.asset,
        sensor_reading:  sensor_reading,
        metric_name:     sensor_reading.metric_name,
        triggered_value: sensor_reading.value,
        threshold:       rule.threshold,
        operator:        rule.operator,
        status:          :open
      )
    end

    private_class_method def self.template_vars(rule, reading)
      asset = reading.asset
      {
        "asset_name"  => asset.name,
        "asset_tag"   => asset.asset_tag,
        "metric_name" => reading.metric_name,
        "value"       => reading.value,
        "unit"        => reading.unit.to_s,
        "threshold"   => rule.threshold,
        "location"    => asset.location&.name.to_s
      }
    end
  end
end
