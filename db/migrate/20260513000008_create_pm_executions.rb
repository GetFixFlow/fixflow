class CreatePmExecutions < ActiveRecord::Migration[8.1]
  def change
    create_table :pm_executions do |t|
      t.references :preventive_maintenance, null: false, foreign_key: true
      t.references :work_order,             null: true,  foreign_key: true
      t.date     :scheduled_date, null: false
      t.datetime :generated_at
      t.integer  :status, null: false, default: 0
      t.text     :skip_reason
      t.text     :notes

      t.timestamps
    end

    add_index :pm_executions, :status
    add_index :pm_executions, :scheduled_date
  end
end
