# Locks an account after repeated wrong passwords (Devise lockable, time-based unlock: see config/initializers/devise.rb).
class AddLockableToUsers < ActiveRecord::Migration[8.1]
  def change
    change_table :users, bulk: true do |t|
      t.integer  :failed_attempts, default: 0, null: false
      t.datetime :locked_at
    end
  end
end
