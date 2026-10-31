# Asset documents and warranty

Keep the manual and a photo of the nameplate with the machine, and be told before its warranty runs out.

## Documents

Open an asset and choose the **Documents** tab. Anything kept there is at hand whoever needs it, on a phone at the machine as much as at a desk.

| Who | Can |
| --- | --- |
| Administrators and managers | See and add files; remove any file |
| Technicians | See and add files; remove their own |
| Requesters | Nothing (they do not see assets) |

**Add a file** opens the file chooser (on a phone, the camera is offered too). Type a **note** first if you like ("Operator manual, 2019 edition"). A file is a photo, a PDF or a Word document, **10 MB or smaller**. The list shows each file with its note, who added it and when; the name opens it in a new tab, and a photo shows as a small picture.

- A file that says it is a photo but is not one is refused: FixFlow looks at what is inside, not at the name.
- **Removing a file** asks first and deletes it for good.
- **Manuals help the assistant.** When the AI assistant is on, it reads the text of the first two **PDF** files kept with the asset (oldest first) while helping a technician with a work order on that asset, and says which manual it used. Photos and Word files are not read. Scanned pages that are only pictures have no text to read.
- The files are kept in the file storage, so they are in the [backups](backups.md) with the other uploads.

## Warranty

A manager sets **Warranty expires on** when creating or editing an asset (a date; leave it empty when there is none). The asset page then says, under its details, how long is left: *Warranty ends in 12 days (1 Mar 2027)*. Within 30 days the note turns amber; after the date it says how long ago the warranty ended.

### The warning

Every morning at 8:30 FixFlow looks for warranties that end within the next 30 days (the last day counts) and sends the **managers and administrators** one message listing them, soonest first, so a failing machine can be reported while the supplier still has to pay. It is sent by email, and to the [team chat](notifications.md#team-chat) if that event is ticked there. Each person can turn the email off under **Settings, Notifications**.

- **Each end date is announced once.** The warranty is not listed again every morning. Change the date and the new one is announced again.
- **A warranty added with less than 30 days left** is announced the next morning.
- **Assets that are put away (deleted), and warranties that have already ended, are left out.**
- It needs the background worker running (System Health shows it).
- Changes to the date are in the **Audit Log**; the job's own bookkeeping is not.
