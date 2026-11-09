# A report's filters kept under a name, so a manager can come back to the same view, and optionally emailed as a PDF
# every week to chosen managers.
class CreateSavedReports < ActiveRecord::Migration[8.1]
  def change
    create_table :saved_reports do |t|
      t.references :organization, null: false, foreign_key: true
      # Who saved it. The emailed report is made as this person, so it holds only what they could see.
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      # work_orders, asset_health or pm_compliance: the reports that can make a PDF.
      t.string :report, null: false
      # A period that moves with the calendar (last_7_days, last_30_days, last_90_days, this_month, last_month),
      # not fixed dates, so a weekly email is always about the week just gone.
      t.string :period, null: false, default: "last_30_days"
      # The Filters panel: location_ids, asset_ids, user_ids, priorities, sources.
      t.jsonb :filters, null: false, default: {}
      # The weekday it is emailed, 0 (Sunday) to 6; empty means it is not emailed.
      t.integer :send_on
      t.bigint :recipient_ids, array: true, null: false, default: []
      # The company's date it was last sent, so it is sent once a week however often the job runs.
      t.date :last_sent_on
      t.datetime :last_sent_at
      t.text :last_error
      t.timestamps
    end
    add_index :saved_reports, "organization_id, report, lower(name)", unique: true, name: "index_saved_reports_on_org_report_and_lower_name"
  end
end
