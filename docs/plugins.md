# Plugins

A plugin adds something to FixFlow without changing FixFlow's own code. There are two things a plugin can add, called **extension points**:

| Extension point | What it adds | Where people meet it |
|---|---|---|
| **Report** | A table (with an optional summary) made from your data, and a CSV download | **Reports**, under "From plugins". For managers and administrators |
| **Notification channel** | Somewhere FixFlow sends what it already announces (a work order assigned, a sensor alert, a part running low...) | **Settings → Plugins**, set up by an administrator |

A plugin has no screens of its own: FixFlow draws the table and the setup form from what the plugin says about them. A plugin you install cannot break the rest of FixFlow: one that does not load, or that fails while it runs, is reported (on **Settings → Plugins**, or in the server log) and everything else carries on.

!!! warning "A plugin is trusted code"
    A plugin is Ruby code that runs **inside the FixFlow server, with the server's rights**. It can read the whole database. FixFlow guards against a plugin that *breaks*, not against one that is *malicious*. Install only plugins you have read or that come from people you trust, the way you would with any program on the server.

## Installing a plugin

1. Put the plugin's folder in the **`plugins`** folder of your FixFlow install (next to `docker-compose.prod.yml`), so that it contains `plugins/<name>/plugin.rb`. The Docker installs mount that folder into the `api` and `sidekiq` services; it is read-only for them. To keep plugins somewhere else, set `PLUGINS_DIR` in `.env` to the folder (it must be a folder the containers can see).
2. Restart FixFlow (`docker compose -f docker-compose.prod.yml restart api sidekiq`). Plugins are read when the server starts.
3. Open **Settings → Plugins** as an administrator. The plugin is listed, **off**. A plugin does nothing for your company until you switch it on: its reports stay hidden from managers and its channels send nothing.
4. Switch it on. Set up its channels there (**Send a test message** checks them before anything real is sent).

If a plugin's folder has a mistake, FixFlow starts anyway and **Settings → Plugins** lists the folder with the reason. To check a folder without opening the app, run `rails fixflow:plugins` on the server: it lists what each plugin adds and what did not load, and exits with status 1 when something failed, so a script can use it.

To remove a plugin, switch it off, delete its folder and restart. What was set up for it is kept, so putting it back finds it as it was.

## Two samples

The folder `examples/plugins/` in the FixFlow source holds two small, complete plugins. Copy one into `plugins/` to try it.

- **`overdue_work`** adds two reports: *Overdue now* (open work past its due date, for each person) and *Finished late* (how much of the work finished in a period was after its due date).
- **`ntfy`** adds a notification channel that sends FixFlow's notifications to an [ntfy](https://ntfy.sh) topic, to read as a push message on a phone. ntfy can run on your own server. It has fields for the server address, the topic, an optional access token (kept encrypted) and a priority.

## Writing a plugin

A plugin is a folder with a `plugin.rb`. The file calls `Plugins.define` once:

```ruby
Plugins.define "overdue_work" do
  title "Overdue work"
  version "1.0.0"
  summary "Who has work past its due date."
  author "The maintenance team"   # optional
  api 1                           # the plugin API it was written for (required)

  report "overdue_now", title: "Overdue now", period: false do |context|
    # ... returns a table
  end

  channel "ntfy", title: "ntfy topic", fields: [{ key: "topic", label: "Topic", required: true }] do |message, settings|
    # ... sends the message
  end
end
```

- The name (`"overdue_work"`) and the names of reports, channels and fields are lower-case letters, digits and `_`, 2 to 40 characters, starting with a letter. Two plugins cannot share a name.
- `api 1` says which version of this contract the plugin was written for. A FixFlow that offers another version refuses the plugin and says so, instead of running it wrongly. The current version is **1**.
- A plugin must add at least one report or channel. It may add both, and several of each.
- The file may `require_relative` other files in its folder.
- A plugin is read once, when the server starts. It is not run on every request: keep state out of the file's top level.

### Reports

```ruby
report "finished_late", title: "Finished late", description: "Work finished in the period.", period: true do |context|
  done = context.organization.work_orders.where(completed_at: context.from..context.to)
  # ...
  {
    columns: [{ key: "person", label: "Person" }, { key: "finished", label: "Finished", kind: "number" }],
    rows: [{ "person" => "Ana Perera", "finished" => 12 }],
    summary: [{ label: "Finished", value: 12, kind: "number" }],
    note: "Only work with a due date is counted."
  }
end
```

