# Quick start for technicians

Everything a technician does in a day, on a phone: find your work, do it, close it. About five minutes to read.

## Before the first job

1. **Open the invitation link** your administrator sent you, choose a password and sign in. If your company asks for two-factor sign-in, the app walks you through it.
2. **Put FixFlow on your home screen.** Open the address in your phone's browser, then use the browser's menu: *Add to Home screen* (Android) or *Share, Add to Home Screen* (iPhone). It then opens like any other app and keeps working when the signal drops (see [Working offline](work-orders.md#working-offline)). This needs the server to use HTTPS; if the option is missing, ask your administrator.
3. **Switch on push messages** so a new job reaches you without opening the app: **Settings, Notifications**, then *Push notifications on this device*. See [Notifications](notifications.md).

## Find your work

Open **Work Orders** and choose the **My Work Orders** tab. Jobs that are late are under **Overdue**. A job nobody has taken yet shows **Assign to Me**: press it and the job is yours.

You can see the same list as a board, a table or a calendar.

## Do a job

Open a work order. The buttons at the top depend on where the job is and who it belongs to:

| Press | When | What happens |
| --- | --- | --- |
| **▶ Start Work** | The job is assigned to you | It becomes *In progress* and the start time is kept. |
| **⏸ Put On Hold** | You have to stop for now | You choose a reason; the job waits. |
| **🔧 Need Parts** | You are waiting for a part | The job is marked *Pending parts*. |
| **▶ Resume** | After a hold or a wait for parts | Back to *In progress*. |
| **✓ Complete** | The work is done | Opens the form below. |

While you work, the same page has:

- **Checklist**: tick each step as you do it. Steps that are not marked optional **must** be ticked before the job can be completed. Each tick records who did it and when.
- **Comments**: write what you found, so the next person does not have to ask.
- **Attachments**: add a photo of the fault, the repair or a delivery note. Photos are shrunk before they are sent, so they are quick even on a weak signal.
- **Parts**: record the parts you used, so stock and cost stay right.

## Complete the job

**✓ Complete** asks for:

- **Completion Notes**: what you did, in at least 20 characters. The job cannot be completed without them.
- **Actual Hours**: the time you spent. Your company's hourly rate turns this into the labor cost.
- **Resolution Type**: *Fully resolved*, *Temporarily resolved (follow-up needed)* or *Partially resolved*. Be honest here: it is how managers know which jobs will come back.

After that the job waits for a manager to **verify** it (somebody other than you, so a second person always looks). If they **reject** it, it comes back to you as *In progress* and you carry on from where you were.

## When there is no signal

Keep working. Start, hold, resume, complete, comments, ticks and photos are all saved on the phone, marked *Waiting to sync*, and sent when the connection returns. The status at the top shows what is waiting, and tells you if the server refused something (for example, the job was reassigned meanwhile). Things that need someone else's decision, such as assigning or verifying, need a connection.

## Seeing something broken that is not yet a job

Anyone can scan the QR label on a machine with the phone's camera: it opens a short form that creates a work order, no account needed. If you are signed in, you can also press **New Work Order** under **Work Orders**.

To look a machine up instead, press the **scan** button at the top of the screen (next to the moon) and point the phone at its label: you land on the list of assets showing just that machine; open it for its history and work orders. The phone asks to use the camera the first time, and needs HTTPS to do so.

## Stuck?

Press your picture at the top right, then **Help and guides**, or ask your administrator. Problems with the sign-in itself (forgotten password, lost phone) are covered in [People and roles](users.md#forgotten-passwords).
