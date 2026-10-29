# People and roles

Adding people, forgotten passwords and what each role can do.

## Adding users

Administrators add people from **Settings → Users → Invite User**. Choose a role and FixFlow creates an invitation link. If email is set up (see [Email](configuration.md#email)), the link is also emailed; if not, the dialog tells you and you copy the link and send it yourself. The person opens the link, chooses a password and signs in. A link works once and expires after 7 days; use **Copy invite link** on a pending user in the Users list to make a new one.

Set `APP_URL` to the address your web app is served from, so invitation links point to the right place.

## Forgotten passwords

On the sign-in screen, **Forgot your password?** emails a reset link (if email is set up). If your server cannot send email, an administrator opens **Settings → Users → ⋯ → Reset Password**, copies the link and gives it to the person; the link works once and expires after 6 hours. The person's current password keeps working until they use the link. Using it signs them out everywhere.

## Roles and Permissions

| Action | Admin | Manager | Technician | Requester |
|---|---|---|---|---|
| Create users | Yes | No | No | No |
| Manage PM schedules | Yes | Yes | No | No |
| Assign work orders | Yes | Yes | No | No |
| Update work orders | Yes | Yes | Yes (own) | No |
| Submit work requests | Yes | Yes | Yes | Yes |
| View assets | Yes | Yes | Yes | No |
