# Reports and the dashboard

What the dashboard and each report show, the filters, and exporting.

## Cost reports and report filters

**Reports → Cost Analysis** shows what finished work cost: the total, labor, parts and [vendor charges](vendors.md) apart, the average per work order, a trend (a point per day, week or month, chosen by the length of the period), the assets that cost most, the same by place, and what each vendor charged. A cost counts **in the period the work was completed**, so a job opened last month and finished today is today's cost; only completed and verified work counts. Labor comes from [Labor cost](work-orders.md#labor-cost), so it needs an hourly rate to be more than nothing.

The **Filters** panel on every report narrows it by places (including everything inside them), assets, the people who did the work, priorities, and where the work order came from (made by hand, from a PM schedule, or from an IoT rule). Choices combine, each narrowing further.

**Reports are for managers and administrators on the server too**, not just on the screens: labor costs reveal what people are paid, so a technician or requester who calls a report directly gets "forbidden".

## What the report screens show

Each report screen reads the figures the server sends for it, and the Filters panel applies to all of them:

- **Work Orders**: the cards are the period's work orders created, the share completed, the average hours from creation to completion, and the share of those with a due date that missed it. **By Priority** gives, for each priority, what was created, completed and is still open, the average hours from start to finish, and the share overdue (finished late, or still open and past its due date). **MTTR** (mean time to repair) is the average hours from work starting to it being finished, by asset, place and technician, slowest first; work that was never started is left out. **Backlog Aging** counts what is open *now* by age (0-7, 8-14, 15-30 and over 30 days) and priority, and lists the five oldest; it follows the Filters but not the period. The **heatmap** shows work completed on each of the last 13 weeks' days; it follows the Filters but not the period. Days, weeks and months are the company's (Settings, time zone), not UTC.
- **Downtime**: availability, downtime hours, failures, mean time between failures (MTBF) and to restore (MTTR), for all the assets and each one. [Downtime and availability](downtime.md) says how they are worked out.
- **Asset Health**: the health score and counts by status, health by place, and an **inventory** of the assets (those down or degraded first) with place, open and total work orders and open IoT alerts. The maintenance cost is the same figure as on Cost Analysis, for the same period and Filters. Clicking an asset opens its figures: total work orders, cost, average hours to finish work, PM compliance, and its last twelve months of work orders (made by a schedule or not) and IoT alerts. There is no health percentage for a single asset, because nothing defines one.
- **Technician Performance**: each person's work orders in the period and the Filters.
- **PM Compliance**: of the maintenance that came due in the period, the share completed; maintenance that was skipped, or is past its date and still not done ("missed"), counts against it, and maintenance not due yet is left out. The same definition as the PM dashboard and the main dashboard. With nothing due the rate shows "—". It is broken down by month, place and asset, and the forecast table shows what repeats how often and who has it. The assets, places and (for the forecast) people in the Filters panel apply.
- **IoT Analytics** and **Cost Analysis**: as described above.

Report figures are counted each time you open a report; none are cached.

## The dashboard

The first screen differs by role, and the server decides what each person gets. **Managers and administrators** see the company: open and overdue work orders, asset health, PM compliance, open and critical IoT alerts, what was completed this week, schedules due this week, and recent activity. **Technicians** see their own work (assigned, in progress, overdue, completed today), the maintenance assigned to them and their own recent activity. **Requesters** see how many requests they have made, how many are still open and how many are completed. The figures are counted each time the page loads, not cached.

**PM Compliance** is the same figure as on the PM dashboard: of the maintenance that came due in the last 30 days, the share that was completed; skipped and missed ones count against it. It shows "—" when nothing came due. "Due this week" counts schedules due in the next seven days; overdue schedules are counted apart.

## Saved reports, and a PDF by email every week

