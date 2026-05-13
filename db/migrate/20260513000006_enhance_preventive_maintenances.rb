class EnhancePreventiveMaintenances < ActiveRecord::Migration[8.1]
  def change
    # Drop the old boolean active column and string frequency_type
    remove_index  :preventive_maintenances, column: %i[organization_id active], if_exists: true
    remove_column :preventive_maintenances, :active, :boolean

    # frequency_type was a string; replace with integer enum
    remove_column :preventive_maintenances, :frequency_type, :string

    add_column :preventive_maintenances, :description,      :text
    add_column :preventive_maintenances, :assigned_to_id,   :bigint
    add_column :preventive_maintenances, :priority,         :integer, null: false, default: 2
    add_column :preventive_maintenances, :status,           :integer, null: false, default: 0
    add_column :preventive_maintenances, :estimated_hours,  :decimal, precision: 6, scale: 2
    add_column :preventive_maintenances, :frequency_type,   :integer, null: false, default: 0
    add_column :preventive_maintenances, :start_date,       :date
    add_column :preventive_maintenances, :end_date,         :date
    add_column :preventive_maintenances, :times_generated,  :integer, null: false, default: 0
    add_column :preventive_maintenances, :times_completed,  :integer, null: false, default: 0
    add_column :preventive_maintenances, :times_skipped,    :integer, null: false, default: 0

    add_index :preventive_maintenances, :assigned_to_id
    add_index :preventive_maintenances, :status
    add_index :preventive_maintenances, %i[organization_id status]

    add_foreign_key :preventive_maintenances, :users, column: :assigned_to_id
  end
end
