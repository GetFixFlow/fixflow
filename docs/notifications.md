# Notifications

FixFlow tells people about work in three ways: **email**, **push notifications** on their phones and computers, and **messages in a team chat channel** (Slack, Microsoft Teams). Email and push are each person's own choice under **Settings, Notifications**; nothing there is set by an administrator for someone else. The chat channel is the company's, set by an administrator ([below](#team-chat)).

## Email

Invitations and password reset links are always sent. The rest, and how to connect a mail server, are in [Configuration](configuration.md#email).

## Push notifications

A push notification is a message that appears on a phone or computer even when FixFlow is closed: "Assigned to you: WO-000012, Pump 3 is leaking". Tapping it opens that work order. It reaches the person within seconds of the event, as long as the background worker is running.

**Which events.** The time-sensitive ones, each with its own tick next to the email one:

| Event | Who |
| --- | --- |
| A work order is assigned to you | the technician |
| A work order you requested is finished | the requester |
| A scheduled (preventive maintenance) work order is created for you | the technician |
| Work is finished and needs verifying | managers and administrators |
| Someone reports a problem from a QR label | managers and administrators |
| A part is running low or out | managers and administrators |

The summaries of maintenance due and overdue are email only. Everything is on by default for a device once it is turned on, and emails and push are independent: a person can have push without email.

### Turning it on

1. Open FixFlow on the phone or computer, **Settings, Notifications**.
2. Switch on **Push notifications on this device**, and allow notifications when the browser asks.
3. Press **Send a test**. A message should appear within a few seconds.

Each device is turned on by itself, and a person can have up to 10. **Push notifications** (the second switch, further down) turns them off for all of a person's devices at once without forgetting which are on.

### What it needs

- **HTTPS.** Browsers allow push only on an `https://` address (or `localhost`). Turn on [HTTPS](https.md); until then the page says so and offers no switch.
- **A browser that supports it.** Chrome, Edge and Firefox on computers and Android do; Safari does on Macs from macOS 13. On an iPhone or iPad, push works only for FixFlow added to the **Home Screen** and opened from there (iOS 16.4 and later).
- **The server must be able to reach the browser makers' push services over HTTPS (port 443)**: Google's, Mozilla's, Apple's or Microsoft's, depending on the browser. A server with no outbound internet access cannot push.
- **The background worker running** (System Health shows it): messages are sent by the worker, not the web server.

### What is private

FixFlow needs **no account with anyone** to send push: there is nothing to sign up for and no key to buy. Each message is **encrypted for one browser**, and the browser maker's push service only relays the encrypted bytes. It does learn that a message was sent to that device and when, but not what it says. The server signs its messages with a key it derives from `SECRET_KEY_BASE`, so there is nothing extra to set up or back up; **if `SECRET_KEY_BASE` is ever changed, every device has to turn push on again** (the same is true of two-factor sign-in).

### If it does not work

| You see | Cause |
| --- | --- |
| No switch, "needs a secure address" | The page is not on `https://`. See [HTTPS](https.md). |
| No switch, "cannot receive push" | The browser has no push (an iPhone browser tab: add FixFlow to the Home Screen first). |
| "Blocked for this site" | The person refused the browser's question. Allow notifications for this address in the browser's site settings, then switch it on. |
| **Send a test** says the push service did not accept it | The server cannot reach the push service, or it is having a moment. Check the server's outbound access to HTTPS, then try again; a device that fails five times in a row is forgotten. |
| **Send a test** says the browser had cancelled it | The browser dropped its subscription (cleared site data, reinstalled). Switch it on again. |
| Everything worked until `SECRET_KEY_BASE` changed | Every device turns push on again. |

An address the browser gives that points *inside* the network (rather than at a push service) is refused, so that signing in cannot be used to make the server call something it should not.

## Team chat

An administrator can have FixFlow post to a **Slack** or **Microsoft Teams** channel, so a whole team sees what happens without everyone having FixFlow open: **Settings, Team Chat**. Anything that takes a Slack-style incoming webhook works as "Slack", including **Mattermost** and **Rocket.Chat** on your own network.

**What is posted**, each event ticked or not as you choose:

| Event | The message |
| --- | --- |
| Someone reports a problem from a QR label | "New problem reported: WO-000012" and the title |
| A work order is assigned | "WO-000012 assigned to Ana Perera" and the title |
| Work is finished and needs verifying | "WO-000012 is finished and needs verifying" |
| A critical or high sensor alert is raised | "Critical sensor alert: Pump 3" and what the rule says (medium and low are not posted: they would bury the serious ones) |
| A part is running low or out | "Running low: Belt" and how many are left |

Each message has a link back to the page in FixFlow. It carries a work order's number and title, a sensor's name and reading, a part's name and count, and for an assignment the name of the person it went to; **no requesters' names or email addresses, no costs, no comments**.

### Setting it up

1. **Make a webhook** in the chat service:
    - **Slack:** create an app with *Incoming Webhooks*, add it to the channel, and copy the *Webhook URL*.
    - **Mattermost / Rocket.Chat:** *Integrations, Incoming Webhooks*, choose the channel, copy the URL.
    - **Microsoft Teams:** in the channel choose *Workflows* and *Post to a channel when a webhook request is received*, and copy the address it gives you.
2. In FixFlow, **Settings, Team Chat**: choose where, paste the address, tick the events, and press **Send a test message**. A message should appear in the channel at once; if it does not, the page shows the reason the chat service gave.
3. Tick **Post these messages** and **Save**.

**The address is a secret**: anyone who has it can post to your channel. FixFlow keeps it encrypted, never shows it again (only the name of its host, to recognise it), and never writes it to the audit log. Leave the field blank later to keep the saved one. As with other saved secrets, **changing `SECRET_KEY_BASE` means entering it again**.

### Limits and safety

- **Messages are sent by the background worker**, within seconds, and tried again (three tries) if the chat service is down. If one cannot be delivered, or the webhook is refused (revoked, mistyped), the reason is shown at the top of the Team Chat page.
- **No more than 20 messages a minute** go out; the rest are dropped (and logged), so a noisy sensor cannot bury the channel or get the webhook rate-limited.
- **What people typed is made harmless**: a work order's title can be typed by anyone through the public request form, so in Slack its `<!channel>` or hidden links are shown as plain text, and for Teams the characters that make links and styles are dropped.
- **The server must be able to reach the chat service** over the network: `hooks.slack.com` for Slack, the address of your own server for Mattermost. Addresses on your own network are fine; the server refuses its own address and link-local addresses (where cloud metadata services live). Redirects are not followed.
- **Microsoft Teams has not yet been tried against a real Teams.** The message is the documented form for a Teams workflow webhook (an Adaptive Card in a message), and the page says so; if Teams refuses it, the reason shown is Teams' own.

