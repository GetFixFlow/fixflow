# When an asset stopped and when it ran again. An asset whose status is "down" has one open row (no ended_at); the
# availability and mean-time-between-failures report is worked out from these rows.
class CreateAssetDowntimes < ActiveRecord::Migration[8.1]
  def change
    create_table :asset_downtimes do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :asset, null: false, foreign_key: true
      t.datetime :started_at, null: false
      t.datetime :ended_at
      t.string :reason
      t.references :started_by, foreign_key: { to_table: :users }
      t.references :ended_by, foreign_key: { to_table: :users }

      t.timestamps
    end
    add_index :asset_downtimes, %i[asset_id started_at]
    # An asset is down once: at most one row without an end.
    add_index :asset_downtimes, :asset_id, unique: true, where: "ended_at IS NULL", name: "index_asset_downtimes_one_open_per_asset"

    # Assets that are down now start counting from today: when they stopped was not recorded.
    reversible do |direction|
      direction.up do
        execute <<~SQL.squish
          INSERT INTO asset_downtimes (organization_id, asset_id, started_at, reason, created_at, updated_at)
          SELECT organization_id, id, NOW(), 'Already down when downtime tracking began', NOW(), NOW()
          FROM assets WHERE status = 'down'
        SQL
      end
    end
  end
end
