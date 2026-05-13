RSpec.shared_examples "organization scoped" do
  let(:current_org) { create(:organization) }
  let(:other_org)   { create(:organization) }

  it "does not return records from other organizations" do
    model_name = described_class.name.underscore.to_sym

    own_record   = ActsAsTenant.with_tenant(current_org) { create(model_name, organization: current_org) }
    other_record = ActsAsTenant.with_tenant(other_org)   { create(model_name, organization: other_org) }

    ActsAsTenant.with_tenant(current_org) do
      expect(described_class.all).to     include(own_record)
      expect(described_class.all).not_to include(other_record)
    end
  end
end
