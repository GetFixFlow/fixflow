# The first characters of an API key, kept in the clear so a request finds its key without trying every one: a key is
# found by its hint and then checked in full. Keys made before this have no hint and are found the old way, once, and
# given one when they are next used.
class AddKeyHintToApiKeys < ActiveRecord::Migration[8.1]
  def change
    add_column :api_keys, :key_hint, :string
    add_index :api_keys, :key_hint
  end
end
