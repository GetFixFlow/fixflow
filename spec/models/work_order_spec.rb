require "rails_helper"

RSpec.describe WorkOrder, type: :model do
  let(:organization) { create(:organization) }
  let(:technician)   { create(:user, organization: organization, role: "technician") }
  let(:manager)      { create(:user, organization: organization, role: "manager") }

  describe "validations" do
    it "is valid with required attributes" do
      wo = build(:work_order, organization: organization)
      expect(wo).to be_valid
    end

    it "requires a title" do
      wo = build(:work_order, organization: organization, title: nil)
      expect(wo).not_to be_valid
      expect(wo.errors[:title]).to be_present
    end

    it "rejects invalid priority" do
      wo = build(:work_order, organization: organization, priority: "extreme")
      expect(wo).not_to be_valid
    end

    it "requires completion_notes when completed" do
      wo = build(:work_order, :completed, organization: organization, completion_notes: nil)
      expect(wo).not_to be_valid
      expect(wo.errors[:completion_notes]).to be_present
    end

    it "requires completion_notes when verified" do
      wo = build(:work_order, :verified, organization: organization, completion_notes: nil)
      expect(wo).not_to be_valid
    end

    it "rejects assignee from a different organization" do
      other_org  = create(:organization)
      other_user = create(:user, organization: other_org)
      wo = build(:work_order, organization: organization, assignee: other_user)
      expect(wo).not_to be_valid
      expect(wo.errors[:assignee]).to be_present
    end

    it "rejects verified_by same as assignee" do
      wo = build(:work_order, organization: organization, assignee: technician, verified_by: technician)
      expect(wo).not_to be_valid
      expect(wo.errors[:verified_by]).to be_present
    end
  end

  describe "work_order_number generation" do
    it "auto-generates a WO number on create" do
      wo = create(:work_order, organization: organization, work_order_number: nil)
      expect(wo.work_order_number).to match(/\AWO-\d{6}\z/)
    end

    it "generates sequential numbers" do
      wo1 = create(:work_order, organization: organization, work_order_number: nil)
      wo2 = create(:work_order, organization: organization, work_order_number: nil)
      n1 = wo1.work_order_number.delete_prefix("WO-").to_i
      n2 = wo2.work_order_number.delete_prefix("WO-").to_i
      expect(n2).to eq(n1 + 1)
    end

    it "does not overwrite an existing work_order_number" do
      wo = create(:work_order, organization: organization, work_order_number: "WO-999999")
      expect(wo.work_order_number).to eq("WO-999999")
    end
  end

  describe "AASM state machine" do
    subject(:work_order) { create(:work_order, organization: organization) }

    it "starts in open state" do
      expect(work_order).to be_open
    end

    context "assign event" do
      it "transitions open → assigned" do
        work_order.assignee = technician
        expect { work_order.assign! }.to change { work_order.status }.from("open").to("assigned")
      end

      it "enqueues NotifyAssigneeJob" do
        work_order.assignee = technician
        expect { work_order.assign! }.to have_enqueued_job(NotifyAssigneeJob).with(work_order.id)
      end
    end

    context "start event" do
      let(:work_order) { create(:work_order, :assigned, organization: organization, assignee: technician) }

      it "transitions assigned → in_progress" do
        expect { work_order.start! }.to change { work_order.status }.from("assigned").to("in_progress")
      end

      it "sets started_at" do
        expect { work_order.start! }.to change { work_order.started_at }.from(nil)
      end

      it "does not overwrite existing started_at" do
        work_order.update!(started_at: 1.hour.ago)
        original = work_order.started_at
        work_order.start!
        expect(work_order.started_at).to be_within(1.second).of(original)
      end
    end

    context "complete event" do
      let(:work_order) do
        create(:work_order, :in_progress, organization: organization, assignee: technician)
      end

      it "transitions in_progress → completed when notes present" do
        work_order.completion_notes = "Fixed the pipe"
        expect { work_order.complete! }.to change { work_order.status }.to("completed")
      end

      it "does not transition without completion notes" do
        work_order.completion_notes = nil
        work_order.complete!
        expect(work_order.status).to eq("in_progress")
      end

      it "sets completed_at" do
        work_order.completion_notes = "Fixed"
        work_order.complete!
        expect(work_order.completed_at).to be_present
      end

      it "enqueues NotifyManagerJob" do
        work_order.completion_notes = "Fixed"
        expect { work_order.complete! }.to have_enqueued_job(NotifyManagerJob).with(work_order.id)
      end
    end

    context "verify event" do
      let(:work_order) do
        create(:work_order, :completed, organization: organization, assignee: technician)
      end

      it "transitions completed → verified when verifier differs from assignee" do
        work_order.verified_by = manager
        expect { work_order.verify! }.to change { work_order.status }.to("verified")
      end

      it "does not allow assignee to verify own work order" do
        work_order.verified_by = technician
        work_order.verify!
        expect(work_order.status).to eq("completed")
      end

      it "sets verified_at" do
        work_order.verified_by = manager
        work_order.verify!
        expect(work_order.verified_at).to be_present
      end

      it "enqueues NotifyRequesterJob" do
        work_order.verified_by = manager
        expect { work_order.verify! }.to have_enqueued_job(NotifyRequesterJob).with(work_order.id)
      end
    end

    context "reject event" do
      let(:work_order) do
        create(:work_order, :completed, organization: organization, assignee: technician)
      end

      it "transitions completed → in_progress" do
        expect { work_order.reject! }.to change { work_order.status }.to("in_progress")
      end

      it "clears completed_at" do
        work_order.reject!
        expect(work_order.completed_at).to be_nil
      end

      it "enqueues NotifyAssigneeJob" do
        expect { work_order.reject! }.to have_enqueued_job(NotifyAssigneeJob).with(work_order.id)
      end
    end

    context "hold event" do
      let(:work_order) { create(:work_order, :in_progress, organization: organization, assignee: technician) }

      it "transitions in_progress → on_hold" do
        expect { work_order.hold! }.to change { work_order.status }.to("on_hold")
      end
    end

    context "cancel event" do
      it "can cancel from open" do
        expect { work_order.cancel! }.to change { work_order.status }.to("cancelled")
      end

      it "cannot cancel a verified work order" do
        wo = create(:work_order, :verified, organization: organization)
        wo.cancel!
        expect(wo.status).to eq("verified")
      end
    end
  end

  describe "scopes" do
    let!(:open_wo)      { create(:work_order, organization: organization) }
    let!(:assigned_wo)  { create(:work_order, :assigned, organization: organization) }
    let!(:completed_wo) { create(:work_order, :completed, organization: organization) }
    let!(:overdue_wo) do
      create(:work_order, organization: organization, due_date: 2.days.ago)
    end

    it ".active excludes completed, verified, cancelled" do
      expect(WorkOrder.active).to include(open_wo, assigned_wo)
      expect(WorkOrder.active).not_to include(completed_wo)
    end

    it ".unassigned returns work orders with no assignee" do
      expect(WorkOrder.unassigned).to include(open_wo)
      expect(WorkOrder.unassigned).not_to include(assigned_wo)
    end

    it ".overdue returns open work orders past due_date" do
      expect(WorkOrder.overdue).to include(overdue_wo)
      expect(WorkOrder.overdue).not_to include(completed_wo)
    end

    it ".by_priority filters by priority" do
      critical = create(:work_order, :critical, organization: organization)
      expect(WorkOrder.by_priority("critical")).to include(critical)
      expect(WorkOrder.by_priority("critical")).not_to include(open_wo)
    end

    it ".search_by_keyword matches title" do
      wo = create(:work_order, organization: organization, title: "Broken pump motor")
      expect(WorkOrder.search_by_keyword("pump")).to include(wo)
      expect(WorkOrder.search_by_keyword("pump")).not_to include(open_wo)
    end
  end
end
