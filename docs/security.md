# Sign-in and security

Sessions, two-factor sign-in, password rules and locked accounts.

## Where you are signed in

**Settings → My Profile → Where you are signed in** lists every browser or phone signed in to your account, with the device (for example "Chrome on macOS"), its address, and when it was last used, and lets you sign out of any one of them or of all the others. Use it when you used a shared computer, lost a phone, or see a device you do not recognise. A session lasts 24 hours.

Each sign-in is its own session: **signing out ends only that one**, and your other devices stay signed in. **Changing your password, or an administrator deactivating your account, ends every session.** An ended session can no longer open a live-update connection, but a connection it already had open stays until the page is closed or reloaded. Ending one is written to the activity log.

The address shown is the one the server sees, so behind a proxy it is the proxy's address unless the proxy passes `X-Forwarded-For`. Nothing is looked up from it: there is no location.


## Two-factor sign-in

Anyone can make signing in safer with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password, ...). **Settings → Security → Set up**: scan the QR code with the app (or type the key it shows), enter the 6-digit code the app then shows, and save the ten **recovery codes** FixFlow shows once. From then on, signing in asks for the password and then for a code from the app. A recovery code works in place of a code, once each, for a lost phone; **New recovery codes** (which needs your password and a code) replaces the set.

- **Turning it off**, and getting new recovery codes, ask for the password and a current code, so a borrowed, unlocked session cannot weaken the account.
- **Wrong codes lock it.** Five wrong codes in a row stop all further tries for 15 minutes, even with the right code, and the audit log records it (`user.two_factor_locked`). A code works once: the same one cannot be used twice, and a code up to 30 seconds old or ahead is accepted, so phones with slightly wrong clocks still work.
- **Administrators can require it for everyone** (Settings → Advanced Settings → Two-factor sign-in). A person who has not set it up is taken to do so on their next visit and can do nothing else until they have; they cannot turn it off afterwards.
- **A lost phone, and no recovery codes:** an administrator opens Settings → Users, the person's menu, **Reset two-factor**. That switches it off, signs the person out everywhere, and they sign in with their password (and set it up again if the company requires it). If the person is the only administrator, run `rails fixflow:reset_two_factor[their@email]` on the server (`docker compose -f docker-compose.prod.yml exec api bin/rails "fixflow:reset_two_factor[their@email]"`).
- **Where the secret is kept.** The key behind the codes is stored encrypted with a key made from `SECRET_KEY_BASE`, and the recovery codes only as digests, so a copy of the database does not hold a way past the second step. **If you ever change `SECRET_KEY_BASE`, everyone's two-factor stops working** (and sessions with it): reset it for them as above. The audit log records switching it on and off, new recovery codes, a recovery code being used, wrong codes and a lock (never the codes themselves).
- **For programs**, `POST /api/v1/auth/sign_in` answers a person who has it on with `{"two_factor_required": true, "challenge": "..."}` and no token; send the challenge (good for 5 minutes) and the code to `POST /api/v1/auth/two_factor` to get the token, in the `Authorization` header, as before.
- IoT devices use API keys and are not affected.

## Passwords, and locked accounts

- **A new password** (a new account, an accepted invitation, a reset, a change in My Profile, `rails fixflow:create_admin`) must be **10 to 128 characters** and must not be easy to guess: the most common passwords are refused (also with digits or symbols added, like `Password1234` or `p@ssw0rd`), and so are one character or one short stretch repeated, a run of digits, the name of this app, and anything made from the person's own email address or name (parts of four letters or more). Nothing is required of the kinds of characters: length and being hard to guess matter more than a capital and a symbol, and a few words in a row (`blue ladder 4721 kite`) are fine. Only a password being set is checked: people who already have a shorter one keep signing in until they change it. The demo accounts (`SEED_DB=true`) keep their well-known password on purpose.
- **Ten wrong passwords for one account lock it for 30 minutes.** The right password is refused too while it is locked, and the sign-in screen says why. It opens by itself after 30 minutes, or an administrator opens it at once (Settings → Users, the person's menu, **Unlock account**; locked accounts are marked **Locked**). A right password sooner than the tenth wrong one starts the count again. The audit log records locking and unlocking (`user.locked`, `user.unlocked`). This is on top of the limit per address (10 sign-in attempts a minute), which a guesser using many addresses gets past. **The trade-off:** someone who knows an email address can lock that person out for 30 minutes by guessing; that costs them an administrator's attention at worst, and a locked account cannot be guessed into.
- A person who signs in with an authenticator app is counted in the same way for wrong passwords; wrong *codes* have their own lock (see above).
