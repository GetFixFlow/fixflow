# Vendors and contractors

Keep a list of the outside companies that do maintenance work for you, the people to call at each, and give a work order to one so that what they charge is counted with the rest of the costs.

## The vendor list

Open **Vendors** in the side menu. Each vendor has a name (unique in your company, whatever the capital letters), what they do ("Electrical", "HVAC", "Crane hire"), a phone number, an email address, a website, an address and notes. Search finds a vendor by name or by what they do, and the two lists beside the search narrow it by category and by whether the vendor is in use.

| Who | Can |
| --- | --- |
| Administrators | Everything below, and delete a vendor that has never had work |
| Managers | Add and change vendors and their contacts, give a work order to a vendor, see what vendors charged |
| Technicians | See the list and the people to call (to ring the contractor on site) |
| Requesters | Nothing |

**Click a vendor's name** to see its details and **the people to call** there: a name, a role, a phone number and an email address each. Phone numbers and email addresses are links, so on a phone one touch rings them. Managers add and remove contacts in the same window and open **Edit details** for the rest.

A vendor that you no longer use is **switched off** (untick *Active* when editing), not deleted: the work orders it did keep its name, and no new work can be given to it. A vendor that has work orders cannot be deleted at all; it is refused with a message that says to switch it off.

## Giving a work order to a vendor

Open the work order. A manager sees a **Vendor** box: **Give to a vendor**, choose the company, and enter **what they charged** and their **invoice or quote number** (both can be filled in later, with **Change**). **Change** also takes the work order off the vendor again.

- The work order keeps its **assignee**. A job done by a contractor still has a person of yours watching it, and they can start, update and complete it as usual.
- Only **managers and administrators** can give a work order to a vendor or see what the vendor charged, as with wages: the technician sees the company's name, not the amount or the invoice number. A technician who sends those fields to the server is refused.
- What the vendor charged is added to the work order's **total cost** and shown as its own *Vendor charge* line.
- Work that is verified or cancelled can no longer be given to a vendor.

## In the reports

On **Reports, Cost Analysis** (see [Reports and the dashboard](reports.md)) what vendors charged is counted in the total, shown apart as **Vendor Costs**, added to the trend and to each asset's and place's cost, and listed **by vendor** (who charged what for the work finished in the period, and how many jobs). As with every cost, it counts in the period the work was **completed**. The work order export (CSV) has the vendor's name and its charge, and the cost exports have a vendor column. **Costs by Vendor** exports as a CSV too.

## Not done yet

The list does not yet hold insurance papers, contracts, rates per hour, service-level times or ratings, a vendor cannot sign in to see its own work orders, and a purchase order (what you ordered, before the bill) is a separate step that comes later. The charge is a single amount per work order, in the company's currency.

## For developers

`GET/POST /api/v1/vendors`, `GET/PATCH/DELETE /api/v1/vendors/:id`, `POST /api/v1/vendors/:id/contacts`, `PATCH/DELETE /api/v1/vendors/:id/contacts/:contact_id`, and `GET /api/v1/reports/costs/by_vendor`; the work order takes `vendor_id`, `vendor_cost` and `vendor_reference` (managers only). All of it is in the [list of endpoints](api-endpoints.md).
