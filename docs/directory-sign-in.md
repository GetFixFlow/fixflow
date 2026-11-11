# Sign in with the company directory

People sign in with the account they already use at work: **OpenID Connect** (Keycloak, Microsoft Entra ID, Okta, Google Workspace and anything else that speaks it) or **LDAP** (Active Directory, OpenLDAP, FreeIPA). Their **role follows the groups** they are in at the company, so nobody keeps a second password or is added to FixFlow by hand.

It is off until an administrator sets it up (**Settings → Company sign-in**), and FixFlow passwords keep working for the accounts made in FixFlow, so there is always a way back in.

!!! note "What was tried"
    Both ways were run against real servers: OpenID Connect against **Keycloak**, LDAP against **OpenLDAP** (`script/directory_live`, see [Trying it yourself](#trying-it-yourself)). **Microsoft Entra ID and Active Directory were not**: nobody had a tenant or a domain controller to try. The Entra and Active Directory sections below follow Microsoft's documentation for what those servers send, and the settings screen has a **Check** button for each so you find out in a minute whether yours answers as expected. If something differs, please open an issue with the message the button gives.

## How it works for a person

- **OpenID Connect.** The sign-in screen shows **Sign in with *Your company account*** (the words are yours to set). One click, the company's own sign-in page, and back in FixFlow. If they are already signed in at work it is no more than the click.
- **LDAP.** The same sign-in form, but the first box now reads **Email or username**: they type what they type at work (`jsmith`, `jsmith@acme.com`) and their directory password. FixFlow checks the password by signing in to the directory as them; it never keeps it.
- **The first time**, FixFlow makes the account (name and email from the directory) with the role their group gives. After that the same person is found by the directory's own id, so a changed name or email there follows them here.
- **Their password and second step belong to the directory.** The *Change password* and *Two-factor sign-in* parts of **My Profile** are replaced by a note, forgotten-password emails are not sent for them, and a company that requires two-factor sign-in does not ask them to set it up in FixFlow (the directory asks for it, if the company wants one).

## Who gets which role

Under **Who gets which role** name the groups for each of the four roles (one group on each line), and optionally a role for everyone else:

| Setting | What it does |
| --- | --- |
| Groups for **admin**, **manager**, **technician**, **requester** | A person in a listed group gets that role. In the groups of several, they get the highest. |
| **Everyone else** | The role for a person in none of the groups. Left empty, they are turned away ("Your account is not in a group that may use FixFlow"), so only the groups you name can sign in. |
| **Role follows the groups at every sign-in** | On (the default): the role is set again each time, so moving a person between groups at the company moves their role here, and removing them from every group stops them signing in. Off: the role is set when the account is made and an administrator changes it by hand after that. |
| **Create accounts for people who sign in for the first time** | On (the default): the first sign-in makes the account. Off: only people already in **Settings → Users** can sign in, and the first sign-in joins the account with the same email address. |

Groups can be written as the group's name (`fixflow-admins`) or, for LDAP, its full distinguished name (`CN=fixflow-admins,OU=Groups,DC=acme,DC=com`); capital letters do not matter, and what the directory reports is matched either way. A group that only *contains* the name does not match.

With role following on, the **Users** screen refuses to change the role of a person who signs in through the directory, and says to change their groups instead.

**The last administrator is safe.** If the groups would take the last active administrator down to another role, FixFlow keeps them an administrator and records it in the [audit log](security.md) (`directory.role_kept`), so a mistake at the directory cannot lock a company out of its own settings.

## Setting up OpenID Connect

In **Settings → Company sign-in → OpenID Connect**:

1. At your identity provider, add an application ("client") for FixFlow with the **authorization code** flow, and register the **redirect address** shown on the settings screen. It ends in `/api/v1/auth/oidc/callback` and is made from `APP_URL` (or `API_URL`, if the API is reached at another address than the web app).
2. Enter the **issuer address** (the address that has `/.well-known/openid-configuration` under it), the **client id** and the **client secret**.
3. Press **Check**. It fetches the provider's settings and keys and tells you what is wrong in words if it cannot.
4. Name the groups, tick **Enabled**, save.

FixFlow asks for the scopes `openid email profile`, uses **PKCE**, and reads the person's groups from the `groups` claim of the identity token (or the provider's userinfo endpoint when the token has none). **Groups claim** changes the claim's name.

The issuer must be **https** (a provider on `localhost` may use http, for trying it out).

### Keycloak

1. **Clients → Create client**: type *OpenID Connect*, a client id such as `fixflow`, **Client authentication** on, **Standard flow** on, the redirect address above as *Valid redirect URIs*.
2. **Clients → fixflow → Credentials** has the secret.
3. Groups are not in the token until you add them: **Clients → fixflow → Client scopes → fixflow-dedicated → Add mapper → By configuration → Group Membership**, token claim name `groups`, **Full group path off**, *Add to ID token* on.
4. The issuer is `https://<keycloak>/realms/<realm>`.

### Microsoft Entra ID (Azure AD)

1. **App registrations → New registration**, platform **Web**, the redirect address above.
2. **Certificates & secrets** → a new client secret (copy the *value*). **Overview** has the *Application (client) id* and *Directory (tenant) id*.
3. The issuer is `https://login.microsoftonline.com/<tenant id>/v2.0`.
4. **Roles:** the least surprising way is **App roles**. Create roles (for example `FixFlow Admin`), assign people or groups to them under the application in **Enterprise applications → Users and groups**, and set **Groups claim** in FixFlow to `roles`. Name the role *values* under **Who gets which role**.
5. If you want groups instead: **Token configuration → Add groups claim → Groups assigned to the application**. Entra sends the groups' **object ids** (long numbers), so those are what to write under each role. A person in more than 200 groups gets no groups claim at all (Microsoft's "overage"); FixFlow does not call Microsoft Graph, so use app roles or *groups assigned to the application*, which stay small.
6. Entra often sends no `email` claim. FixFlow then uses `preferred_username` (the sign-in name, usually the email address), and falls back to `upn`. Add the optional claim `email` under **Token configuration** if you want the real mailbox.
7. Entra does not say whether an address is verified. A person who already has a FixFlow account with that address is therefore **not** joined to it unless you tick **Trust unverified email addresses**. Tick it only for a **single-tenant** application whose directory your company controls: with a multi-tenant application, anyone with an Entra tenant could claim any address.

