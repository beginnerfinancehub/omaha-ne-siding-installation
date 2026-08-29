# Twilio call routing (email lead alerts, no SMS)

**Why this folder exists.** The Twilio Function source lives here in version control, not only in the Twilio console, so the call-routing logic is recoverable, reviewable, and clonable for the next site. This is the network-standard phone flow: every LocalSiteLeads site uses these same seven functions, parameterized only by Service Environment Variables. Proven end-to-end on site #1 and site #2 (Springfield, Abilene); this site (#3) ships with all seven from first deploy rather than adding `call-status.js` later.

## The seven functions

| File | Route | Visibility | Role |
|---|---|---|---|
| `incoming-call.js` | `/incoming-call` | Public | Voice webhook for the published number. An owner calling in (From === OWNER_NUMBER) starts an outbound dial-through; a customer call rings the owner (and PARTNER_NUMBER if set) for `timeout=12` (about two rings) with call SCREENING, then falls through to the recorded greeting + voicemail if the call is not accepted. |
| `whisper.js` | `/whisper` | Public | Screening prompt played to the answering party ONLY, never the customer. Says "Call for {SITE_LABEL}. Press any key to take it." One-second pause first (answer-supervision clip fix). A keypress is required to accept. |
| `screen.js` | `/screen` | Public | The `/whisper` Gather action. A keypress returns empty TwiML (bridges the owner to the caller); no key hangs up that leg so the parent call falls through to voicemail. This is what stops a declined / unanswered / carrier-voicemail call from stealing the lead. |
| `dial-through.js` | `/dial-through` | Public | Owner-mode gather target. Dials the number the owner typed using the site's Twilio number as caller ID, so callbacks and cold calls show the business number, not a personal cell. |
| `voicemail-done.js` | `/voicemail-done` | Public | The `<Record action>`. The single RELIABLE email per call, fired synchronously when recording ends (does not depend on Twilio transcription). Voicemail left (>=2s): email with the recording ATTACHED as an mp3 (listen with no login; falls back to the link if the fetch fails). No message (<2s): a "missed call, no message" email. |
| `send-voicemail-email.js` | `/send-voicemail-email` | Public | The record `transcribeCallback`. Sends a short best-effort follow-up email with just the transcript text. Twilio transcription is unreliable, so this is the secondary path; the recording itself is the reliable email above. |
| `call-status.js` | `/call-status` | Public | Wired at the NUMBER level ("Call status changes", a separate config field from "A call comes in"), not called by any other function. Fires once after every call fully ends, regardless of which verb was executing at hangup. Covers a real gap found on an earlier site: if a caller hangs up before `/voicemail-done` is ever reached (mid-ring, or during the greeting), no email fired at all. Checks for an existing Recording (already handled) or an answered/bridged child call (taken live, silence is by design); if neither, sends a distinct "hung up before voicemail" alert. |

Email only, never SMS: A2P 10DLC was deliberately skipped network-wide, so no `send-voicemail-sms.js` exists. Alerts and transcripts travel by email via SendGrid.

**Why the email fires from the Record action, not the transcribeCallback (learned the hard way on an earlier site).** Twilio's built-in transcription callback did not fire reliably in live testing, so the dependable email (with the mp3) comes from `/voicemail-done`, which runs synchronously when recording ends. `/send-voicemail-email` is kept only as a best-effort transcript follow-up.

**All callback functions MUST be Public.** A Protected function returns 403 ("Unauthorized") to Twilio's own signed Record / Gather / transcribe callbacks, silently, so no email or routing fires. Every function in this flow is Public.

## Environment variables (set in the Twilio Functions Service, NOT in this source)

| Variable | Value |
|---|---|
| `OWNER_NUMBER` | the Chair's cell, E.164 (`+1XXXXXXXXXX`) |
| `PARTNER_NUMBER` | optional second simultaneous ring, E.164 (unset = owner only) |
| `TWILIO_NUMBER` | the provisioned number, used as the outbound caller ID |
| `SENDGRID_API_KEY` | SendGrid API key (Restricted Access, Mail Send). Pasted by the Chair; never in source, logs, or any shared file. |
| `ALERT_EMAIL_TO` | comma-separated recipient list, so one alert reaches every inbox with no forwarding rule |
| `ALERT_EMAIL_FROM` | a SendGrid-verified sender address |
| `SITE_LABEL` | human label for this site, used in the email subject line, recommend "Omaha Siding" |

`DOMAIN_NAME` is provided automatically by the runtime. `greeting.mp3` is a PUBLIC asset (the owner's own recorded voice) uploaded to the service.

## Provisioning (network standard, every site)

1. Buy a local number; set its Voice "A call comes in" webhook to `/incoming-call`, AND its separate "Call status changes" webhook to `/call-status` (a different config field on the same page, easy to miss since it has no default and nothing errors if it's left blank).
2. Add the seven functions above (all Public), the `@sendgrid/mail` dependency, the env vars, and tick "Add my Twilio Credentials to ENV".
3. The Chair records this site's greeting in his own voice; upload it as the public asset `greeting.mp3`.
4. The Chair generates the SendGrid key and pastes it into `SENDGRID_API_KEY` (or reuses the network's existing verified sender/key if one is already set up).
5. Deploy. **Deploying visibility, learned the hard way (see memory `reference-twilio-console-wiring`):** a visibility-only toggle does NOT deploy; the deploy ships whatever visibility was baked into the last SAVED function version. To make a function Public in the live build you must re-SAVE it while it is Public, then Deploy All. Verify with a browser GET (append `?cb=N`): a Public function returns its TwiML, a Protected one returns "Unauthorized - you are not authenticated to perform this request".
6. Live-test (two phones): accept (press a key), decline -> greeting -> voicemail email with the mp3 attached + a best-effort transcript follow-up, and a no-message hang-up -> one "missed call" email. A hang-up before voicemail is ever reached (mid-ring, or during the greeting) -> a distinct "hung up before voicemail" email from `/call-status`.

## This site

- **Number provisioned 2026-08-28.** +1 (531) 233-2741, Omaha, NE (the 531 overlay code; the 402-prefix search only returned small rural exchanges, not Omaha itself, so 531 was the Chair-approved choice), $1.15/mo, Voice channel only (Messaging/SMS not enabled, this venture's text-back capability is adopted at-trigger only, after a paying tenant, per the standing scaling doctrine). Swapped into `src/lib/site.js` (`phoneDisplay` / `phoneHref`) the same session.
- **Still open:** the Functions Service itself is not yet stood up. Buy nothing further, just: create the Service (recommend `omaha-siding-call-routing`), deploy these seven functions Public, set `SITE_LABEL` to "Omaha Siding", record the greeting, run the two-phone live test, then fill in this section with the service SID, number SID, and live-test date, matching the format the two prior sites use. This is C4 step 6b, a discrete Chair-present step later in the same launch pass.

No em-dashes anywhere (portfolio-wide rule).
