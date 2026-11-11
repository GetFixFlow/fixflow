require "rails_helper"

RSpec.describe Directory::Roles do
  def settings(groups = {}, default_role: nil)
    DirectorySettings.new(role_groups: groups, default_role: default_role)
  end

  it "gives the role of the group the person is in" do
    expect(described_class.resolve(%w[fixflow-technicians], settings({ "technician" => %w[fixflow-technicians] }))).to eq("technician")
  end

  it "gives the highest role when a person is in the groups of several" do
    s = settings({ "technician" => %w[techs], "manager" => %w[leads], "admin" => %w[admins] })

    expect(described_class.resolve(%w[techs leads], s)).to eq("manager")
    expect(described_class.resolve(%w[techs leads admins], s)).to eq("admin")
  end

  it "ignores case, and takes a group's name or its whole distinguished name either way round" do
    dn = "CN=FixFlow Admins,OU=Groups,DC=acme,DC=com"

    expect(described_class.resolve([dn], settings({ "admin" => ["fixflow admins"] }))).to eq("admin")
    expect(described_class.resolve(["FIXFLOW ADMINS"], settings({ "admin" => [dn] }))).to eq("admin")
    expect(described_class.resolve([dn.downcase], settings({ "admin" => [dn] }))).to eq("admin")
  end

  it "does not match a group that only contains the name" do
    expect(described_class.resolve(%w[not-admins admins-2], settings({ "admin" => %w[admins] }))).to be_nil
    expect(described_class.resolve(["CN=Sub Admins,DC=x"], settings({ "admin" => %w[admins] }))).to be_nil
  end

  it "gives the default role to a person in none of the groups, or nothing when there is none" do
    expect(described_class.resolve(%w[other], settings({ "admin" => %w[admins] }, default_role: "requester"))).to eq("requester")
    expect(described_class.resolve(%w[other], settings({ "admin" => %w[admins] }))).to be_nil
    expect(described_class.resolve([], settings({ "admin" => %w[admins] }))).to be_nil
  end

  it "prefers a matched group to the default role" do
    expect(described_class.resolve(%w[admins], settings({ "admin" => %w[admins] }, default_role: "requester"))).to eq("admin")
  end
end
