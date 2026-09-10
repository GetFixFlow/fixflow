module Ai
  class AssistService
    MAX_HISTORY_TURNS = 10
    RECENT_WORK_ORDERS_LIMIT = 5

    SYSTEM_PROMPT = <<~PROMPT.freeze
      You are FixFlow Assist, an AI maintenance helper embedded inside a work
      order management system. You help field technicians answer questions
      about maintenance tasks.

      You have access to:
      - The current work order's details
      - The asset's maintenance history
      - Equipment manuals and documents (when attached)

      Guidelines:
      - Be concise and practical — technicians are in the field.
      - Always cite your source (manual, past work order) when you draw on one.
      - If unsure, say so clearly rather than guessing.
      - Prioritize safety information first.
      - Use numbered steps for procedures.
      - Keep answers under 200 words unless detail is safety-critical.
      - Always verify: remind the technician to confirm safety-critical steps
        against the physical equipment and official documentation.
    PROMPT

    def self.system_prompt(work_order)
      "#{SYSTEM_PROMPT}\n\n#{build_context(work_order)}"
    end

    def self.build_context(work_order)
      asset = work_order.asset

      <<~CONTEXT
        === CURRENT WORK ORDER ===
        Title: #{work_order.title}
        Description: #{work_order.description}
        Priority: #{work_order.priority}
        Status: #{work_order.status}
        #{asset ? asset_section(asset) : "Asset: (none assigned)"}

        Checklist:
        #{format_checklist(work_order.checklist)}

        === ASSET MAINTENANCE HISTORY ===
        #{asset ? recent_work_orders(asset, exclude: work_order).map { |wo| format_past_wo(wo) }.join("\n") : "(no asset assigned)"}

        === ASSET DOCUMENTS ===
        #{asset ? document_excerpts(asset) : "(no asset assigned)"}
      CONTEXT
    end

    def self.build_messages(conversation_history, new_message)
      truncated = Array(conversation_history).last(MAX_HISTORY_TURNS * 2).map do |turn|
        { role: turn[:role] || turn["role"], content: turn[:content] || turn["content"] }
      end
      truncated + [ { role: "user", content: new_message } ]
    end

    def self.asset_section(asset)
      <<~ASSET.chomp
        Asset: #{asset.name} (#{asset.asset_tag})
        Location: #{asset.location&.name}
        Serial: #{asset.serial_number}
      ASSET
    end
    private_class_method :asset_section

    def self.recent_work_orders(asset, exclude:)
      asset.work_orders
           .where(status: %w[completed verified])
           .where.not(id: exclude.id)
           .order(completed_at: :desc)
           .limit(RECENT_WORK_ORDERS_LIMIT)
    end
    private_class_method :recent_work_orders

    def self.format_past_wo(wo)
      "- #{wo.title} (completed #{wo.completed_at&.to_date}): #{wo.completion_notes.presence || 'no notes recorded'}"
    end
    private_class_method :format_past_wo

    def self.format_checklist(checklist)
      return "(none)" if checklist.blank?

      Array(checklist).map.with_index(1) { |item, i| "#{i}. #{item['instruction'] || item[:instruction]}" }.join("\n")
    end
    private_class_method :format_checklist

    def self.document_excerpts(asset)
      docs = asset.documents.limit(2)
      return "(no manuals uploaded)" if docs.none?

      docs.map { |doc| "--- #{doc.filename} ---\n#{Ai::PdfTextExtractorService.extract(doc)}" }.join("\n\n")
    end
    private_class_method :document_excerpts
  end
end
