require "rails_helper"

# What a contributor must keep true when they add or change a language (docs/translating.md).
RSpec.describe "Translation files" do # rubocop:disable RSpec/DescribeClass
  def flatten(hash, prefix = nil)
    hash.each_with_object({}) do |(key, value), flat|
      path = [prefix, key].compact.join(".")
      value.is_a?(Hash) ? flat.merge!(flatten(value, path)) : flat[path] = value
    end
  end

  def load_texts(code)
    Rails.root.glob("config/locales/*.#{code}.yml").push(Rails.root.join("config/locales/#{code}.yml").to_s)
      .select { |file| File.exist?(file) }
      .map { |file| YAML.safe_load_file(file).fetch(code) }
      .reduce({}) { |all, texts| all.merge(flatten(texts)) }
  end

  def placeholders(text) = text.to_s.scan(/%\{(\w+)\}/).flatten.sort

  Locales.codes.without("en").each do |code|
    describe code do
      let(:english) { load_texts("en") }
      let(:other)   { load_texts(code) }

      it "has its own name" do
        expect(other["language_name"]).to be_present
      end

      it "has every email text that English has, and nothing English lacks" do
        mail_keys = ->(texts) { texts.keys.grep(/\A(mail|[a-z_]+_mailer)\./) }

        expect(mail_keys.call(other)).to match_array(mail_keys.call(english))
      end

      it "names the same placeholders as English in every text it translates" do
        wrong = other.select { |key, text| english.key?(key) && placeholders(text) != placeholders(english[key]) }

        expect(wrong.keys).to eq([])
      end
    end
  end

  it "has the English texts for the plural forms a language uses (one, other)" do
    expect(english = load_texts("en")).to include("pm_mailer.due_soon_summary.subject.one")
    expect(english).to include("pm_mailer.due_soon_summary.subject.other")
  end
end