Choose the filters on **Work Orders**, **Asset Health** or **PM Compliance** and press **Save view**: the filters are kept under a name, and the **Saved views** list on that page brings them back with one click. Every manager and administrator sees all of the company's saved views; the person who saved one, and administrators, can change or delete it. (These are the three reports that can make a PDF.) **Update filters** brings the selected view up to date with the filters you have chosen now. **Manage** (or the link on the Reports page) opens the list of all of them.

**The period moves with the calendar.** A saved view keeps a period, not dates: *the last 7, 30 or 90 days*, *this month so far* or *last month*. "The last 7 days" means the seven whole days before today, so a report that goes out on Monday morning covers a finished week.

**Emailing it.** Tick **Email it as a PDF every week**, choose the weekday and who gets it. It goes out from **7 in the morning, company time** (the time zone in Settings, Organization) on that day, once, as an attachment with the same figures as **Export as PDF** on the screen. A few things to know:

- **Only managers and administrators can be chosen**, because a report shows what work cost, which is made of wages.
- It is made **as the person who saved it**, with the same rules as the screen. If that person stops being a manager or is deactivated, the report is not sent and the **Saved reports** page says why, in red. An administrator can save it again as themselves.
- Each person chosen can turn it off for themselves under **Settings, Notifications** ("A scheduled report is emailed to me"). If nobody is left to send to, nothing is sent and the page says so.
- **Email me now** on the Saved reports page sends the PDF to you alone, to check it looks right without waiting for the day. It does not change the schedule.
- If the mail server fails, FixFlow tries again the next hour of the same day. If it reaches some people and not others, it counts as sent and the page names the addresses it could not reach, so the ones who got it do not get it twice. If the server was down for the whole day, that week's report is skipped.
- Emailing needs the mail server to be set up ([Configuration](configuration.md#email)). The weekly emails are sent by the background worker.

## Reports from plugins

A plugin can add reports of its own. They appear on the Reports page under **From plugins**, for managers and administrators, once an administrator has switched the plugin on under **Settings → Plugins**. They show a table, with a summary above it when the plugin gives one, and have a **Export as CSV** button. See [Plugins](plugins.md).

## Exporting reports

The **Export** menu on a report page downloads the report as a file made by the server, with the same dates and filters as the screen (managers and administrators only, like the reports themselves):

| Report | CSV holds | PDF |
| --- | --- | --- |
| Work Orders | every work order in the period matching the filters: number, title, priority, status, asset, assignee, due, started and completed times, labor, parts, vendor and total cost, and the vendor | the summary (figures, by priority, trend) |
| Asset Health | one row per place: total, operational, degraded, down, health score | yes |
| Downtime | one row per asset: availability, downtime hours, failures, MTBF, MTTR | no |
| PM Compliance | one row per month: scheduled, completed, skipped, compliance rate | yes |
| Cost Analysis | the cost of **every** asset that cost something (the screen shows the top 20): labor, parts, vendors, total, work orders; **Costs by Vendor** has its own file: vendor, charged, work orders | no |
| Technician Performance | each person's figures | no |
| IoT Analytics | every alert in the period matching the filters: when, asset, place, rule, severity, status, the reading and limit, who handled it, work order | no |

Files open in Excel as they are (UTF-8, so accents and non-Latin names are kept; times are `YYYY-MM-DD HH:MM` in the company's time zone, money is a plain number). A CSV holds at most **50,000 work orders**; if there are more, the file is cut and the page says so.

**Text that a spreadsheet would run as a formula is saved as text.** Titles and names can come from anyone (including people reporting a problem without an account), and Excel runs a cell that starts with `=`, `+`, `-` or `@`. Such cells are written with a leading `'`, so a title like `=HYPERLINK(...)` shows as text instead of running.

The files follow the same Filters as the screen: Technician Performance the period, assets, places, people, priorities and source; Asset Health the assets and places (it describes the fleet as it is now, so the period does not apply). For other tools, the same files are at `GET /api/v1/reports/work_orders/summary.csv`, `assets/health.pdf` and so on (the screen's address with `.csv` or `.pdf` on the end, signed in as a manager); a report that has no PDF answers `406`.
