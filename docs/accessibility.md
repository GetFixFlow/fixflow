# Accessibility

FixFlow's main screens can be used with a keyboard alone, are named for screen readers, and meet the contrast level of the web accessibility guidelines (WCAG 2.2, level AA) in the light and dark themes. This page says what that covers, how it was checked, and what is not done.

## Using FixFlow with the keyboard

- The first **Tab** on any page reaches **Skip to main content**, which jumps past the menu. After you open a page from a link or the menu, the keyboard is already at the top of that page, so the next Tab is in its content.
- Every button, link, field and card can be reached with **Tab** (and **Shift+Tab** back) and used with **Enter** or **Space**. A ring shows where the keyboard is, on every control.
- Menus, lists and pickers (the person menu, the place and asset pickers) open with Enter, move with the arrow keys, and close with **Escape**, which puts the keyboard back where it was.
- Panels that slide in (an alert's details, report filters, the photo viewer, the settings menu on a phone) take the keyboard when they open, keep Tab inside, and close with **Escape**.
- A work order card on the board, an asset card and a day on the calendar are links or buttons: Tab to them, Enter to open.
- **Dragging** (cards between the columns of the work order board, work between people and days on the schedule) is a mouse and touch shortcut. The same changes can be made without dragging: open the work order and use its **Start, Hold, Complete** and **Assign** buttons, or the move button on a card on the schedule.

## For screen readers

- Every page has a heading of level 1 and the headings go down in order, one level at a time. The browser tab is named after the page ("Work Orders · FixFlow"), and after you move to another page the new page's name is announced.
- The page is divided into landmarks (menu, main content), each named: **Main** and **Settings** for the two menus.
- Every field has a label that is read with it, a field that has a problem says it is invalid and reads the message, and the message is announced when it appears.
- Buttons that show only an icon have a name ("Close", "Edit Pump-01"). Status, priority and similar words are text, never only a colour. Charts are named; the charting library also offers arrow-key movement through them, which was not checked separately.

## Colour and size

- Text meets a contrast of 4.5 to 1 against its background, in both the light and the dark theme, on the screens that were checked.
- **The company colour** (Settings, Branding) is used for buttons and links, so it must now give **4.5 to 1 against white**. It was 3 to 1; a colour that was saved before keeps working, but one that is too light is refused the next time it is saved. The page shows the figure as you choose.
- The page can be zoomed (nothing stops the browser or the phone from enlarging it), and people who set their system to **reduce motion** get no sliding or fading.
- Controls on the checked screens are at least 24 by 24 pixels.

## How it was checked

- **Automatically, in a real browser:** the axe-core checker ran on 35 screens (the sign-in and request pages, and 32 pages signed in as an administrator), in light and dark, and finds nothing left to fix on them (colour contrast, names, labels, landmarks, headings, nested controls, target size). It started with 17 kinds of problem in more than 700 places.
- **By keyboard, in a real browser:** pressing Tab through the main screens, to see that every stop has a visible ring, none is hidden, and the keyboard does not get stuck.
- **In the code:** an accessibility linter runs over every screen as part of the web tests, so a new clickable box with no keyboard use, a label that names nothing, an image with no description or a wrong ARIA attribute fails the tests.

## What is not done

- **The outlines of text fields** are a light grey (about 1.5 to 1), lighter than the 3 to 1 the guidelines ask for the edge of a control. The checker does not test this; it has not been changed.
- **No real screen reader has been used** (NVDA, JAWS, VoiceOver, TalkBack). The checks above find what a machine can; how it sounds is not known. If you use one and something is wrong, please say so (see below).
- Screens not checked in the browser: the reports other than Work Orders, Assets and Costs, the IoT screens other than the dashboard, the import screens, the system health and audit log pages, and the public request form and status page (they follow the same components, but were not run through the checker).
- Charts can be moved through by keyboard but give their figures as a pop-up; the reports have tables for some of them, not all. The PDF a report makes is not tagged for screen readers.
- The documentation site is the standard Material for MkDocs theme, which has its own accessibility work.
- Right-to-left languages are not supported yet.

## Telling us about a problem

Open an issue on GitHub with the screen, what you used (browser, screen reader), and what happened. For a contribution, see CONTRIBUTING; run `npm test` in `apps/web`, which includes the accessibility linter, and use the existing `Input`, `Modal` and `Drawer` components for new forms and dialogs: they carry labels, focus handling and Escape with them.
