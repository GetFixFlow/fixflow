# The schedule: who is doing what, and who has too much

**Schedule** (in the menu, for managers and administrators) shows the open work of every technician laid out by day, so you can see at a glance who is busy and who has room, and move work by dragging it.

## Reading it

Choose **Week** or **Day**, and step with the arrows or press **Today**. Each row is a person, each column a day, and each work order sits on the day it is **due**, coloured by priority. Open a work order by clicking its name.

- The first row, **Nobody yet**, holds work that has no assignee.
- The first column, **Earlier or no date**, holds work that is still open from before the period (late work) or has no due date, so it is not hidden when you look at next week. It shows how many there are and the hours in all of them; if there are more than fit (200), the rest are counted but not listed.
- Under each day of a person's row, a bar shows the hours on that day against what a day holds. A work order with no estimate counts as **one hour** and says "no estimate", because an unestimated job is not a free one. Add estimates on the work order to make the bars truer.

## What counts as too much

A day is **overloaded** when the hours on it are more than a working day, and when there is any work on a day off. The day then turns red, says how far over it is ("over by 2.5 h", in words and not only colour), and is listed in the red notice at the top ("Alice Silva, Tue 13: 11.5 h of 9 h"). When there is none the page says so.

What a working day holds comes from **Settings, Organization**: the **work hours** (a 08:00 to 17:00 day holds 9 hours; lunch is not taken out), the **work days** and the **holidays**. Days off and holidays are shaded and named in the column heading. Everyone has the same day; part-time hours are not modelled.

Only open work counts (open, assigned, in progress, on hold, waiting for parts). Finished and cancelled work is not shown.

## Moving work

**Drag** a work order to another person's day, to another day of the same person, or to **Nobody yet**. Or press the arrows button on it, choose who and which day, and **Move**; use this on a phone, which cannot drag.

| You move it to | What happens |
| --- | --- |
| Another day | The due date changes to that day, at the same time of day (the end of the working day if it had no time) |
| Another person | They are told, as with any assignment. Work that was waiting (open) becomes assigned; work on hold or waiting for parts keeps its status |
| Nobody yet | The person no longer has it; assigned work goes back to open |
| The earlier column | Changes who has it, not when it is due (that column has no date to give) |

Rules:

- Only managers and administrators move work.
- **Work that has been started stays with the person doing it.** Its day can be changed, but to hand it to someone else use **Assign** on the work order, where the change is deliberate.
- Finished, verified and cancelled work cannot be moved.
- Work can be given to technicians, managers and administrators, not to requesters.
- Every move is in the history: a new date appears in the [Audit Log](administrator.md), and a change of person as *assigned*, *reassigned* or *unassigned* in the work order's activity.

## What it does not do

It does not move work automatically to level the load, does not offer part-time or per-person hours, does not use travel time or the time of day to place work within a day, and does not tell the person who *lost* a work order that it was taken from them.
