class AddChatSettingsToOrganizations < ActiveRecord::Migration[8.1]
  def change
    # Where the company's chat (Slack, Teams...) messages go: the kind, the events, and the webhook address, which is a
    # secret and is kept encrypted (see ChatConfig).
    add_column :organizations, :chat_settings, :jsonb, null: false, default: {}
  end
end