Only single-tenant applications are supported (the issuer has your tenant id in it); the "common" and "organizations" endpoints name a different issuer in every token.

### Okta, Google Workspace and others

The issuer is the provider's own (Okta: `https://<your-org>.okta.com` or the authorization server's address; Google: `https://accounts.google.com`). Anything that publishes `/.well-known/openid-configuration` and signs identity tokens with RS256 or ES256 works. Google puts no groups in the token, so use **Everyone else** for a single role, or another provider for roles by group.

## Setting up LDAP and Active Directory

In **Settings → Company sign-in → LDAP / Active Directory**:

| Field | OpenLDAP | Active Directory |
| --- | --- | --- |
| Server, port | `ldap.acme.com`, 389 (STARTTLS) or 636 (LDAPS) | `dc1.acme.com`, 636 (LDAPS) or 389 (STARTTLS) |
| Service account | `cn=fixflow,ou=services,dc=acme,dc=com` | `fixflow-svc@acme.com` or its full DN |
| Base for people | `ou=people,dc=acme,dc=com` | `OU=Staff,DC=acme,DC=com` |
| People filter | `(objectClass=inetOrgPerson)` | `(&(objectClass=user)(objectCategory=person))` |
| Login attributes | `uid, mail` | `sAMAccountName, userPrincipalName, mail` |
| Email, first, last name | `mail`, `givenName`, `sn` | `mail`, `givenName`, `sn` |
| Stable id | `entryUUID` | `objectGUID` |
| Groups | `memberOf` (needs the memberof overlay) or a **group base** | `memberOf` |

- **The service account** only needs to search for people. FixFlow uses it to find the person from what they typed, then checks the password by signing in **as that person**, and never reads or stores it. With no service account set it searches anonymously, for directories that allow that.
- **Encryption.** **STARTTLS** or **LDAPS** are on offer and the server's certificate is checked. If your directory uses a company certificate authority, paste its certificate under **CA certificate**. **No encryption** sends passwords in the clear: do not use it outside a trial. Unticking **Verify the certificate** is for trials too.
- **A login that two people share** matches no one: neither is the one meant.
- **Groups for a directory without `memberOf`:** give the **group base** (for example `ou=groups,dc=acme,dc=com`); the groups there that list the person in `member` or `uniqueMember` are added to what `memberOf` says.
- **Nested groups** are not followed: put the person in the group directly, or name the group they are in.
- **Press Check**, then **Try a person**: type a login and password and it shows what the directory says (name, email, groups) and **the role they would get**, without signing anyone in or keeping the password.
- A blank password is never sent to the directory (many servers take a name with no password as an anonymous sign-in that succeeds).

