# Which plugins a company has switched on, and how each plugin's notification channels are set up (see Plugins::Settings).
class AddPluginSettingsToOrganizations < ActiveRecord::Migration[8.1]
  def change
    add_column :organizations, :plugin_settings, :jsonb, default: {}, null: false
  end
end
