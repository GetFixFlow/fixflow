require "rails_helper"

RSpec.describe TwoFactorAuth do
  let(:user) { create(:user, email: "pat@example.test") }

  describe "setting up" do
    it "makes a secret that is stored encrypted, and describes it for an authenticator app" do
      setup = user.start_two_factor_setup!

      expect(user.reload).to be_two_factor_pending
      expect(user).not_to be_two_factor_enabled
      expect(setup[:otpauth_uri]).to start_with("otpauth://totp/FixFlow:pat%40example.test")
        .and include("secret=#{setup[:secret]}", "issuer=FixFlow")
      expect(user.otp_secret_ciphertext).not_to include(setup[:secret])
      expect(user.send(:two_factor_secret)).to eq(setup[:secret])
    end

    it "starts again with a new secret when it was never switched on, and refuses once it is on" do
      first = user.start_two_factor_setup![:secret]
      expect(user.start_two_factor_setup![:secret]).not_to eq(first)

      user.enable_two_factor!(code_for(user))
      expect { user.start_two_factor_setup! }.to raise_error(ArgumentError, /already on/)
    end

    it "stays off for a wrong code, and a code with letters or the wrong length" do
      user.start_two_factor_setup!

      ["000000", "12345", "1234567", "abcdef", "", nil].each do |code|
        expect(user.enable_two_factor!(code)).to be_nil, code.inspect
      end
      expect(user.reload).not_to be_two_factor_enabled
    end

    it "switches on with the right code and returns ten recovery codes, stored only as digests" do
      user.start_two_factor_setup!
      codes = user.enable_two_factor!(code_for(user))

      expect(user.reload).to be_two_factor_enabled
      expect(codes.size).to eq(10)
      expect(codes).to all(match(/\A[a-z0-9]{5}-[a-z0-9]{5}\z/))
      expect(codes.uniq.size).to eq(10)
      expect(user.recovery_codes_left).to eq(10)
      expect(user.otp_recovery_digests.join).not_to include(codes.first)
    end

    it "does nothing when no setup was started" do
      expect(user.enable_two_factor!("123456")).to be_nil
    end
  end

  describe "the second step" do
    before { enable_two_factor_for(user) }

    it "accepts a current code, once: the same code does not work twice" do
      freeze_time do
        user.update!(otp_last_step: nil)
        code = code_for(user)

        expect(user.verify_second_factor!(code)).to eq(:code)
        expect(user.verify_second_factor!(code)).to be(false)
      end
    end

    it "accepts the code of the step before or after (clocks differ), and not a code from two minutes ago" do
      user.update!(otp_last_step: nil)
      expect(user.verify_second_factor!(code_for(user, at: 25.seconds.ago))).to eq(:code)

      user.update!(otp_last_step: nil)
      expect(user.verify_second_factor!(code_for(user, at: 2.minutes.ago))).to be(false)
    end

    it "takes a code typed with a space in it" do
      user.update!(otp_last_step: nil)
      code = code_for(user)
      expect(user.verify_second_factor!("#{code[0, 3]} #{code[3, 3]}")).to eq(:code)
    end

    it "accepts a recovery code once, in capitals or not" do
      code = user.regenerate_recovery_codes!.first

      expect(user.verify_second_factor!(code.upcase)).to eq(:recovery_code)
      expect(user.recovery_codes_left).to eq(9)
      expect(user.verify_second_factor!(code)).to be(false)
    end

    it "refuses everything for a person who has not switched it on" do
      other = create(:user)
      other.start_two_factor_setup!

      expect(other.verify_second_factor!(code_for(other))).to be(false)
    end

    it "locks after five wrong answers in a row, even for a right code, and opens again after 15 minutes" do
      5.times { expect(user.verify_second_factor!("000000")).to be(false) }

      expect { user.verify_second_factor!(code_for(user)) }.to raise_error(described_class::Locked, /Too many wrong codes/)

      travel 16.minutes do
        user.update!(otp_last_step: nil)
        expect(user.verify_second_factor!(code_for(user))).to eq(:code)
        expect(user.reload.otp_failed_attempts).to eq(0)
      end
    end

    it "counts only wrong answers in a row: a right one starts the count again" do
      4.times { user.verify_second_factor!("000000") }
      user.update!(otp_last_step: nil)
      expect(user.verify_second_factor!(code_for(user))).to eq(:code)

      4.times { expect(user.verify_second_factor!("000000")).to be(false) }
    end

    it "allows one try after the lock ends, and locks again at once if it is wrong" do
      5.times { user.verify_second_factor!("000000") }

      travel 16.minutes do
        expect(user.verify_second_factor!("000000")).to be(false)
        expect { user.verify_second_factor!("000000") }.to raise_error(described_class::Locked)
      end
    end
  end

  describe "new recovery codes and switching off" do
    it "replaces the recovery codes: the old ones stop working" do
      enable_two_factor_for(user)
      old = user.regenerate_recovery_codes!.first
      user.regenerate_recovery_codes!

      expect(user.verify_second_factor!(old)).to be(false)
    end

    it "switching off removes the secret, the codes and any lock" do
      enable_two_factor_for(user)
      user.update!(otp_failed_attempts: 5, otp_locked_until: 10.minutes.from_now)
      user.disable_two_factor!

      expect(user.reload).to have_attributes(otp_secret_ciphertext: nil, otp_enabled_at: nil, otp_recovery_digests: [],
                                             otp_failed_attempts: 0, otp_locked_until: nil)
      expect(user).not_to be_two_factor_pending
    end
  end

  it "does not put the secret or the recovery codes in the audit trail of user changes" do
    Current.user = user
    enable_two_factor_for(user)
    user.update!(first_name: "Changed")

    lines = ActivityLog.where(resource_type: "User", resource_id: user.id)
    expect(lines).not_to be_empty
    expect(lines.map(&:metadata).to_json).not_to match(/otp|recovery/i)
  end
end