The block runs when a manager opens the report. It is given a **context** with `organization` (the company), `user` (the person asking), `from` and `to` (the period, the whole day at each end in the company's time zone; the last 30 days unless the person chose one) and `params` (any other values on the address). With `period: false` the report is "as of now": the page shows no date picker and `from` and `to` are `nil`.

It returns a Hash:

| Key | What it holds |
|---|---|
| `columns` | 1 to 30 columns, each `{ key:, label:, kind: }`. `kind` is `text` (the default), `number`, `money`, `percent` (0 to 100), `date` or `datetime` |
| `rows` | Up to 10,000 rows. Each is a Hash keyed by column key, or a list in the order of the columns |
| `summary` | Optional, up to 12 figures shown above the table: `{ label:, value:, kind: }` |
| `note` | Optional line under the table |

Send numbers as numbers (not `"12 hours"`) and dates as dates: FixFlow shows them in the company's own format (currency, date, separators) and the CSV carries the raw values. A table that is the wrong shape, or a report that raises or runs longer than **20 seconds**, shows the manager a sentence and nothing else; the details go to the server log. Text that starts with `=`, `+`, `-` or `@` is written to the CSV as text, so a spreadsheet does not run it as a formula.

The report runs for the company of the person asking, and `ActsAsTenant` is already set, so `Asset.count` and the like count that company's records only. Reports are for **managers and administrators** only, as the built-in reports are, because a report can read what people are paid.

### Notification channels

```ruby
channel "ntfy", title: "ntfy topic",
                fields: [
                  { key: "server", label: "Server", kind: "url", default: "https://ntfy.sh" },
                  { key: "topic", label: "Topic", required: true },
                  { key: "token", label: "Access token", kind: "secret" }
                ] do |message, settings|
  Plugins::Http.post(settings[:server], json: true, body: { topic: settings[:topic], title: message.title, message: message.body })
end
```

`fields` become the form on **Settings → Plugins**. Each is `{ key:, label:, kind:, required:, help:, default:, options: }`. `kind` is:

- `text` (the default),
- `url`: checked like a webhook address when saved and when used (`https://`, or `http://` on your own network; never this server, a link-local or a cloud-metadata address),
- `secret`: kept encrypted, never shown again (a blank entry keeps the saved one),
- `select`: needs `options: [...]`.

The administrator also chooses **which events** the channel hears, from the same list the chat channel offers (a work order assigned, a sensor alert, a part running low, a warranty ending, an approval needed, and so on). The block runs once for each message, in the background, never while a person waits. It is given:

- `message`: `event` (for example `"wo_assigned"`), `title`, `body`, `link` (a full address of the screen it is about, or `nil`) and `company` (the company's name);
- `settings`: the field values by name (`settings[:topic]`), secrets in the clear, an empty field as its `default`.

It signals the outcome by how it ends:

| It... | FixFlow... |
|---|---|
| returns | counts the message as sent, and shows the time on the channel |
| raises `Plugins::Unavailable` (or a network error such as a timeout or refused connection) | tries again, 30 seconds later, up to 3 attempts, then keeps the reason on the channel |
| raises `Plugins::Refused` | does not try again, and keeps the reason on the channel |
| raises anything else | treats it as the plugin's fault: does not try again, keeps "The plugin failed (ErrorName)" on the channel, and writes the details to the log |

The reason an administrator reads is the message you give `Plugins::Refused` or `Plugins::Unavailable`, so write it in words they can act on ("The token was not accepted."). A channel that takes longer than **30 seconds** counts as unavailable. At most **20 messages a minute** go through one channel; a busier minute drops the rest (and logs it), so a noisy sensor does not bury a channel.

**`Plugins::Http.post(url, body:, headers:, json:)`** is the safe way to call another service: it checks the address, connects to the address it checked, follows no redirects, has time limits and turns the answer into the right error (a 5xx or 429 is `Unavailable`, any other non-2xx is `Refused`). A plugin that reaches the network should use it. A plugin is free to use anything else Ruby offers, but then the care is the plugin's own.

## What a plugin can rely on

The contract on this page is the stable part: `Plugins.define`, the report and channel blocks, the table shape, the field kinds, `Plugins::Http`, `Plugins::Refused` and `Plugins::Unavailable`, all under plugin API 1. A change that would break it comes with a new API number, and FixFlow says so rather than running an old plugin wrongly.

FixFlow's **models** (`WorkOrder`, `Asset`, `User`...) are FixFlow's own. A plugin that reads them, as the sample reports do, may need a small change after an upgrade. For something that must not break, read through the [public API](public-api.md) from the plugin instead, or keep to the columns shown in the [API reference](api.md).

## What is not covered

- Plugins cannot add screens, routes, database tables, menu items or background schedules. Reports and channels are the two extension points so far.
- A plugin cannot hear events other than those FixFlow already announces to chat. To react to others (work order created, asset status changed), use a [webhook](public-api.md#webhooks) to a small program of your own.
- The plugin screen sets up a company's channels, one setup per channel per company. There is no per-user setting.
