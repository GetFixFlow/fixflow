## What and why

<!-- What was wrong or missing, and what this changes. Link the issue: "Fixes #123". -->

## How it was checked

<!-- Tests added (and that they fail without the change), commands run, anything you tried by hand. -->

## Not tested

<!-- Be plain about what you did not try: a browser, a phone, a real mail server, Docker, another OS... "Nothing" is fine if true. -->

## Checklist

- [ ] One change in this pull request
- [ ] A test fails without the change
- [ ] The docs (`docs/`) and `[Unreleased]` in CHANGELOG updated, if a user can see the change (call out API or settings changes)
- [ ] `bundle exec rspec`, `bin/rubocop`, `bin/brakeman`, and (web changes) `npx tsc -b`, `npx vitest run`, `npm run build` pass
- [ ] If a report or the dashboard changed: saved answers regenerated (`UPDATE_REPORT_FIXTURES=1 bundle exec rspec spec/contracts/report_shapes_spec.rb`)
- [ ] No secrets, tokens or real customer data
