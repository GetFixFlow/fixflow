module Api
  module V1
    module Ai
      class AssistController < Api::V1::Ai::BaseController
        include ActionController::Live

        def create
          work_order = visible_work_orders.find(params[:work_order_id])
          message = params.require(:message)

          response.headers["Content-Type"] = "text/event-stream"
          response.headers["Cache-Control"] = "no-cache"
          response.headers["X-Accel-Buffering"] = "no"

          messages = ::Ai::AssistService.build_messages(params[:conversation_history] || [], message)
          system_prompt = ::Ai::AssistService.system_prompt(work_order)
          citations = manual_citations(work_order)

          Timeout.timeout(::Ai::Client.stream_timeout(current_organization)) do
            ::Ai::Client.stream(messages: messages, system: system_prompt, organization: current_organization) do |delta|
              write_event(text: delta)
            end
          end

          write_event(done: true, citations: citations)
        rescue ActiveRecord::RecordNotFound
          write_event(error: "Work order not found")
        rescue Timeout::Error
          write_event(error: "The AI assistant took too long to respond. Please try again.")
        rescue ::Ai::Client::Error => e
          write_event(error: e.message)
        ensure
          response.stream.close
        end

        private

        def write_event(payload)
          response.stream.write("data: #{payload.to_json}\n\n")
        end

        def manual_citations(work_order)
          work_order.asset&.manuals&.map { |file| file.filename.to_s } || []
        end
      end
    end
  end
end
