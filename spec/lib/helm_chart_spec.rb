require "rails_helper"
require "yaml"

# What can be checked about the Helm chart (deploy/helm/fixflow) without Helm: that it says the same as the rest of the repository
# where it has to. Rendering it, and installing it on a cluster, are bin/check_helm and bin/check_kubernetes (CI jobs).
RSpec.describe "The Helm chart" do # rubocop:disable RSpec/DescribeClass
  let(:chart_dir) { Rails.root.join("deploy/helm/fixflow") }
  let(:chart)     { YAML.safe_load_file(chart_dir.join("Chart.yaml")) }
  let(:values)    { YAML.safe_load_file(chart_dir.join("values.yaml")) }
  let(:compose)   { Rails.root.join("docker-compose.prod.yml").read }
  # .Values.a.b.c (or $v.a.b.c, the short name the helpers use) in a template.
  let(:values_path) { /(?:\.Values|\$v)\.([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)/ }
  let(:templates) { Dir[chart_dir.join("templates/**/*.{yaml,tpl}").to_s] }

  it "is the same version as FixFlow, so that the images it installs are the release it comes with" do
    version = Rails.root.join("VERSION").read.strip

    expect(chart["version"]).to eq(version)
    expect(chart["appVersion"]).to eq(version)
  end

  it "runs the same sensor broker settings as the Docker install" do
    expect(chart_dir.join("files/mosquitto.conf").read).to eq(Rails.root.join("config/mosquitto/mosquitto.conf").read)
  end

  it "runs the same versions of the services underneath as the Docker install" do
    differing = %w[postgresql redis s3 mqtt].reject { |key| compose.include?("image: #{values.dig(key, 'image')}\n") }

    expect(differing).to eq([]), "docker-compose.prod.yml does not run the image the chart runs for: #{differing.join(', ')}"
  end

  it "reads only settings that values.yaml has (so that a mistyped one is found here, not by someone installing)" do
    reads = templates.flat_map do |file|
      File.read(file).scan(values_path).flatten.map { |path| [File.basename(file), path] }
    end
    unknown = reads.uniq.reject do |_file, path|
      !values.dig(*path.split(".")).nil?
    rescue TypeError
      false
    end

    expect(unknown.map { |file, path| "#{file}: #{path}" }).to eq([])
  end

  it "has every secret the templates ask for in the Secret it makes" do
    secret = chart_dir.join("templates/secret.yaml").read
    asked = templates.flat_map { |file| File.read(file).scan(/key: ([A-Z][A-Z0-9_]+)/).flatten }.uniq

    expect(asked - secret.scan(/^\s+([A-Z][A-Z0-9_]+):/).flatten).to eq([])
  end
end
