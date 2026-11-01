# Work orders and maintenance

How work orders move, checklists, labor cost, reporting a problem from a QR label and working offline.

## Work Order Status Flow

```
open → assigned → in_progress → completed → verified
                   |    ^            |
                   v    |            v  (rejected: back to in_progress)
          on_hold / pending_parts
```

A work order can be **cancelled** from any state before it is verified. Only someone other than the technician who did the work can verify it.

## Checklists

A preventive maintenance schedule can carry a **checklist** (set when you create or edit the schedule). Each work order it generates gets a copy, and the technician ticks the steps on their phone as they work. A step is **required** unless it is marked optional: the work order **cannot be completed while a required step is undone**, and the server says which ones are missing. Each tick records **who did it and when**, shown under the step, and the checklist is **locked once the work order is completed**, so what was done stays on the record. Managers can tick steps too. Ticking works **offline**: the tick is kept on the phone, marked "Waiting to sync", and sent when the connection returns (if the work order was completed in the meantime, you are told the tick was not kept).

## Labor cost

A work order's **labor cost** is the hours recorded when it is completed times an **hourly rate**: the technician's own rate if they have one, otherwise the company's default. The rate used is saved with the work order, so raising someone's rate later does not change work already done; correcting the hours works the cost out again at the current rate. Parts and labor add up to the work order's total, and the cost reports now include the labor. When an outside company does the work, a manager gives the work order to a [vendor](vendors.md) and what the vendor charged is added to the total as well.

Set the **default rate** in **Settings → Organization** (Hourly labor rate) and, for a particular person, **Settings → Users → Edit → Hourly rate** (administrators only; leave it empty to use the default). Until a rate is set anywhere, labor counts as nothing, and the work order says so rather than guessing. Because wages are sensitive, only **managers and administrators** see labor costs and rates; technicians and requesters see the parts cost only.

## Approval of costly work

A company can set an **approval limit** in **Settings, Organization** (Approval limit; `0` means no approvals, which is how every company starts). A work order that is expected to cost **more than the limit** cannot be **started** until a **manager or administrator approves** it, and cannot be **completed** if its cost has grown past what was approved.

- **What it is expected to cost:** the parts used, plus what a vendor charges, plus labor. Labor is the estimated hours at the assignee's rate (or the company's default rate) until hours are recorded, and then the hours recorded. A work order with no estimate, no parts and no vendor charge is expected to cost nothing, so give costly work an **estimate**. Exactly the limit is not over it.
- **Who sees what:** everyone sees a notice on the work order saying it needs approval. Only managers and administrators see the cost (it is made of wages); a technician is told only that it is over the limit.
- **Asking:** when the technician presses Start (or Complete) on such work, it is refused with the reason, and the managers are told once (push, email and chat, the *A work order needs my approval* switch in Notifications). The technician can also press **Ask a manager** on the notice. It is not sent again for the same work until it has been approved.
- **Approving:** a manager opens the work order and presses **Approve** (the **Needs Approval** tab of the work orders list shows what is waiting). **Not the person doing the work:** a manager who is the assignee needs another manager to approve it, as with verifying. The approval is recorded with who, when and the cost approved.
- **Growing costs:** if parts, hours or a vendor's charge later take the cost above what was approved, it needs approving again before it is completed. Lowering the limit, or raising it, applies from then on to work not yet started.
- A technician can edit the estimate of their own work, so an unrealistic estimate can get work started without a decision. The check at completion uses the hours and parts actually recorded, which catches it, but only after the money is spent. Approval is not a spending control on its own; it is a prompt to look.

## Reporting a problem without an account (QR labels)

Every asset's QR label links to a public form, `/request?asset=<code>`, where anyone (a visitor, a nurse, a tenant) can report a problem **without an account**. The form says which equipment the label is on, asks for a name (an email is optional), and what is wrong. It becomes an ordinary work order (priority and due date from **Settings → Organization**), the managers are emailed, and the person gets a link, `/request/<token>`, to follow it: received, assigned, in progress, completed (or closed without work). If the link is lost the request cannot be looked up again, so the form says to keep it, and remembers the last five on that device.

Print labels from **Assets → Print labels** (or an asset's page). **Labels printed by older versions pointed at the asset page and still need a sign-in**: reprint them. A label that is not recognised (an asset since removed) still lets the person report the problem by typing the place and equipment.

**What strangers can and cannot do.** The two public calls (`POST /api/v1/work_requests`, `GET /api/v1/work_requests/:token`) plus the label lookup (`GET /api/v1/public_assets/:code`) are the only ones that need no sign-in, and they are built for hostile callers:

- The request link holds 128 random bits and the label code 140; neither can be counted up to or guessed, ids and work order numbers never appear on a public page, and a wrong link gets the same "not found" as one that never existed. The status shows only the title, the person's own words, a stage and two dates: never names, emails, the assignee, comments, costs, the team's cancel or reject reasons, or any other work order.
- The caller chooses nothing but words: priority, status, company, assignee and token cannot be set. Each field has a size limit (description 2000 characters, name 100, email 254, place and equipment 200), control characters are removed, and anything over 16 KB is refused. Text is always shown as plain text, and emails are plain text.
- Limits per address: **5 reports per 10 minutes, 20 per day, and 60 per hour from everyone together** (so a flood spread over many addresses still cannot bury the managers' inboxes; the cost is that a flood can also stop real reports for a while), and 60 link or label lookups per 5 minutes. Over the limit the answer is `429`. A hidden form field catches simple scripts: they are told it worked and nothing is created.
- The pages are sent with `Cache-Control: no-store`, `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`, so the link does not end up in caches, search results or other sites' logs. Server logs filter the `token` and `email` parameters, but a request's path (with the token) is logged by the web server in front: treat access logs as you would the work orders themselves.

Behind a proxy the limits count the address the proxy reports (`X-Forwarded-For`); make sure your proxy sets it, or every visitor shares one allowance.

**Turning the form off.** An administrator can switch the public form off under **Settings, Advanced Settings** (a company setting, on by default). While it is off, `POST /api/v1/work_requests` and the label lookup answer `403` with the code `PUBLIC_REQUESTS_OFF`, the form shows "This request form is turned off. Please contact your maintenance team directly." before anyone types a request (it asks `GET /api/v1/public_request_form`, which says only whether the form is open), nothing is created and no manager is notified, and a script that fills the hidden field is refused the same way. Links to requests already made keep showing their progress. Turning it back on takes effect at once.

## Working offline

A technician who loses signal can keep going. With no connection, **Start work, Put on hold, Waiting for parts, Resume and Complete**, **comments** and **photos and documents**, are saved on the phone, shown straight away with a *Waiting to sync* badge, and sent in order when the connection returns. The status at the top of the screen shows what is waiting. If the server refuses a change (for example, the work order was reassigned meanwhile), it is listed there with the reason instead of disappearing. Changes belong to the person who made them, so a shared phone keeps each person's separate.

Photos are shrunk to at most 1600 pixels on a side before they are kept or sent, so they are quick to upload and small to store on the phone; a photo that cannot be sent stays on the phone until it can, and anything over 10 MB or not a photo, PDF or Word document is refused with the reason.

Things that need the server's decision (assigning, verifying, rejecting, cancelling, editing a work order) still need a connection.

To reopen a page you already visited while offline, the app must be served over **HTTPS** (see [HTTPS](https.md); browsers only allow the offline cache on secure addresses; `localhost` counts). On a plain `http://` address the offline cache is not available: changes made while the page stays open are still saved and sent, but reloading the page offline will not work.
