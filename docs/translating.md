# Languages and translating

FixFlow's screens and emails come in **English** and **Spanish**. Everyone can use their own language, and anyone can add another by adding files: there is no code to change.

## Choosing a language

- **A person** opens **Settings, Profile** and picks a **Language**. It is saved with their account, so it follows them to every device, and it is the language of the emails FixFlow sends them. "Use the company's language" (the default) follows the company.
- **The company** opens **Settings, Localization** (administrators) and picks the **Language** that people who have not chosen their own get. It is also the language of the emails sent to someone with no account of their own, such as the person who reported a problem from a QR label.
- Before signing in, the sign-in pages have a small language box, and the app starts in the language of the browser if it is one FixFlow has.

Month names and AM/PM follow the language; the **date format**, **time format**, **currency** and **number style** stay the ones the company chose in Localization, whatever the language.

## What is translated, and what is not

Translated: every menu, button, label, message and empty state of the main screens (sign-in, work orders, the dashboard, the schedule, assets, scanning and labels, parts, vendors, purchasing, the profile and the localization settings) and **every email FixFlow sends** (assignments, approvals, low stock, warranty and maintenance notices, invitations, password reset, scheduled reports and the others).

Not translated yet:

- Some screens of the **Settings** area, the reports and the sensor (IoT) pages keep their English text for now. A language with a gap shows the English for it, so nothing is blank.
- Messages the server writes itself, such as "Resource not found" or the reason a form was refused, stay in English.
- What people typed (a work order's title, a note, a name) is shown as it was written, and the **push notification** and **team chat** messages are English.
- The PDF of a report and the documentation site are English.

## Adding a language

You need the code of the language (`fr` for French, `pt` for Portuguese, `de`, `it`, `si` for Sinhala, `pt-BR` for Brazilian Portuguese) and a person who reads it well. Copy the English files, translate the text, and send a pull request. Four places:

1. **The screens.** Copy the folder `apps/web/src/locales/en/` to `apps/web/src/locales/fr/` and translate the values in every file (never the keys, the words on the left of the colon). In `common.json`, set `language_name` to the language's own name ("Français"). Text such as `{{count}}` or `{{name}}` is filled in by FixFlow: keep it exactly, and move it where the language needs it. Where a text has `_one` and `_other` forms (for example `"overdue_one": "{{count}} overdue"` and `"overdue_other": ...`), translate both; a language that needs more forms can add them (`_few`, `_many`, `_zero`, `_two`).
2. **The emails.** Copy `config/locales/mailers.en.yml` to `config/locales/mailers.fr.yml` and change the first line to `fr:`, then translate. Put the names of the days and months in `config/locales/fr.yml` (copy `es.yml`, which also holds `language_name`). The file named for the code, `fr.yml`, is what makes the server offer the language.
3. **Check it.** From `apps/web`, `npm test -- src/i18n` fails with the name of every text that is missing, extra or has different `{{placeholders}}` from English; from the main folder, `bundle exec rspec spec/lib/locale_files_spec.rb spec/services/locales_spec.rb` does the same for the emails and checks that the server and the screens offer the same languages.
4. **See it.** Start the app, open **Settings, Profile**, choose the language, and click through the screens. Longer words can break a layout: fix what you see.

Do not translate the keys, the names of the files, or the words `FixFlow`, `QR` and the like.

## For developers: writing a new text

- A text in a screen is `t('area.key')` from `useTranslation()`, with the English in `apps/web/src/locales/en/<area>.json`. Outside a component use `import { t } from '@/i18n'`. A status, priority, type or role word is `label('status', value)`. Never call `t()` when a file loads (it would be fixed in English); call it when the screen is drawn.
- An email text is a key in `config/locales/mailers.en.yml`, read in the template with `t(".key")`. Build an email inside `in_language_of(person) { mail(...) }` so that it is written in the reader's language.
- Add the Spanish at the same time. The tests refuse a text that is in one language and not the other, and a `t('...')` whose key does not exist.
- Dates in emails use `mail_day`; dates on screen use `formatDate` (which follows the company's choices and the language).
