class PartMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def low_stock(manager, part, kind)
    @manager = manager
    @part    = part
    @out     = kind.to_s == "out"
    @url     = "#{EmailSetup.base_url}/parts"
    in_language_of(manager) do
      mail(to: manager.email, subject: t(@out ? ".subject_out" : ".subject_low", part: part.name))
    end
  end
end
