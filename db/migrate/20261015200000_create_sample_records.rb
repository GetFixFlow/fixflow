class CreateSampleRecords < ActiveRecord::Migration[8.1]
  def change
    # Which records came from "Load sample data", so they can be removed again without touching real ones.
    create_table :sample_records do |t|
      t.references :organization, null: false, foreign_key: true
      t.string :record_type, null: false
      t.bigint :record_id, null: false
      t.timestamps
    end
    add_index :sample_records, %i[record_type record_id], unique: true
  end
end
