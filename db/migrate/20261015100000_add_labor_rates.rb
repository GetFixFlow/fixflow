class AddLaborRates < ActiveRecord::Migration[8.1]
  def change
    # What one hour of a person's work costs, if different from the company's default rate.
    add_column :users, :hourly_rate, :decimal, precision: 8, scale: 2
    # The rate a work order's labor cost was worked out at, so a later change of rates does not rewrite it.
    add_column :work_orders, :labor_rate, :decimal, precision: 8, scale: 2
  end
end
