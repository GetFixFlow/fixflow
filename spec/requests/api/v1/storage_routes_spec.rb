require "rails_helper"

# Active Storage's two routes that let anyone with no sign-in start an upload are closed (config/initializers/
# active_storage_uploads.rb). Downloads by a signed link still work, and the link expires.
RSpec.describe "Stored files", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }

  it "does not let a stranger record a file and get an address to write it to" do
    expect {
      post "/api/v1/storage/direct_uploads",
           params: { blob: { filename: "a.html", byte_size: 3, checksum: "abc", content_type: "text/html" } }.to_json,
           headers: { "Content-Type" => "application/json" }
    }.not_to change(ActiveStorage::Blob, :count)

    expect(response).to have_http_status(:not_found)
  end

  it "does not let a signed-in person do it either: FixFlow uploads through its own controllers" do
    post "/api/v1/storage/direct_uploads", params: { blob: { filename: "a.png", byte_size: 3, checksum: "abc" } }.to_json,
         headers: auth_headers_for(manager).merge("Content-Type" => "application/json")

    expect(response).to have_http_status(:not_found)
  end

  it "does not accept bytes for a disk upload, even with a token that is valid" do
    body = "bytes"
    blob = ActiveStorage::Blob.create_before_direct_upload!(filename: "a.txt", byte_size: body.bytesize, content_type: "text/plain",
                                                            checksum: OpenSSL::Digest::MD5.base64digest(body))
    token = ActiveStorage.verifier.generate({ key: blob.key, content_length: body.bytesize, content_type: "text/plain",
                                              checksum: blob.checksum, service_name: blob.service_name },
                                            expires_in: 5.minutes, purpose: :blob_token)

    put "/api/v1/storage/disk/#{token}", params: body, headers: { "Content-Type" => "text/plain" }

    expect(response).to have_http_status(:not_found)
    expect(blob.service.exist?(blob.key)).to be(false)
  end

  it "still serves a file by its signed link, and the link is good for a week, not for ever" do
    attachment = build(:attachment, work_order: create(:work_order, organization: org), user: manager)
    attachment.file.attach(io: StringIO.new("%PDF-1.4\nhello"), filename: "note.pdf", content_type: "application/pdf")
    attachment.save!

    link = Rails.application.routes.url_helpers.rails_storage_proxy_path(attachment.file, only_path: true)
    get link
    expect(response).to have_http_status(:ok)
    expect(response.body).to start_with("%PDF-1.4")

    travel 8.days do
      get link
      expect(response).to have_http_status(:not_found)
    end
  end
end
