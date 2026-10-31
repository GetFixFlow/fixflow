module Api
  module V1
    # The manuals, photos and certificates kept with an asset. Anyone who works on equipment can add one (a nameplate
    # photographed on the shop floor); taking one away is for whoever added it, or a manager.
    class AssetDocumentsController < Api::V1::BaseController
      before_action :set_asset, only: %i[index create]
      before_action :set_document, only: %i[destroy]

      # GET /api/v1/assets/:asset_id/documents
      def index
        authorize(AssetDocument)
        render json: { documents: AttachmentBlueprint.render_as_hash(@asset.documents.includes(:user).order(created_at: :desc)) }
      end

      # POST /api/v1/assets/:asset_id/documents  (multipart: file, description)
      def create
        authorize(AssetDocument)
        file = params.dig(:document, :file) || params[:file]
        unless file.respond_to?(:original_filename)
          return render_error("Choose a file to upload.", :unprocessable_entity, code: "VALIDATION_ERROR")
        end

        if file.content_type.to_s.start_with?("image/") && !AssetDocument.photo?(file.tempfile)
          return render_error("That file is not a valid photo.", :unprocessable_entity, code: "VALIDATION_ERROR")
        end

        document = @asset.documents.build(description: params[:description].presence, user: current_user)
        document.file.attach(file)
        document.save!
        render json: { data: AttachmentBlueprint.render_as_hash(document) }, status: :created
      end

      # DELETE /api/v1/asset_documents/:id
      def destroy
        authorize(@document)
        @document.destroy!
        head :no_content
      end

      private

      def set_asset
        @asset = current_organization.assets.kept.find(params[:asset_id])
      end

      def set_document
        @document = AssetDocument.joins(:asset).merge(current_organization.assets).find(params[:id])
      end
    end
  end
end
