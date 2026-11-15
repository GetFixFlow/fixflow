# Several sites in one install

A company with more than one place that does maintenance (two plants, a head office and a depot) can run them from one FixFlow: each **site** has its own people and its own calendar, and the reports can compare them. Sites are **off until an administrator switches them on**, so a company that does not use them is not affected.

## What a site is

A site is a **top-level place of type "site"**: the places you already have under **Settings → Locations** form a tree (site, building, floor, room...), and its top level is the site. Everything below a site (its buildings, rooms, and the assets and parts kept in them) belongs to that site. **Settings → Sites** lists them and is where you add one.

!!! note "Places of type site that already exist"
    The type "site" is the default for a new place, so a company may already have several top-level places of that type. When you switch sites on, **each of them counts as a site**. Look at the list on **Settings → Sites** first, and change the type of a top-level place that is not really a site (a "Warehouse", say) under **Settings → Locations**.

## Switching sites on

**Settings → Sites** (administrators only): tick **Work as several sites**. Until then everyone sees everything, whatever the sites and assignments say. Switching it off again changes nothing that was saved: who works where and each site's calendar are kept for next time.

Once sites are on, only an administrator can **add or change a site** (a top-level place of type site), on **Settings → Sites** or on the places screen, because a site decides who sees what. A manager can still add and change the buildings, floors and rooms inside one. Removing any place was already the administrator's.

## Who sees what

| Person | Sees |
|---|---|
| An **administrator** | Everything, at every site |
| Anyone **assigned to no site** | Everything, at every site (a regional manager, say) |
| Anyone **assigned to one or more sites** | Those sites, and what is in **no site** |

For a person assigned to some sites, the other sites are not there: the places, assets, work orders, preventive maintenance schedules, meters, sensors and their readings, alerts and unusual-reading flags, documents and downtime records of another site are **not listed and cannot be opened by their number** (the server answers "not found", as if they did not exist). They cannot put a work order on another site's asset, move an asset to another site, or use another site's parts, and the live sensor alerts they receive are those of their sites.

**What is in no site is shared by every site:** an asset or part with no place, or in a place that is not under a site, and a work order about no asset in particular. Give a place a site (put it under one) to make it that site's.

**Company-wide, not by site:** people and vendors, purchase orders, saved reports and the audit log. The settings of the company (language, currency, approval limit, number prefix) are the company's. Your API keys and the public API work for the whole company, as before.

## Assigning people

On **Settings → Sites**, each site lists the company's people: tick those who work there and save. A person can work at several sites. Administrators work at all of them and are not listed. **A person with no site works at all of them**: assign someone to the sites they are to be limited to. After you switch sites on, anyone you have not assigned still sees everything.

## A site's calendar

A site can have its own **time zone, working hours, working days and holidays**; a line left on **Same as the company** follows the company's. A site's own list of holidays **replaces** the company's (it does not add to it).

They are used where they matter:

- **The schedule** (managers and administrators): choose a site at the top to see that site's calendar, work and people (those who work there or at no site). Without a site it is the company's calendar and everything.
- **Moving work** to a day that had no time gives it the end of that site's working day.
- **A person's dates** (a report range, a filter) are read in the time zone of the **first site** they are assigned to, when it has one; otherwise the company's. An administrator, and anyone at no site, use the company's.

Currency, language, date formats, the approval limit and the work order number prefix are the company's, not a site's.

## Reports across the sites

**Reports → Sites** puts the sites side by side for the period: assets, open and overdue work orders, finished work orders and what they cost, availability and downtime, failures, and people. A line **In no site** has what is shared, and **All sites** adds up the rest. The figures are the ones the other reports use. Every other report can be limited to a site with its **Filters** panel: choose the site as the place. A person at some sites only sees only those, in every report.

## Limits

- A site is **one level**: a site cannot sit inside another.
- A person who works at several sites follows the **first** one's time zone and the **company's** other settings.
- A site cannot hold **zero holidays** when the company has some: a blank list follows the company's.
- **Purchase orders** are not split by site (they name parts, and a part's place is its site, but the order itself is the company's).
- The **live feed** and the lists follow the sites at the time of the request: when you change who works where, a person's open screens catch up the next time they load.

## For developers

`GET /api/v1/sites` lists the sites a person may see (with `enabled`, the company's calendar and `my_site_ids`); administrators use `PUT /sites/enabled`, `POST /sites`, `PATCH /sites/:id` (name and `settings`) and `PUT /sites/:id/people`. `GET /api/v1/schedule` takes `site_id`, and `GET /api/v1/reports/sites` is the comparison. See [the endpoint list](api-endpoints.md).
