require "pdf/reader"
require "stringio"

module Ai
  class PdfTextExtractorService
    MAX_CHARS = 10_000
    TRUNCATION_MARKER = "... [truncated]".freeze

    # Extracts text from an ActiveStorage blob (or attachment), truncated to
    # MAX_CHARS for cost control. Returns "" (not an exception) on any
    # extraction failure — a bad/corrupt PDF should degrade gracefully rather
    # than break the calling AI feature.
    def self.extract(blob)
      attached = blob.respond_to?(:blob) ? blob.blob : blob
      return "" unless attached

      reader = PDF::Reader.new(StringIO.new(attached.download))
      text = reader.pages.map(&:text).join("\n").strip
      truncate(text)
    rescue StandardError => e
      Rails.logger.warn("Ai::PdfTextExtractorService failed to extract text: #{e.class} — #{e.message}")
      ""
    end

    def self.truncate(text)
      return text if text.length <= MAX_CHARS

      text[0, MAX_CHARS - TRUNCATION_MARKER.length] + TRUNCATION_MARKER
    end
  end
end
