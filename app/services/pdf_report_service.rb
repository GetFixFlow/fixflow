require "prawn"
require "prawn/table"

class PdfReportService
  BRAND_COLOR = "1a56db"
  HEADER_BG   = "e5edff"
  ROW_ALT     = "f8faff"
  TEXT_COLOR  = "1f2937"

  # ── Public API ─────────────────────────────────────────────────────────────

  def self.work_order_summary(data, org_name: "FixFlow")
    build do |pdf|
      page_header(pdf, org_name, "Work Order Summary Report", data[:period])
      totals_section(pdf, data[:totals])
      priority_section(pdf, data[:by_priority])
      trend_section(pdf, data[:trend])
      page_footer(pdf)
    end
  end

  def self.asset_health_report(data, org_name: "FixFlow")
    build do |pdf|
      page_header(pdf, org_name, "Asset Health Report", nil)
      stats_row(pdf, [
        ["Total Assets",    data[:total]],
        ["Operational",     data[:by_status]&.dig(:operational) || 0],
        ["Degraded",        data[:by_status]&.dig(:degraded) || 0],
        ["Down",            data[:by_status]&.dig(:down) || 0],
        ["Health Score",    "#{data[:health_score]}%"]
      ])
      location_table(pdf, data[:by_location])
      page_footer(pdf)
    end
  end

  def self.pm_compliance_report(data, org_name: "FixFlow")
    build do |pdf|
      page_header(pdf, org_name, "PM Compliance Report", data[:period])
      stats_row(pdf, [
        ["Overall Compliance", "#{data[:overall_compliance_rate]}%"],
        ["Scheduled",          data.dig(:summary, :scheduled) || 0],
        ["Completed",          data.dig(:summary, :completed) || 0],
        ["Skipped",            data.dig(:summary, :skipped) || 0]
      ])
      monthly_table(pdf, data[:by_month])
      page_footer(pdf)
    end
  end

  # ── Private helpers ────────────────────────────────────────────────────────

  def self.build(&block)
    Prawn::Document.new(page_size: "A4", margin: [40, 50, 60, 50]) do |pdf|
      pdf.font_size 10
      pdf.fill_color TEXT_COLOR
      block.call(pdf)
    end.render
  end
  private_class_method :build

  def self.page_header(pdf, org_name, title, period)
    pdf.fill_color BRAND_COLOR
    pdf.text org_name, size: 14, style: :bold
    pdf.fill_color TEXT_COLOR
    pdf.text title, size: 18, style: :bold
    pdf.move_down 4

    if period
      from = period[:from] || period["from"]
      to   = period[:to]   || period["to"]
      pdf.text "Period: #{from} — #{to}", size: 9, color: "6b7280"
    end

    pdf.text "Generated: #{Time.current.strftime('%Y-%m-%d %H:%M UTC')}",
      size: 9, color: "6b7280"
    pdf.stroke_horizontal_rule
    pdf.move_down 12
  end
  private_class_method :page_header

  def self.stats_row(pdf, stats)
    data = [stats.map { |label, _| label }, stats.map { |_, value| value.to_s }]
    pdf.table(data, width: pdf.bounds.width, cell_style: { size: 10, align: :center }) do
      row(0).background_color = HEADER_BG
      row(0).font_style = :bold
    end
    pdf.move_down 14
  rescue => e
    pdf.text "Summary stats unavailable", color: "ef4444"
  end
  private_class_method :stats_row

  def self.totals_section(pdf, totals)
    return unless totals
    pdf.text "Summary", size: 12, style: :bold
    pdf.move_down 6
    rows = totals.map { |k, v| [k.to_s.humanize, v.to_s] }
    table_with_alternating_rows(pdf, ["Metric", "Value"], rows)
    pdf.move_down 12
  end
  private_class_method :totals_section

  def self.priority_section(pdf, by_priority)
    return unless by_priority&.any?
    pdf.text "By Priority", size: 12, style: :bold
    pdf.move_down 6
    rows = by_priority.map { |p, d| [p.to_s.capitalize, d[:created].to_s, d[:completed].to_s, "#{d[:avg_hours]}h"] }
    table_with_alternating_rows(pdf, ["Priority", "Created", "Completed", "Avg Time"], rows)
    pdf.move_down 12
  end
  private_class_method :priority_section

  def self.trend_section(pdf, trend)
    return unless trend&.any?
    pdf.text "Trend", size: 12, style: :bold
    pdf.move_down 6
    rows = trend.first(20).map { |t| [t[:date].to_s, t[:created].to_s, t[:completed].to_s] }
    table_with_alternating_rows(pdf, ["Date", "Created", "Completed"], rows)
  end
  private_class_method :trend_section

  def self.location_table(pdf, locations)
    return unless locations&.any?
    pdf.text "By Location", size: 12, style: :bold
    pdf.move_down 6
    rows = locations.map { |l| [l[:location].to_s, l[:total].to_s, l[:operational].to_s, l[:down].to_s, "#{l[:health_score]}%"] }
    table_with_alternating_rows(pdf, ["Location", "Total", "Operational", "Down", "Health"], rows)
  end
  private_class_method :location_table

  def self.monthly_table(pdf, months)
    return unless months&.any?
    pdf.text "Monthly Breakdown", size: 12, style: :bold
    pdf.move_down 6
    rows = months.map { |m| [m[:month].to_s, m[:scheduled].to_s, m[:completed].to_s, "#{m[:compliance_rate]}%"] }
    table_with_alternating_rows(pdf, ["Month", "Scheduled", "Completed", "Compliance"], rows)
  end
  private_class_method :monthly_table

  def self.table_with_alternating_rows(pdf, headers, rows)
    data = [headers] + rows
    pdf.table(data, width: pdf.bounds.width, header: true,
      cell_style: { size: 9, padding: [4, 6] }) do
      row(0).background_color = HEADER_BG
      row(0).font_style       = :bold
      rows.each_with_index do |_, idx|
        row(idx + 1).background_color = idx.odd? ? ROW_ALT : "ffffff"
      end
    end
  rescue => e
    pdf.text "Table unavailable: #{e.message}", color: "ef4444"
  end
  private_class_method :table_with_alternating_rows

  def self.page_footer(pdf)
    pdf.repeat(:all) do
      pdf.draw_text "FixFlow CMMS", at: [pdf.bounds.left, -30], size: 8, color: "9ca3af"
      pdf.draw_text "Page <page> of <total>",
        at: [pdf.bounds.right - 80, -30], size: 8, color: "9ca3af"
    end
    pdf.page_count.times do |i|
      pdf.go_to_page(i + 1)
      pdf.number_pages "Page <page> of <total>",
        at: [pdf.bounds.right - 100, -30], size: 8, color: "9ca3af"
    end
  end
  private_class_method :page_footer
end
