# Contributing to FixFlow

Thank you for helping. FixFlow is a self-hosted maintenance management system (Rails API in the repository root, React web app in `apps/web`), and it is meant to be installed by companies on their own servers, so a change is good when an administrator who has never seen the code can rely on it.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, do **not** open an issue: see [SECURITY.md](SECURITY.md).

## Ways to help

- **Report a bug** or **suggest a feature**: open an issue and pick a template. The more of "what I did, what I expected, what happened" you give, the quicker it is fixed.
- **Try an install and write down every stumble.** The [install page](docs/install.md) is the install guide; anything that was missing, wrong or confusing is a valuable issue.
- **Pick up an issue** labelled [`good first issue`](https://github.com/GetFixFlow/fixflow/labels/good%20first%20issue) or [`help wanted`](https://github.com/GetFixFlow/fixflow/labels/help%20wanted). Say in the issue that you are working on it, so two people do not do the same job.
- **Improve the docs.** Wrong or missing documentation is a bug.

For anything bigger than a small fix, open an issue first and say what you plan to do, so you do not spend a week on something that cannot be merged.

## Setting up

The docs have the steps: [Development](docs/development.md#local-development-without-docker) (Ruby 3.3, Node 20, PostgreSQL 16, Redis 7). Copy `.env.example` to `.env` and fill in your local database and Redis.

Run the tests before you change anything, so you know the baseline:

```bash
bundle exec rspec                      # backend
cd apps/web && npx vitest run          # web app
```

## Making a change

1. **One change per pull request.** A bug fix, a feature or a cleanup, not all three. Small pull requests are reviewed sooner.
2. Branch from `main`, and keep your branch up to date with it.
3. **Write a test that fails without your change.** A test that passes either way proves nothing. A bug fix needs a test that reproduces the bug; a rule needs a test that breaks when the rule does. If you can, break your change on purpose and check that the test fails.
4. **Update the docs with the change.** A user-visible change gets a section or edit in the [docs](docs/index.md) (the Markdown pages in `docs/`; after `pip install -r deploy/docs/requirements.txt`, `mkdocs serve` shows the site and `mkdocs build --strict` checks the links; a new or changed route needs `bin/rails docs:api`, which rewrites the endpoint list) and a bullet under `[Unreleased]` in the [CHANGELOG](CHANGELOG.md) (below the top bullet, so two open pull requests do not collide on the same line). Say what was wrong, what changed, and call out anything that changes an API answer or a setting. If the person running a server must do something when they upgrade (add a setting, run a command, sign in again), end the bullet with `**Upgrade:** what to do.`: the release notes list these at the top, under "Before you upgrade".
5. **Run the checks CI runs**, in this order, one at a time:

   ```bash
   bundle exec rspec
   bin/rubocop
   bin/brakeman --no-pager
   bin/bundler-audit
   bin/rails web:check_routes                      # every request the web app makes has a route
   cd apps/web
   npx tsc -b
   npx vitest run
   npm run build
   ```

   RuboCop's `-a` autocorrect can mangle long lines; read the diff after using it.
6. Open the pull request using the template. **Say plainly what you did not test** (a browser, a phone, a real mail server...). "Not tried" is a fine answer; a guess presented as a fact is not.

### Things that have bitten before

- **Report and dashboard answers are checked from both ends.** If you change what a report endpoint sends, regenerate the saved answers and commit them with the web change: `UPDATE_REPORT_FIXTURES=1 bundle exec rspec spec/contracts/report_shapes_spec.rb`. The web tests load the same files into the types in `apps/web/src/types/reports.ts`.
- **Do not commit a re-dumped `db/schema.rb`.** A migration run against an old development database rewrites the whole file in a different column order. Revert it and apply only your own lines (the version, your column, your index), or generate it from a fresh database.
- **Grouping by an enum column gives its names** (`"completed"`), not its numbers. Money and averages from the database are `BigDecimal`, which JSON turns into text: convert with `.to_f` where the screens expect numbers.
- **Days, weeks and months in reports are the company's time zone**, not UTC.
- **Reports and the dashboard are for the people allowed to see them.** Labor costs reveal what people are paid; check the role rules before exposing a figure.
- **Never put a real secret, token or customer data in a test, fixture or issue.** Use obviously fake values.

## Code style

- Follow the code around yours: naming, comment density, idiom. RuboCop (`bin/rubocop`) is the arbiter for Ruby; the web app is TypeScript in strict mode.
- Comments say *why*, not what. Messages shown to people are plain language.
- No new dependency without a reason in the pull request description (what it does that the code cannot do simply, its license, how well it is maintained). FixFlow is AGPL-3.0; a dependency must be compatible with that.

## Licence of your contribution

FixFlow is released under the [AGPL-3.0](LICENSE). By submitting a pull request you agree that your contribution is licensed under the same terms.

## Reviews

A maintainer reviews every pull request. Expect questions, and expect to be asked to change things; that is how the code stays maintainable. If a review goes quiet for more than a week, a polite nudge on the pull request is welcome.

## Making a release

For maintainers. A release is a version number in the `VERSION` file, a section for it in the [CHANGELOG](CHANGELOG.md), and a tag; the GitHub release page is made from those.

```bash
git switch main && git pull
bin/release 0.2.0 --dry-run     # shows the release notes it would publish; changes nothing
bin/release 0.2.0               # a branch release-0.2.0: VERSION changed, [Unreleased] moved to "[0.2.0] - <date>"
```

Read the notes it prints (they are the changelog section) and fix the wording in `CHANGELOG.md` on that branch if needed. Push the branch, open a pull request, and merge it when the checks pass (they include `bin/check_upgrade`, which upgrades a running install from the previous version and rolls it back). Then tag the merge and push the tag:

```bash
git switch main && git pull
git tag v0.2.0 && git push origin v0.2.0
```

The release workflow checks that the tag is on `main` and equals `VERSION`, writes the notes with `bin/release_notes 0.2.0`, and publishes the release. Servers upgrade with `make upgrade TO=v0.2.0` ([docs/upgrading.md](docs/upgrading.md)). Use a version like `1.0.0-rc.1` for a candidate: it is published as a pre-release, which the update check on System Health does not offer to anyone.

The same tag also builds the docs: the workflow attaches them to the release as `fixflow-docs-0.2.0.zip` and publishes this version of the site on the `gh-pages` branch (the newest stable one as `latest`) with [mike](https://github.com/jimporter/mike). For the site to be on the web, switch on GitHub Pages for the `gh-pages` branch once (repository Settings, Pages).
