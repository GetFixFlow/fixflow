# Two-factor sign-in with an authenticator app (TOTP). The secret is stored encrypted (see TwoFactorAuth), and the
# recovery codes only as digests, so a copy of the database does not hold a way past the second step.
class AddTwoFactorToUsers < ActiveRecord::Migration[8.1]
  def change
    change_table :users, bulk: true do |t|
      t.text     :otp_secret_ciphertext
      t.datetime :otp_enabled_at
      t.bigint   :otp_last_step
      t.text     :otp_recovery_digests, array: true, default: [], null: false
      t.integer  :otp_failed_attempts, default: 0, null: false
      t.datetime :otp_locked_until
    end
  end
end
