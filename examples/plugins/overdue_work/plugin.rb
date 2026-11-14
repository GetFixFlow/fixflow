# A sample plugin that adds two REPORTS. Copy this folder into plugins/ to use it (docs/plugins.md explains each line).
#
# A report is a block that is given a context (the company, the person asking and the period) and answers with a table.
# FixFlow draws the table on the Reports page and offers it as a CSV file; the plugin has no screen of its own.
Plugins.define "overdue_work" do
  title "Overdue work"
  version "1.0.0"
  summary "Who has work past its due date right now, and who finishes work late."
  author "FixFlow"
  api 1 # the plugin API this was written for; a FixFlow that offers another one will say so rather than run it

  # period: false means "as of now": the page shows no date picker and the block is given no dates.
  report "overdue_now", title: "Overdue now", period: false,
                        description: "Open work orders that are past their due date, for each person." do |context|
    orders = context.organization.work_orders.overdue.includes(:assignee).to_a
    rows = orders.group_by(&:assignee).map do |person, list|
      {
        "person" => person&.full_name || "Nobody yet",
        "overdue" => list.size,
        "urgent" => list.count { |order| %w[high critical].include?(order.priority) },
        "oldest" => list.map(&:due_date).min
      }
    end

    {
      columns: [
        { key: "person", label: "Assigned to" },
        { key: "overdue", label: "Overdue work orders", kind: "number" },
        { key: "urgent", label: "High or critical", kind: "number" },
        { key: "oldest", label: "Oldest due date", kind: "date" }
      ],
      rows: rows.sort_by { |row| [-row["overdue"], row["person"]] },
      summary: [{ label: "Overdue work orders", value: orders.size, kind: "number" }],
      note: "Open means not yet completed, verified or cancelled."
    }
  end

  # The default, period: true, shows the date picker; the block gets context.from and context.to (the whole day at each end).
  report "finished_late", title: "Finished late",
                          description: "Work finished in the period, and how much of it was after its due date." do |context|
    done = context.organization.work_orders.where(completed_at: context.from..context.to).where.not(due_date: nil).includes(:assignee)
    rows = done.group_by(&:assignee).map do |person, list|
      late = list.count { |order| order.completed_at > order.due_date }
      { "person" => person&.full_name || "Nobody", "finished" => list.size, "late" => late,
        "late_share" => (late * 100.0 / list.size).round(1) }
    end

    {
      columns: [
        { key: "person", label: "Person" },
        { key: "finished", label: "Finished", kind: "number" },
        { key: "late", label: "Finished late", kind: "number" },
        { key: "late_share", label: "Late share", kind: "percent" }
      ],
      rows: rows.sort_by { |row| [-row["late_share"], row["person"]] },
      summary: [{ label: "Finished", value: done.size, kind: "number" }, { label: "Late", value: rows.sum { |row|
        row["late"]
      }, kind: "number" }]
    }
  end
end
