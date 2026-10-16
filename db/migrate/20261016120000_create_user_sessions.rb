class CreateUserSessions < ActiveRecord::Migration[8.1]
  def change
    # One row per sign-in, so a person can see where they are signed in and end one of them.
    # A token is only good while its row is (see User.jwt_revoked?).
    create_table :user_sessions do |t|
      t.references :user, null: false, foreign_key: true
      t.string :sid, null: false # the id inside the token, and what the screen calls the session
      t.string :jti, null: false # the user's jti at sign-in: a password change replaces it and ends the session
      t.string :user_agent
      t.string :ip_address
      t.datetime :last_active_at, null: false
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.timestamps
    end
    add_index :user_sessions, :sid, unique: true
  end
end
