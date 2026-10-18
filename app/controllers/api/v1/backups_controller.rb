module Api
  module V1
    # The database backups in the file storage (Settings, Data Retention). Administrators only: a backup holds
    # everything, password hashes included, so each download is written to the audit log.
    class BackupsController < Api::V1::BaseController
      # A backup is made every night; this is the night plus time for a slow one and for the clock to differ.
      OVERDUE_AFTER = 26.hours

      before_action :require_admin!

      # GET /api/v1/backups
      # => { bucket, backups: [{ name, bytes, created_at }], overdue, error }. A storage that does not answer is an
      # `error` in a normal answer, so the rest of the page keeps working.
      def index
        response.set_header("Cache-Control", "no-store")
        backups = BackupStore.new.list
        render json: { bucket: BackupStore.bucket, backups: backups.map(&:to_h), overdue: overdue?(backups.first), error: nil }
      rescue *BackupStore::UNREACHABLE => e
        Rails.logger.warn "[Backups] Could not list the #{BackupStore.bucket} bucket: #{e.class} — #{e.message}"
        render json: { bucket: BackupStore.bucket, backups: [], overdue: false,
                       error: "The file storage did not answer (#{e.class.name.demodulize}). Check that it is running." }
      end

      # GET /api/v1/backups/:name/download — the file itself, passed on piece by piece.
      def download
        store = BackupStore.new
        name = params[:name].to_s
        size = store.size(name)
        ActivityLogService.log(action: "backup.downloaded", resource: current_organization, user: current_user,
                               metadata: { name: name }, request: request)
        response.headers["Content-Type"] = "application/gzip"
        response.headers["Content-Length"] = size.to_s
        response.headers["Content-Disposition"] =
          ActionDispatch::Http::ContentDisposition.format(disposition: "attachment", filename: name)
        response.headers["Cache-Control"] = "no-store"
        self.response_body = Enumerator.new { |out| store.stream(name) { |chunk| out << chunk } }
      rescue BackupStore::Missing
        render_error("There is no backup with that name", :not_found, code: "RESOURCE_NOT_FOUND")
      rescue *BackupStore::UNREACHABLE => e
        Rails.logger.warn "[Backups] Could not read #{params[:name]}: #{e.class} — #{e.message}"
        render_error("The file storage did not answer. Check that it is running.", :bad_gateway, code: "STORAGE_UNAVAILABLE")
      end

      private

      # Only a server that makes backups can be late with one. With none yet, the company's age is the measure: the
      # first night's backup is not overdue on the first day.
      def overdue?(newest)
        return false unless DatabaseBackupJob.runs_here?

        (newest&.created_at || current_organization.created_at) < OVERDUE_AFTER.ago
      end
    end
  end
end
