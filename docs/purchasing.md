# Purchasing parts

Ask for parts when stock runs low, have a manager approve it, order it from a vendor, and record what arrives. Recording a delivery adds to the stock on hand, so the parts list stays true without anyone typing the numbers in twice.

## The steps

```
 requested ──► approved ──► ordered ──► partly received ──► received
     │             │            │
     ├─► turned down            └─► (cancelled before anything arrives)
     └─► cancelled
```

1. **Ask.** Open **Purchasing** in the side menu and press **Ask for parts** (or press **Order** beside a part on the **Parts** page, which starts the request with that part). Add each part you need and how many, and say why. The number suggested is enough to get back above the part's reorder point with a little to spare; change it freely. Each request gets a number, **PO-000001** and so on, counted separately for each company.
2. **Decide.** The managers are told (email, push or chat, as each has chosen under **Settings, Notifications**; the person who asked is not told about their own request). A manager opens the request and presses **Approve**, or **Turn down** and says why. The person who asked sees the reason.
3. **Order.** A manager presses **Place order**, chooses the **vendor** (the vendors list, [Vendors](vendors.md)), and can enter the date it is expected and the vendor's own order or quote number. FixFlow does not send anything to the vendor: it keeps your record of what you ordered and from whom.
4. **Receive.** When parts arrive, a manager presses **Record delivery** and enters how many of each came. The stock goes up by exactly that. A delivery in two parts is recorded in two goes; the order is *Partly received* until everything is in. If the rest is not coming, **Nothing more is coming** closes it as it stands.

| Who | Can |
| --- | --- |
| Administrators and managers | See every request; approve, turn down, order, record deliveries, close, cancel; set what each part costs on a request |
| Technicians | Ask for parts; see, change and cancel **their own** request while it waits for a decision |
| Requesters | Nothing |

## Good to know

- **Costs.** Each line has a cost for one. Left empty it is the part's own cost from the parts list; managers can set a different one on the request. The order shows the total. Delivering does **not** change the part's own cost, so work orders already done keep the cost they were logged with, and a price change is made on the part when you decide to.
- **Changing a request.** The parts, quantities and reason can be changed until the order is placed. Once it is ordered, cancel it and ask again.
- **Cancelling.** A manager can cancel before anything has arrived. An order that has partly arrived can only be closed.
- **One line for each part.** A part cannot be on a request twice; change the quantity instead.
- **The audit log** (**Settings, Activity Log**) records who asked, approved, ordered and received, and what came in.
- **Deleting.** A vendor or a part that is on a request or order cannot be deleted. Switch the vendor off, or set the part's stock to 0.

## Not included

Purchase orders are a record inside FixFlow. There is no document sent to the vendor, no invoice matching, no tax, no approval limits by amount and no second approver: a manager can approve a request they made themselves. A company that needs those can export from the audit log and keep them in its accounts system.
