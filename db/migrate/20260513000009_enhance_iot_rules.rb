class EnhanceIotRules < ActiveRecord::Migration[8.1]
  def change
    # Rename old columns to new names
    rename_column :iot_rules, :duration_seconds, :sustained_duration_seconds
    rename_column :iot_rules, :work_order_title_template, :wo_title_template

    # Replace string operator with integer enum
    remove_column :iot_rules, :operator, :string
    add_column    :iot_rules, :operator, :integer, null: false, default: 0

    # Replace boolean active with integer status enum (0=active,1=paused,2=archived)
    remove_column :iot_rules, :active, :boolean
    add_column    :iot_rules, :status, :integer, null: false, default: 0

    # Replace string priority with integer wo_priority enum
    remove_column :iot_rules, :priority, :string
    add_column    :iot_rules, :wo_priority, :integer, null: false, default: 1  # high

    # New columns
    add_column :iot_rules, :description,          :text
    add_column :iot_rules, :created_by_id,         :integer
    add_column :iot_rules, :threshold_max,         :decimal, precision: 15, scale: 6
    add_column :iot_rules, :unit,                  :string
    add_column :iot_rules, :breach_started_at,     :datetime
    add_column :iot_rules, :wo_description_template, :text
    add_column :iot_rules, :assigned_to_id,        :integer
    add_column :iot_rules, :last_triggered_at,     :datetime
    add_column :iot_rules, :last_wo_created_at,    :datetime
    add_column :iot_rules, :trigger_count,         :integer, null: false, default: 0
    add_column :iot_rules, :times_acknowledged,    :integer, null: false, default: 0

    add_foreign_key :iot_rules, :users, column: :created_by_id
    add_foreign_key :iot_rules, :users, column: :assigned_to_id
  end
end
