require "English"
require "zlib"
require "tempfile"

# Puts a backup (a plain SQL dump from pg_dump, gzipped or not) into the database. Used by `rails fixflow:restore`.
#
# It restores into an EMPTY database. With replace: true it first deletes everything in the database's public
# schema, in the same transaction as the restore, so a restore that fails leaves the old data exactly as it was.
# The dump is checked to be complete before the database is touched.
class DatabaseRestore
  # Nothing was changed; the message says why.
  class Refused < StandardError; end

  END_MARKER = "-- PostgreSQL database dump complete".freeze
  # Lines that tie a dump to the database user that made it. Backups made before 2026-10 have them, and they stop a
  # restore under any other user ("must be able to SET ROLE"). Single-line statements only, and never inside COPY data.
  OWNERSHIP = /\A(ALTER [A-Z ]+ .+ OWNER TO .+|GRANT .+|REVOKE .+|ALTER DEFAULT PRIVILEGES .+);\s*\z/
  # pg_dump 17 and later start every dump with this (0 is the default: no limit). A server older than 17, such as the
  # postgres:16 in the compose file, does not know the setting and refuses the whole restore, while the app image's own
  # pg_dump is version 18. Skipping it changes nothing on a server that does know it.
  NEWER_SERVER_ONLY = /\ASET transaction_timeout = 0;\s*\z/
  GZIP_MAGIC = "\x1F\x8B".b.freeze
  RELATIONS_IN_PUBLIC = <<~SQL.squish.freeze
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  SQL

  def initialize(path, replace: false, config: ActiveRecord::Base.connection_db_config.configuration_hash)
    @path = path.to_s
    @replace = replace
    @config = config
  end

  # => the number of tables now in the database
  def call
    verify_source!
    refuse_if_not_empty!
    run_psql
    scalar("SELECT count(*) FROM pg_tables WHERE schemaname = 'public'").to_i
  end

  # How the restored database compares with this version of the code: :current, :behind (run db:migrate) or :ahead
  # (the backup is from a newer FixFlow than this one). => [status, versions that differ]
  def self.migration_status
    pool = ActiveRecord::Base.connection_pool
    in_database = pool.migration_context.get_all_versions
    in_code = pool.migration_context.migrations.map(&:version)
    return [:behind, in_code - in_database] if (in_code - in_database).any?
    return [:ahead, in_database - in_code] if (in_database - in_code).any?

    [:current, []]
  end

  # What to tell the person who restored, given migration_status.
  def self.migration_advice(status, versions)
    case status
    when :behind then "The backup is from an older FixFlow: #{versions.size} database changes are still to apply. Run: rails db:migrate"
    when :ahead then "WARNING: the backup is from a NEWER FixFlow (#{versions.size} changes this version does not know). Upgrade first."
    else "The database matches this version of FixFlow."
    end
  end

  private

  def verify_source!
    raise Refused, "There is no file at #{@path}." unless File.file?(@path)

    tail = +""
    read_lines { |line| tail = (tail + line).last(4096) }
    return if tail.include?(END_MARKER)

    raise Refused, "#{File.basename(@path)} is not a complete database dump (it does not end the way pg_dump ends one). " \
                   "The file may have been cut short; nothing was changed."
  rescue Zlib::Error, EOFError => e
    raise Refused, "#{File.basename(@path)} cannot be read as a backup (#{e.message}); nothing was changed."
  end

  def refuse_if_not_empty!
    count = scalar(RELATIONS_IN_PUBLIC).to_i
    return if count.zero? || @replace

    raise Refused, "The database #{@config[:database]} is not empty (#{count} tables, sequences or views). Restore into an " \
                   "empty database, or run again with REPLACE=yes to delete everything in this one first. Nothing was changed."
  end

  def read_lines(&)
    if gzipped?
      Zlib::GzipReader.open(@path, external_encoding: Encoding::BINARY) { |io| each_statement_line(io, &) }
    else
      File.open(@path, "rb") { |io| each_statement_line(io, &) }
    end
  end

  def gzipped? = File.open(@path, "rb") { |file| file.read(2) } == GZIP_MAGIC

  # The lines of the dump, without the ones that tie it to a database user.
  def each_statement_line(io)
    in_copy = false
    io.each_line do |line|
      if in_copy
        in_copy = false if line == "\\.\n"
        yield line
      elsif line.start_with?("COPY ") && line.end_with?("FROM stdin;\n")
        in_copy = true
        yield line
      else
        yield line unless OWNERSHIP.match?(line) || NEWER_SERVER_ONLY.match?(line)
      end
    end
  end

  def run_psql
    errors = Tempfile.new("fixflow_restore")
    command = ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--dbname=#{@config[:database]}"]
    status = pipe_into(command, errors.path)
    return if status.success?

    raise "The restore failed and was rolled back; the database is as it was. psql said: #{File.read(errors.path).strip.truncate(800)}"
  ensure
    errors&.close!
  end

  # Feeds the dump to psql. If anything goes wrong on this side, psql is stopped rather than told the input has
  # ended: a clean end of input would commit half a dump.
  def pipe_into(command, error_path)
    io = IO.popen(connection_env, command, "wb", out: File::NULL, err: [error_path, "w"])
    begin
      io.write("DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n") if @replace
      read_lines { |line| io.write(line) }
    rescue Errno::EPIPE
      nil # psql stopped at its first error; its message is in the error file
    rescue StandardError
      stop(io)
      raise
    ensure
      io.close
    end
    $CHILD_STATUS
  end

  def stop(io)
    Process.kill("TERM", io.pid)
  rescue Errno::ESRCH
    nil
  end

  def scalar(sql)
    output = IO.popen(connection_env, ["psql", "-X", "-At", "--dbname=#{@config[:database]}", "-c", sql], err: %i[child out], &:read)
    raise "Could not ask the database: #{output.strip.truncate(300)}" unless $CHILD_STATUS.success?

    output.strip
  end

  def connection_env
    { "PGHOST" => @config[:host], "PGPORT" => @config[:port]&.to_s, "PGUSER" => @config[:username],
      "PGPASSWORD" => @config[:password] }.compact
  end
end
