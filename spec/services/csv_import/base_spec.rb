require "rails_helper"

RSpec.describe CsvImport::Base do
  let(:org)      { create(:organization) }
  let(:importer) { described_class.for("parts", org) }

  delegate :preview, to: :importer
  def messages(result) = result.errors.map { |e| [e.row, e.column, e.message] }

  describe "reading files the way people produce them" do
    it "reads a file saved by Excel: a byte order mark and Windows line endings" do
      result = preview("﻿name,sku\r\nOil filter,OF-1\r\nBelt,B-2\r\n")

      expect(result).to be_valid
      expect(result.total_rows).to eq(2)
    end

    it "reads semicolon-separated files, as Excel writes them in countries that use a decimal comma" do
      result = preview("name;sku;unit_cost\nOil filter;OF-1;12,50\n")

      expect(result).to be_valid
      expect(importer.import!("name;sku;unit_cost\nOil filter;OF-1;12,50\n").created).to eq(1)
      expect(org.parts.first.unit_cost).to eq(12.5)
    end

    it "reads tab-separated files" do
      expect(preview("name\tsku\nOil filter\tOF-1\n")).to be_valid
    end

    it "keeps a comma or a line break inside a quoted value" do
      importer.import!(%(name,sku\n"Filter, oil ""large""","line one\nline two"\n))

      expect(org.parts.first).to have_attributes(name: 'Filter, oil "large"', sku: "line one\nline two")
    end

    it "reads Windows-1252 text, as Excel saves it in much of Europe" do
      content = "name,sku\nJoint d'étanchéité,J-1\n".encode(Encoding::Windows_1252).b
      importer.import!(content)

      expect(org.parts.first.name).to eq("Joint d'étanchéité")
    end

    it "understands headings in any case, with spaces, and common alternative names" do
      importer.import!("Part Name,SKU,Qty,Reorder At,Cost\nOil filter,OF-1,12,3,9.5\n")

      expect(org.parts.first).to have_attributes(name: "Oil filter", quantity_on_hand: 12, reorder_point: 3, unit_cost: 9.5)
    end

    it "ignores blank lines and trims spaces around values" do
      result = preview("name,sku\n\n  Oil filter  ,  OF-1  \n,\n\nBelt,B-1\n")

      expect(result.total_rows).to eq(2)
      expect(result.preview.first).to include("name" => "Oil filter", "sku" => "OF-1")
    end

    it "numbers rows the way the spreadsheet does, so an error can be found at once" do
      result = preview("name,sku\nOil filter,OF-1\n,B-2\nGasket,G-3\n,")

      expect(messages(result)).to eq([[3, "name", "The name is empty."]])
    end
  end

  describe "files that cannot be used" do
    {
      "an empty file" => ["", "The file is empty."],
      "an Excel workbook" => ["PK\x03\x04binary", "This looks like an Excel file"],
      "a binary file" => ["name\u0000sku\n", "does not look like a CSV text file"],
      "a quote that never closes" => [%(name,sku\n"Oil filter,OF-1\n), "Check for a quote that is never closed"],
      "headings and nothing else" => ["name,sku\n", "no rows below the headings"]
    }.each do |label, (content, message)|
      it "explains #{label}" do
        expect { preview(content) }.to raise_error(CsvImport::Base::Unreadable, /#{Regexp.escape(message)}/)
      end
    end

    it "refuses more rows than it will take at once" do
      stub_const("CsvImport::Base::MAX_ROWS", 2)

      expect { preview("name\nA\nB\nC\n") }.to raise_error(CsvImport::Base::Unreadable, /Import at most 2/)
    end
  end

  describe "the headings" do
    it "says which required column is missing, on row 1" do
      result = preview("sku,unit\nOF-1,each\n")

      expect(messages(result)).to eq([[1, "name", 'The file needs a "name" column.']])
      expect(result.total_rows).to eq(0)
    end

    it "refuses a column it does not know, listing the ones it does (parts and locations have no custom columns)" do
      result = preview("name,colour\nOil filter,red\n")

      expect(messages(result).first.last).to include('"colour" is not a column this import knows', "name, sku, quantity_on_hand")
    end

    it "says when a column appears twice" do
      expect(messages(preview("name,sku,sku\nOil filter,A,B\n")).first.last).to include('more than one "sku" column')
    end
  end

  describe "importing" do
    it "creates nothing at all when any row has a problem, so the file can be fixed and uploaded again" do
      result = importer.import!("name,sku\nOil filter,OF-1\n,B-2\n")

      expect(result).not_to be_valid
      expect(org.parts.count).to eq(0)
    end

    it "creates everything when the file is clean, and counts it" do
      result = importer.import!("name,sku\nOil filter,OF-1\nBelt,B-2\n")

      expect(result.created).to eq(2)
      expect(org.parts.pluck(:name)).to contain_exactly("Oil filter", "Belt")
    end

    it "changes nothing when only previewing" do
      preview("name,sku\nOil filter,OF-1\n")

      expect(org.parts.count).to eq(0)
    end

    it "uploads the same file twice without doubling anything up: the second time is refused" do
      importer.import!("name,sku\nOil filter,OF-1\n")

      second = described_class.for("parts", org).import!("name,sku\nOil filter,OF-1\n")

      expect(second).not_to be_valid
      expect(org.parts.count).to eq(1)
    end

    it "does not email managers about low stock for parts that are simply brought in" do
      expect { importer.import!("name,quantity_on_hand,reorder_point\nOil filter,1,5\n") }.not_to have_enqueued_job(LowStockAlertJob)
    end
  end

  it "hands out a template that is itself valid, once the places it mentions exist" do
    described_class.for("locations", org).import!("name,type,parent\nPlant,site,\nFloor 1,floor,Plant\nStores,room,Plant\n")

    %w[assets parts].each do |kind|
      template = described_class.for(kind, org).template
      expect(template.lines.size).to eq(2)
      expect(described_class.for(kind, org).preview(template)).to be_valid, "the #{kind} template should import as it is"
    end
    expect(described_class.for("locations", org).template.lines.first).to eq("name,type,parent\n")
  end

  it "does not know any kind but assets, locations and parts" do
    expect { described_class.for("users", org) }.to raise_error(KeyError)
  end
end
