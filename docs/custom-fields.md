# Custom fields on work orders and parts

If your company needs to know something FixFlow does not ask (a cost centre, a hazard class, which shelf a part lives on), an administrator can add a **custom field** for it. It then appears on the forms, on the page of each work order, in the lists you choose, and in the work order export.

Custom fields exist for **work orders** and for **parts**. Assets already take free-form pairs of their own (name and value, on the asset's edit page); those are separate.

## Adding a field

Open **Settings, Custom Fields** (administrators only). Choose **Work orders** or **Parts**, then **Add field**.

| Setting | What it does |
| --- | --- |
| **Name** | What people see. Up to 60 characters. |
| **Type** | *Text* (up to 500 characters), *Number*, *Date*, *Choice list* (one of the choices you type, one to a line, up to 50) or *Yes / no*. |
| **Must be filled in** | A person filling in the form cannot save it while this is empty. Not available for *Yes / no*, where leaving it empty means no. |
| **Show as a column in the list** | The work orders list, or the parts list, gets a column for it. |

You can have up to **20 fields** for work orders and 20 for parts. Use the arrows to put them in the order the forms and lists show.

## What you can change later

You can change the name, the choices, and the two settings. You cannot change the **type**: a number turned into a date would make every value on every record wrong. To use another type, delete the field and add it again.

Removing a choice does not touch work that already has it: that work order keeps showing it, and the list offers it until it is changed.

## Turning off, and deleting

- **Turn off** (the eye button) hides the field everywhere: forms, work order pages, lists and the export. **What was filled in is kept**, and returns when you turn it on again. A field that is off is not asked for, even if it was required.
- **Delete** removes the field **and what was filled in for it on every work order or part**. You are asked first. The audit log records that the field was deleted. If a field with the same name is added later it starts empty.

## Who can fill them in

Anyone who can create or edit a work order or a part sees the fields on that form. Everyone who can see the record sees the values. The fields are not hidden from any role.

## Required fields, and old records

A required field is enforced where a **person fills in a form**: creating a work order or a part, or editing one and changing a custom field. It is **not** demanded of work FixFlow makes by itself or that arrives without a form: a work order created by a preventive maintenance schedule, a sensor alert, or the public request page (QR labels). Those have nowhere to fill it in.

For the same reason, adding a required field **does not stop anything on work that already exists**: a technician can still start, hold and complete a work order that lacks it. Editing an old work order only asks for it when the edit changes the custom fields. If you want every old record filled in, edit them.

## Exports

The **work order export** (the CSV on **Reports, Work Orders**) gets a column for each field that is on, after the usual ones and headed by the field's name. A *Yes / no* field reads Yes or No. A field whose name matches a usual column (such as "Status") is headed "Status (custom)" so the two are not confused. Text that a spreadsheet would run as a formula (starting with `=`, `+`, `-` or `@`) is exported as plain text.

There is no parts export in FixFlow yet, and the CSV import of parts does not read custom fields: fill them in on the part.

## In the audit log

Changing a value is recorded as a change of the work order or part, **naming which fields changed but never what was typed**, because a value can be anything. Adding, changing and deleting the fields themselves is recorded too.

## API

`GET /api/v1/custom_fields?entity=work_order|part` lists the fields (those that are on, for everyone; all of them for an administrator). Administrators create, change, reorder and delete them. A work order or part carries its values as `custom_values`, an object keyed by the field's `key` (made from the name when the field is made and never changed). Send `custom_values` with only the keys you want to change; a key sent empty is cleared; a key not sent is left alone. See [the API](api.md) and [the endpoint list](api-endpoints.md).
