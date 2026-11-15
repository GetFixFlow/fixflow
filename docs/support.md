# Support and community

FixFlow is free software ([AGPL-3.0](https://github.com/GetFixFlow/fixflow/blob/main/LICENSE)) and stays so: every feature is in the open code, and nothing described on this page is a feature held back for people who pay. What can be paid for is **people's time**: help, guarantees and work on what you need.

## Getting help for free

| I want to... | Go to |
| --- | --- |
| Ask how something works, or what others do | [GitHub Discussions, Q&A](https://github.com/GetFixFlow/fixflow/discussions/categories/q-a) |
| Suggest an idea and talk it over before it is a request | [Discussions, Ideas](https://github.com/GetFixFlow/fixflow/discussions/categories/ideas) |
| Show what you built, or how your company uses FixFlow | [Discussions, Show and tell](https://github.com/GetFixFlow/fixflow/discussions/categories/show-and-tell) |
| Report something that is broken | [An issue](https://github.com/GetFixFlow/fixflow/issues/new/choose), using the bug template |
| Ask for a feature | [An issue](https://github.com/GetFixFlow/fixflow/issues/new/choose), using the feature template |
| Report a security problem | **Not in public.** See the [security policy](https://github.com/GetFixFlow/fixflow/blob/main/SECURITY.md) |
| Find out how to fix an install | [Troubleshooting](troubleshooting.md) first: most start-up and upgrade problems are listed there |

Free help is given by volunteers and the maintainers when they have time. **There is no promised answer time**, and a question is more likely to get a good answer when it says what you did, what you expected and what happened, with the version (Settings, System Health) and the relevant lines of `make logs`. Never paste passwords, tokens or customer data into a public place.

Everyone taking part follows the [Code of Conduct](https://github.com/GetFixFlow/fixflow/blob/main/CODE_OF_CONDUCT.md).

## When new versions come out

A version is released on the **first Tuesday of every month**, with the changes of the month before it written in the [Changelog](changelog.md). The release notes put **Before you upgrade** first: anything you have to do (a new setting, a command, signing in again) is listed there, so a monthly upgrade is a short read, then `make upgrade` ([Upgrading](upgrading.md)).

- A month with nothing worth releasing is skipped, and the next release says so.
- A **security fix or a serious bug** is not held for the first Tuesday: it is released when it is ready, and the release notes say why.
- **Until version 1.0 only the newest release gets fixes.** If you are on an older one, the answer to "is this fixed?" is to upgrade. The promise for older versions from 1.0 on will be stated with 1.0.

[Watching](https://github.com/GetFixFlow/fixflow) the repository for **Releases only** tells you each time.

## Paid support, help and sponsored work

These are the ways to pay for people's time. They are agreed one company at a time, in writing, so this page describes them rather than price them: write to **SUPPORT_EMAIL** and say which company you are, how many people use FixFlow and what you need.

### Support contract

For a company that runs FixFlow for its work and needs a guarantee: a named way to reach us, an agreed time within which we answer, and help with upgrades and problems on your own install. What is covered, the answer times and the price are written down in the contract before you pay anything. A contract does not change what you may do with the software, or what the free version does.

### Setup help

We install and configure FixFlow for you or beside you, bring in your places, assets and parts from your spreadsheets ([Importing data](import.md)), set up sign-in with your company directory ([Directory sign-in](directory-sign-in.md)) and train the first people. For a fixed fee agreed after we have seen what you have.

### Sponsored features

A company that needs something FixFlow does not do yet can pay for it to be built. The rules are the same for everyone:

- The feature is built **in the open**, in the same repository, under the same licence, and **everyone gets it**. Nobody buys an exclusive feature or a private version.
- The maintainers decide whether it fits FixFlow and how it is built; the sponsor says what it must do and sees the work as it is made. A feature that does not fit is declined before money is taken.
- It comes with tests and documentation like any other change ([Contributing](https://github.com/GetFixFlow/fixflow/blob/main/CONTRIBUTING.md)), and is credited in the changelog if the sponsor agrees.
- It is released at the next first Tuesday it is ready for, not before, and not by skipping review.

### Managed hosting

For a company that does not want to run a server: FixFlow run for you, with backups and upgrades done by us. It is **not a product you can sign up for yet**: write and tell us what you would need, and we will say honestly what is available and when. Your data stays exportable, and you can move to your own server at any time with the [backup and restore](backups.md) steps.

## Why there is a page for this

The project is kept going by the people who use it. Paid support, setup help, sponsored features and hosting are how the time it takes to keep FixFlow secure, documented and released every month is paid for, without keeping any feature from people who cannot pay. If FixFlow saves your company money, this is the way to put some of it back.
