require "rails_helper"

RSpec.describe "Emails in the reader's language", type: :mailer do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org, first_name: "Mia", last_name: "Chen") }
  let(:tech)    { create(:user, organization: org, first_name: "Tomás", last_name: "Ruiz") }
  let(:wo)      { create(:work_order, organization: org, assignee: tech, title: "Bomba rota", priority: "critical") }

  it "writes in English by default" do
    mail = WorkOrderMailer.assigned(wo)

    expect(mail.subject).to eq("[FixFlow] Work Order Assigned: #{wo.work_order_number}")
    expect(mail.body.encoded).to include("Hi Tomás Ruiz,", "A work order has been assigned to you.", "Priority:", "CRITICAL")
  end

  it "writes in the language the person chose" do
    tech.update!(locale: "es")
    mail = WorkOrderMailer.assigned(wo)

    expect(mail.subject).to eq("[FixFlow] Orden de trabajo asignada: #{wo.work_order_number}")
    body = mail.body.encoded
    expect(body).to include("Hola Tomás Ruiz,", "Se te asignó una orden de trabajo.", "Prioridad:", "CRÍTICA")
    expect(body).to include("Fecha límite:", "Sin definir")
    expect(body).not_to include("Hi Tomás Ruiz")
  end

  it "uses the company's language for a person who has not chosen, and their own choice over the company's" do
    org.update!(settings: { "language" => "es" })

    expect(WorkOrderMailer.assigned(wo).body.encoded).to include("Hola Tomás Ruiz,")

    tech.update!(locale: "en")
    expect(WorkOrderMailer.assigned(wo).body.encoded).to include("Hi Tomás Ruiz,")
  end

  it "lines the values up under the labels of the language it is written in" do
    tech.update!(locale: "es")
    lines = WorkOrderMailer.assigned(wo).body.encoded.lines.grep(/\A(Orden de trabajo|Título|Prioridad|Fecha límite):/)

    expect(lines.map { |line| line.index(/: +\S/) + line[/: +/].length }.uniq.size).to eq(1)
  end

  it "puts the language back after building the email" do
    tech.update!(locale: "es")
    WorkOrderMailer.assigned(wo).body

    expect(I18n.locale).to eq(:en)
  end

  it "writes the public requester's email in the company's language, as they have no account" do
    org.update!(settings: { "language" => "es" })
    public_wo = create(:work_order, organization: org, requester_email: "visitor@example.com", title: "Luz")
    mail = WorkOrderMailer.verified_public(public_wo)

    expect(mail.subject).to eq("[FixFlow] Tu solicitud de mantenimiento se ha completado")
    expect(mail.body.encoded).to include("Hola,", "Gracias por enviar tu solicitud.")
  end

  it "says how many in the form the language needs (one or many)" do
    manager.update!(locale: "es")
    asset = ->(n) { create_list(:asset, n, organization: org, warranty_expires_on: 10.days.from_now.to_date) }

    expect(WarrantyMailer.expiring(manager, asset.call(1)).subject).to eq("[FixFlow] 1 garantía termina en menos de 30 días")
    expect(WarrantyMailer.expiring(manager, asset.call(2)).subject).to eq("[FixFlow] 2 garantías terminan en menos de 30 días")
  end

  it "writes dates with the month names of the language" do
    manager.update!(locale: "es")
    asset = create(:asset, organization: org, name: "Compresor", warranty_expires_on: Date.new(2026, 12, 3))

    expect(WarrantyMailer.expiring(manager, [asset]).body.encoded).to include("3 dic 2026: Compresor")
  end

  it "translates every email without leaving a missing-text marker" do # rubocop:disable RSpec/ExampleLength
    manager.update!(locale: "es")
    tech.update!(locale: "es")
    pm = create(:preventive_maintenance, organization: org, assigned_to: tech)
    mails = [
      PasswordMailer.reset(tech, "https://x.test/reset"),
      SystemMailer.test_email(tech, from: "a@b.test"),
      BackupMailer.failed(manager, "disk full", Time.current),
      InvitationMailer.invite(tech, "https://x.test/invite", "Bienvenido"),
      PartMailer.low_stock(manager, create(:part, organization: org, quantity_on_hand: 0), "out"),
      PartMailer.low_stock(manager, create(:part, organization: org), "low"),
      WorkOrderMailer.needs_verification(wo, manager),
      WorkOrderMailer.approval_needed(wo, manager),
      WorkOrderMailer.new_request(wo, manager),
      WorkOrderMailer.verified(create(:work_order, organization: org, requester: tech)),
      PmMailer.work_order_generated(pm, wo), PmMailer.due_soon_summary(tech, [pm]), PmMailer.overdue_summary(manager, [pm])
    ]

    mails.each do |mail|
      text = [mail.subject, mail.body.encoded].join("\n")
      expect(text).not_to match(/translation missing|Translation missing/), mail.subject
      expect(text).to include("FixFlow"), mail.subject
      expect(text).not_to include("Hi "), mail.subject
      expect(mail.subject).not_to match(/Reset your|Test email|failed|invited|Out of stock|Running low|Ready for|Needs approval/),
mail.subject
    end
  end
end
