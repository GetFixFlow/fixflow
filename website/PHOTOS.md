# Photos for the website

The pages have photo slots (`src/components/Photo.astro`). A slot shows a labelled placeholder until a file with its name is in `public/photos/`; then it shows the picture, with no code change. Placeholders say what to buy and at what size, so they should not go live: put the photos in before publishing.

| Slot (file in `public/photos/`) | Where | Size | What to look for |
| --- | --- | --- | --- |
| `home-floor.jpg` (filled, Pexels) | Home, wide band under the first screen | 2400 × 900 | A technician with a phone or tablet beside a pump or motor, in daylight, in a real plant or workshop. Not staged smiles, not hard hats on white. |
| `home-team.jpg` | Home, Community section | 1500 × 1000 | Two or three people in work clothes talking over a machine or a screen. Candid. |
| `features-phone.jpg` (filled, Pexels) | Features, top | 1600 × 1200 | Over the shoulder: a phone in a gloved hand next to a machine. Screen not readable (no fake interface). |
| `install-server.jpg` | Install, top | 1600 × 1200 | A small server or mini PC on a shelf or in a rack, tidy cables. Nothing branded. |
| `support-team.jpg` | Support, top | 1600 × 1200 | Two people, one laptop, a plant or office behind. Candid. |

Use `.jpg`, `.webp` or `.png`. Export the size above (the page crops to fit) at about 80% quality, under 300 KB; the page loads them lazily. Alt text is set in the page that uses the slot: change it to describe the picture you bought.

## Free photos from Pexels

Two slots are filled from [Pexels](https://www.pexels.com), whose licence allows free use on a website with no attribution (credit is given above anyway). Its limits: do not sell or redistribute the photos on their own, do not use a photo of a person in a way that suggests they endorse FixFlow or in a bad light, and some photos show a company's name or logo on clothing, which should be avoided. The photographer, not Pexels, is responsible for a model release.

## Buying

- Pick a licence that allows use on a website for an unlimited time, with no cap on views, and that is **not** "editorial use only". The licence for a photo of an identifiable person usually needs a model release: check it says so.
- Prefer photos that show real maintenance work. Avoid pictures with readable brand names, logos, or screens.
- Record each one below when it goes in, and keep the receipt or licence page.

| File | Source and link | Licence | Bought on | Licence receipt kept at |
| --- | --- | --- | --- | --- |
| `home-floor.jpg` | [Pexels photo 35072831](https://www.pexels.com/photo/industrial-worker-operating-machinery-control-panel-35072831/), by bulat843 (name taken from the file name; Pexels does not show it on the result card). Cropped to a wide band. | [Pexels Licence](https://www.pexels.com/license/) | 2026-11-16 | Nothing to keep: free, no purchase. Re-check the licence page before publishing. |
| `features-phone.jpg` | [Pexels photo 9242906](https://www.pexels.com/photo/close-up-photo-of-a-cnc-router-held-by-a-person-9242906/), by mikhail-nilov (from the file name). Cropped to 4:3. | [Pexels Licence](https://www.pexels.com/license/) | 2026-11-16 | As above. |
