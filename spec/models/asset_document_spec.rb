require "rails_helper"

RSpec.describe AssetDocument do
  let(:asset) { create(:asset) }

  describe "Asset#manuals" do
    it "is the PDFs kept with the asset, oldest first, two at most, as files" do
      first  = create(:asset_document, asset: asset, file_name: "first.pdf")
      create(:asset_document, asset: asset, file_name: "photo.png", content_type: "image/png")
      second = create(:asset_document, asset: asset, file_name: "second.pdf")
      create(:asset_document, asset: asset, file_name: "third.pdf")
      create(:asset_document, file_name: "other-asset.pdf")

      expect(asset.manuals.map { |file| file.filename.to_s }).to eq(%w[first.pdf second.pdf])
      expect(asset.manuals(1).first.download).to eq(first.file.download)
      expect(second).to be_persisted
    end
  end

  it "needs a file" do
    document = described_class.new(asset: asset, user: create(:user, organization: asset.organization))

    expect(document).not_to be_valid
    expect(document.errors[:file]).to be_present
  end

  it "goes with its asset, file and all" do
    document = create(:asset_document, asset: asset)
    blob = document.file.blob

    expect { asset.destroy! }.to change(described_class, :count).by(-1)
    expect(ActiveStorage::Attachment.where(blob_id: blob.id)).to be_empty
  end
end
