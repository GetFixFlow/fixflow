# Which AI provider a company has chosen (none until an administrator picks one), and how each provider is set up (see AiConfig).
class AddAiSettingsToOrganizations < ActiveRecord::Migration[8.1]
  def change
    add_column :organizations, :ai_settings, :jsonb, default: {}, null: false
  end
end
