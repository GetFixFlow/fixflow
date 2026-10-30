# Vendors and contractors (outside companies that do maintenance work), the people to call at each, and the link from a
# work order to the vendor that did it and what they charged.
class CreateVendors < ActiveRecord::Migration[8.1]
  def change
    create_table :vendors do |t|
      t.references :organization, null: false, foreign_key: true
      t.string  :name, null: false
      # What they do ("Electrical", "HVAC", "Crane hire"), free text, used to find the right one.
      t.string  :category
      t.string  :phone
      t.string  :email
      t.string  :website
      t.text    :address
      t.text    :notes
      # A vendor you no longer use is deactivated, not deleted: the work orders they did keep their name.
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :vendors, "organization_id, lower(name)", unique: true, name: "index_vendors_on_organization_id_and_lower_name"

    create_table :vendor_contacts do |t|
      t.references :vendor, null: false, foreign_key: true
      t.string :name, null: false
      t.string :role
      t.string :phone
      t.string :email
      t.timestamps
    end

    add_reference :work_orders, :vendor, foreign_key: true
    # What the vendor charged for this work order, and their invoice or quote number.
    add_column :work_orders, :vendor_cost, :decimal, precision: 10, scale: 2, default: "0.0", null: false
    add_column :work_orders, :vendor_reference, :string
  end
end