An account made in FixFlow keeps working with its own password, and **a person who has one and also exists in the directory** is tried at FixFlow first. The first time the directory signs them in, the account joins the directory and **the FixFlow password stops working**.

## Joining an account that was made before

A person who already has an account here (from an invitation, say) and signs in through the directory is **joined to it** when the directory vouches for their address: LDAP always does, and an OpenID provider does when its token says the address is verified. Their name and role then follow the directory, and the FixFlow password stops working. An account that belongs to the *other* directory kind (LDAP versus OpenID) is not joined: the person sees "Your email address is already used by an account that signs in another way".

## When it goes wrong

The sign-in screen says only what the person needs; the details are in the server log and in **Settings → Audit log**:

| The person sees | Why |
| --- | --- |
| Your account is not in a group that may use FixFlow | None of their groups is named, and there is no role for everyone else, or they were removed from all of them. |
| You do not have an account here yet | Making accounts is off and they have none. |
| Your account has been deactivated | An administrator deactivated them here. Signing in through the directory never brings a person back. |
| An account with your email address already exists here and could not be linked | The provider did not say the address is verified (see Entra above). |
| Your company directory could not be reached | The directory or identity provider is down, or a certificate does not match. Try **Check**. |
| Signing in through your company account did not work | The provider refused the code, or the identity token did not hold up (wrong key, audience, nonce, or expired). |

The audit log records `directory.sign_in_refused` (with the reason and the email), `directory.person_created`, `directory.role_changed`, `directory.role_kept` and `directory_settings.updated`/`removed`.

## Security

- **OpenID Connect uses the authorization code flow with PKCE** (S256), a random **state** and **nonce** that are kept in an encrypted, HTTP-only, same-site cookie in the browser that started the sign-in, so a link someone else made cannot be finished in your browser.
- **The identity token is checked in full** before anything in it is believed: its signature against the provider's published keys (RS256, RS384, RS512, PS256, PS384, PS512, ES256, ES384, ES512 only: unsigned tokens and shared-secret signatures are refused), the issuer, that it is for this client, that it has not expired (a minute of clock difference is allowed) and that it answers this very sign-in.
- **No token is put in an address.** The provider sends the person back to the API, which hands the browser a note good for one minute and one use; the web app swaps it for the session.
- **The client secret and the LDAP service password are stored encrypted** with a key made from `SECRET_KEY_BASE` (so changing that secret means entering them again), and are never sent back to the settings screen.
- **Nothing the person types reaches the LDAP search as syntax:** it is escaped, so `*)(uid=*` finds no one.
- **Addresses must be https** (OpenID) and the number of bytes read from the provider is limited.
- **A session lasts 24 hours.** Removing someone from the directory (or deactivating them there) stops them signing in again, but a session already open runs out by itself; to end it at once, **deactivate them in Settings → Users**, which signs them out everywhere.
- Sign-in attempts are rate-limited per address like password sign-in.

## Turning it off

**Settings → Company sign-in → Remove company sign-in** (or **Enabled** off for one of the two). The sign-in screen goes back to the password form. People who signed in through the directory have no password of their own: an administrator opens **Settings → Users**, the person's menu, **Reset password**, and sends them the link.

## What is not here

SAML, SCIM (accounts made and removed by the directory without a sign-in), single sign-out and syncing groups outside a sign-in are not part of this. Roles are read when a person signs in.

## Trying it yourself

`script/directory_live/` holds a small company for a Keycloak (`keycloak-realm.json`: people `alice`, `bob` and `carol` in the groups `fixflow-admins`, `fixflow-managers` and `fixflow-technicians`, `dave` in none) and for an OpenLDAP (`ldap-seed.ldif`, with `memberof.ldif` to switch on `memberOf` the way Active Directory has it), and `check.rb`, which signs in through both against a running FixFlow API and prints one line for each thing it checks (about fifty: signing in, the role following a group change at Keycloak, a replayed or tampered return, a blank or tricky LDAP login, a certificate that is not trusted, the audit log). `script/directory_live/run` starts the servers in Docker and runs it, and removes them again.

`check.rb` has been run against Keycloak 26.0.8 and OpenLDAP 2.7.1; the Docker start-up in `run` has not been run end to end (see the note at the top of that file).
