# Scanning codes and printing labels

A technician can find a machine by scanning a code on it, and a manager can print a sheet of labels for many assets at once. A scan finds the asset whether the code is one of FixFlow's own QR labels or a barcode that was on the machine already.

## Finding an asset by scanning

Press the **scan** button at the top of the screen (next to the moon; not shown to requesters) and point the phone at the code. The camera asks permission the first time and needs [HTTPS](https.md). FixFlow reads:

- **QR codes**: the labels FixFlow prints, and any other QR code that holds a tag or a serial number.
- **Barcodes**: Code 128, Code 39, EAN-13, EAN-8, UPC-A, UPC-E and ITF (Interleaved 2 of 5), which cover most equipment stickers, shelf labels and maker's plates. Other kinds (Data Matrix, for instance) are not read; type the number instead.

The camera looks in a wide, short box so that a barcode fits in it. Hold the code steady, with good light, until the phone buzzes.

### What a code can be

FixFlow looks the code up exactly (capitals do not matter) in these places:

| The code is | It is found by |
| --- | --- |
| a FixFlow QR label | the label's link to the request form, or a link to the asset's page |
| the asset's **tag** (FF-000042, or your own) | the **Asset Tag** |
| a barcode on the machine | the asset's **Barcode** (see below) |
| a number printed on the machine | the asset's **Serial Number** |

- **One asset has it:** you land on its page.
- **More than one has it** (two machines can share a serial number): a list asks which, saying how each matched.
- **None has it:** it says so, and offers to **search** the assets or to **scan again**. A manager or administrator also gets **Link it to an asset**: pick the asset and the code is kept as its barcode, so the next scan finds it.

### A handheld scanner, or typing

Under the camera is a box, **Or type or scan a code**. A USB or Bluetooth barcode scanner acts as a keyboard: it types the code and presses Enter, which looks it up. On a computer with a mouse the box is ready to type in as soon as the page opens. It also works when the camera is refused or there is none.

## The barcode on an asset

An asset's **Barcode** is the number on a sticker that is already on the machine. A manager adds it on the asset's form, by **Link it to an asset** after a scan, or in the CSV import (a `barcode` column; see [Importing data](import.md)).

- **One live asset in the company has a given barcode.** Capitals do not matter. If you try to give a second asset the same one, FixFlow says which rule it broke and changes nothing. When an asset is deleted, its barcode can be used again.
- It is at most 64 characters. Spaces and line ends round it (a scanner often adds them) are dropped.
- The asset list's search finds an asset by its barcode and by its serial number as well as by name and tag.

## Printing labels

**Assets, Print labels** (managers and administrators) prints a sheet of labels for many assets at once.

1. **Choose the assets.** Narrow them by **search** (name, tag, barcode or serial number), **place** (it includes the places inside it) and **status**, then **Choose all** or tick the ones you want. Up to **500** assets come up at a time; if more match, the page says so and you narrow the search. From the Assets list you can also tick assets and press **Print labels** there, or press **Print labels** at the top to carry the list's filters over.
2. **Choose the label.** Three sizes, in millimetres: **Small 60 × 30**, **Medium 80 × 40** and **Large 100 × 60**. Tick **Barcode of the tag** to add a Code 128 barcode of the asset's tag (what handheld scanners read) and **The place** to name where the asset is. The paper is **A4** or **US Letter**.
3. **Print.** The preview shows the first 12; all the chosen labels print. **Print at 100% scale** ("actual size", not "fit to page") so a label is the size it says.

Each label has the **QR code to report a problem** (the same one the asset's page shows), the name, the tag and, as chosen, the place and the barcode. Anyone who scans the QR code can report a problem without an account ([Work orders](work-orders.md#reporting-a-problem-without-an-account-qr-labels)).

### Good to know

- **Labels fill the sheet from the top left, side by side.** They are not matched to a particular sticker stock (an Avery number, say): print on plain paper and cut, or on sticker paper at least as big as the label. Your printer's margins matter, so print one sheet first and measure.
- **The barcode needs space round it.** The three sizes leave each bar about a quarter of a millimetre wide for a tag like FF-000042. A tag made of characters outside the plain keyboard set (accents, for instance) gets no barcode, but still gets its QR code and its tag in words.
- The QR code holds the link of **this** FixFlow address. If the server's address changes, reprint the labels.
- There is no label designer: no logo, no other fields, no other sizes.

## For developers

`GET /api/v1/assets/lookup?code=` (anyone signed in) answers `{ "matches": [{ id, name, asset_tag, barcode, serial_number, location, matched_on }] }`, at most 10, where `matched_on` lists which of `label`, `link`, `asset_tag`, `barcode` and `serial_number` the code was. `GET /api/v1/assets/labels` (managers; `ids=1,2`, `search`, `status`, `location_id`) answers `{ labels: [{ id, name, asset_tag, barcode, public_code, location_name }], total, truncated }`, at most 500. See [the endpoint list](api-endpoints.md).
