# Notifications

FixFlow tells people about work in two ways: **email** and **push notifications** on their phones and computers. Each person chooses under **Settings, Notifications**; nothing here is set by an administrator for someone else.

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
