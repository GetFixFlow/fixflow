# People and roles

Adding people, forgotten passwords and what each role can do.

## Adding users

Administrators add people from **Settings → Users → Invite User**. Choose a role and FixFlow creates an invitation link. If email is set up (see [Email](configuration.md#email)), the link is also emailed; if not, the dialog tells you and you copy the link and send it yourself. The person opens the link, chooses a password and signs in. A link works once and expires after 7 days; use **Copy invite link** on a pending user in the Users list to make a new one.

Set `APP_URL` to the address your web app is served from, so invitation links point to the right place.

## People from the company directory

If the company uses [directory sign-in](directory-sign-in.md), people appear here the first time they sign in, with the role their group gives. Their role follows their groups (it cannot be changed here while that is on), and they have no FixFlow password to reset.

## Forgotten passwords

On the sign-in screen, **Forgot your password?** emails a reset link (if email is set up). If your server cannot send email, an administrator opens **Settings → Users → ⋯ → Reset Password**, copies the link and gives it to the person; the link works once and expires after 6 hours. The person's current password keeps working until they use the link. Using it signs them out everywhere.

## Roles and Permissions

| Action | Admin | Manager | Technician | Requester |
|---|---|---|---|---|
| Create users | Yes | No | No | No |
| Manage PM schedules | Yes | Yes | No | No |
| Assign work orders | Yes | Yes | No | No |
| Update work orders | Yes | Yes | Yes (own) | No |
| Take ("Assign to me") a work order nobody has | Yes | Yes | Yes | No |
| See work orders | All | All | All | Only the requests they made |
| Submit work requests | Yes | Yes | Yes | Yes |
| View assets, maintenance schedules and sensor data | Yes | Yes | Yes | No |
| See internal notes on a work order | Yes | Yes | No | No |
| See what people are paid (hourly rates, labor cost, the default rate) | Yes | Yes | No | No |
| Read the audit log | Yes | Yes (at their sites) | No | No |

A requester who opens a work order that is not theirs is told it was not found, the same as for one that does not exist. A technician can take a work order nobody has, but not one someone else has: only a manager moves work between people. With [several sites](sites.md) switched on, a person who works at some sites sees only those sites' work, assets, sensor data and audit-log entries.
