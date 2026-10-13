class AddUniqueSkuIndexToParts < ActiveRecord::Migration[8.1]
  def up
    # Parts that already share a SKU keep it on the oldest one; the others get their id appended
    # so nothing is lost and the index can be built.
    execute <<~SQL.squish
      UPDATE parts SET sku = NULLIF(BTRIM(sku), '');
      UPDATE parts p SET sku = p.sku || '-' || p.id
      WHERE p.sku IS NOT NULL AND EXISTS (
        SELECT 1 FROM parts o
        WHERE o.organization_id = p.organization_id AND LOWER(o.sku) = LOWER(p.sku) AND o.id < p.id
      );
    SQL

    remove_index :parts, :sku
    add_index :parts, "organization_id, LOWER(sku)", unique: true, where: "sku IS NOT NULL",
              name: "index_parts_on_organization_id_and_lower_sku"
  end

  def down
    remove_index :parts, name: "index_parts_on_organization_id_and_lower_sku"
    add_index :parts, :sku
  end
end
