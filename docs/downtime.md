# Downtime, availability and failures

Record when a machine stops and when it runs again, and see how available each one was and how long it runs between failures.

## Recording it

Open the asset and choose the **Downtime** tab.

| Who | Can |
| --- | --- |
| Administrators and managers | Everything below, and correct or delete a record |
| Technicians | Say it stopped, say it runs again, record a stop that is over |
| Requesters | Nothing (they do not see assets) |

- **It stopped** marks the asset **down** from now (or from an earlier time you give, "it stopped at 8 this morning"), with a note on what happened. A red notice shows since when it has been down.
- **Running again** ends the stop, from now or from an earlier time, and the asset goes back to **operational**.
- **A stop nobody recorded.** In *It stopped*, fill in **Running again** as well, and the stop is entered as one that is already over. The asset's status is not touched.
- **The status does the same.** Setting an asset to **down** in its status (or in an import) starts the clock; setting it to anything else (operational, degraded, decommissioned) ends it. So the two always agree, whichever you use.
- **Correcting.** A manager can change the times and the note of a record (the pencil), or delete one that is over (the bin). A stop that is still going on is ended with *Running again*, then corrected if needed. Corrections are in the [Audit Log](administrator.md).
- **Rules that keep the figures honest:** a stop cannot end before it starts, cannot be in the future, and cannot overlap another stop of the same asset.

Assets that were already **down** when downtime tracking arrived are counted from the day of the upgrade, because when they stopped was never recorded. A manager can correct that start.

## The report

**Reports, Downtime** works out, for the period and the Filters you choose (places, assets):

| Figure | Meaning |
| --- | --- |
| **Availability** | The share of the hours the asset existed in the period that it was not down |
| **Downtime** | Hours down within the period (a stop that began before it counts from the start of the period) |
| **Failures** | Stops that **began** in the period |
| **MTBF** | Mean time between failures: hours it ran divided by failures |
| **MTTR** | Mean time to restore: hours down in those stops divided by failures |

An asset counts from the day it was added, and up to now at the latest, so a new machine or the current month is not credited with time that has not happened. An asset with no failure has no MTBF or MTTR (a dash), not zero. Decommissioned and deleted assets are left out. The top of the page adds all the assets up (their hours added together, so a long-lived machine weighs more than a new one); the table lists the **least available first**, and an asset that is down now is marked.

**Export as CSV** gives the table (asset, tag, location, availability, downtime hours, failures, MTBF, MTTR). There is no PDF; **Print** works. Like the other reports, it is for managers and administrators.

Asset Health's single-asset view (**Total downtime**) now uses these records. It used to add up the hours spent repairing, which is not the same thing.
