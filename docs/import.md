# Importing data and sample data

Bring locations, assets and parts in from a spreadsheet, or look around with sample data.

## Importing data from a spreadsheet

**Import** (managers and administrators; the Import button on Locations, Assets and Parts, or `/import`) brings **locations, assets and parts** in from a CSV file. Choose what you are importing, download its **template**, fill it in, and choose the file: it is **checked first and nothing is imported yet**. A clean file shows a preview and an Import button. A file with mistakes lists every one with its **row (as your spreadsheet numbers it), column and the problem**, and downloads as a list to work through. **If any row has a problem nothing is imported**, so after fixing the file you can upload it again without the rows that were fine being doubled up.

Do it in this order: **locations**, then assets and parts, which refer to a location by its name or by its full path (`Plant > Floor 1 > Line 2`; use the path when two places share a name). In the locations file a row can sit under one made earlier in the same file.

| Import | Columns (the first is required) | Notes |
| --- | --- | --- |
| Locations | `name`, `type`, `parent` | Type is site, building, floor, zone, room or outdoor (top level defaults to site, anything below to zone). |
| Assets | `name`, `asset_tag`, `serial_number`, `status`, `location` | Tags must be new. A blank tag is made up for you. Any other column (manufacturer, year…) is kept as a custom field. |
| Parts | `name`, `sku`, `quantity_on_hand`, `reorder_point`, `unit`, `unit_cost`, `location` | SKUs must be new. Importing parts does not trigger low-stock emails. |

The file can come straight from Excel: CSV saved by Excel (including the byte order mark, Windows line endings, Windows-1252 accents, and the semicolon separator some countries use with a decimal comma), quoted values with commas or line breaks, tab-separated text, and column headings in any case. It cannot be an `.xlsx` workbook (in Excel use File, Save As, CSV). Up to 5 MB and 5,000 rows at a time.

## Sample data and the first steps

On an install that is yours already, **sample data** lets an administrator look around a FixFlow that has something in it: **Settings, Import / Export, Sample data**, the **Add sample data** link on the dashboard's Getting started card, or `bin/rails fixflow:sample_data`. It adds a few places, assets, parts, a PM schedule (with a checklist to tick), open and finished work orders and some history, all named "Sample: …". It creates **no accounts and sends no email**. Take it out again with **Remove sample data** (or `bin/rails fixflow:remove_sample_data`): only the sample items go. Anything you added is untouched, and a sample item you have since built on (a work order on a sample asset, say) is **kept and listed**, as it is yours now.

New administrators also see a **Getting started** card on the dashboard with three first steps (add equipment, create a work order, invite your team) that tick off from what is really in the install. Sample data does not count. It can be put away with the cross, and goes by itself when all three are done.
