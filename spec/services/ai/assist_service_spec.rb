require "rails_helper"

RSpec.describe Ai::AssistService do
  let(:organization) { create(:organization) }
  let(:asset) { create(:asset, organization: organization, name: "Pump-01") }
  let(:work_order) do
    create(:work_order, organization: organization, asset: asset, title: "Oil change",
                         description: "Replace oil filter", checklist: [ { "instruction" => "Shut down pump" } ])
  end

  describe ".build_context" do
    it "includes the work order title, description, and checklist" do
      context = described_class.build_context(work_order)

      expect(context).to include("Oil change")
      expect(context).to include("Replace oil filter")
      expect(context).to include("Shut down pump")
    end

    it "includes the asset name and tag" do
      context = described_class.build_context(work_order)

      expect(context).to include("Pump-01")
      expect(context).to include(asset.asset_tag)
    end

    it "includes up to 5 recent completed work orders for the asset" do
      tech = create(:user, organization: organization, role: "technician")
      create_list(:work_order, 3, organization: organization, asset: asset, status: "completed",
                                   completed_at: 1.hour.ago, completion_notes: "Done", assignee: tech)

      context = described_class.build_context(work_order)

      expect(context).to include("ASSET MAINTENANCE HISTORY")
    end

    it "excludes the current work order itself from history even if completed" do
      tech = create(:user, organization: organization, role: "technician")
      completed_wo = create(:work_order, organization: organization, asset: asset, title: "Self WO",
                                          status: "completed", completed_at: 1.hour.ago,
                                          completion_notes: "Done", assignee: tech)
      context = described_class.build_context(completed_wo)

      expect(context.scan("Self WO").size).to eq(1) # only appears once, in the CURRENT WORK ORDER section
    end

    it "includes the text of the PDF manuals kept with the asset, and no other file" do
      create(:asset_document, asset: asset, file_name: "pump-manual.pdf")
      create(:asset_document, asset: asset, file_name: "nameplate.png", content_type: "image/png")
      allow(Ai::PdfTextExtractorService).to receive(:extract).and_return("Torque the bolts to 40 Nm")

      context = described_class.build_context(work_order)

      expect(context).to include("--- pump-manual.pdf ---", "Torque the bolts to 40 Nm")
      expect(context).not_to include("nameplate.png")
    end

    it "says so when no manual is kept with the asset" do
      create(:asset_document, asset: asset, file_name: "nameplate.png", content_type: "image/png")

      expect(described_class.build_context(work_order)).to include("(no manuals uploaded)")
    end

    it "handles a work order with no asset gracefully" do
      wo = create(:work_order, organization: organization, asset: nil)
      expect { described_class.build_context(wo) }.not_to raise_error
    end
  end

  describe ".build_messages" do
    it "appends the new message as the final user turn" do
      messages = described_class.build_messages([], "What tools do I need?")
      expect(messages.last).to eq({ role: "user", content: "What tools do I need?" })
    end

    it "truncates conversation history to the last 10 turns" do
      history = 30.times.map { |i| { role: i.even? ? "user" : "assistant", content: "turn #{i}" } }
      messages = described_class.build_messages(history, "latest question")

      # 10 turns * 2 (user+assistant) = 20, plus the new message = 21
      expect(messages.size).to eq(21)
      expect(messages.last[:content]).to eq("latest question")
    end
  end

  describe ".system_prompt" do
    it "includes the safety-first and citation guidance" do
      prompt = described_class.system_prompt(work_order)
      expect(prompt).to include("Prioritize safety information first")
      expect(prompt).to include("Always verify")
    end
  end
end
