/**
 * Twilio Function: /call-status  (the number's "Call status changes" webhook)
 *
 * Closes a real gap the network learned the hard way on an earlier site:
 * /voicemail-done only fires from inside the <Record> verb's action callback. If
 * a caller hangs up BEFORE that verb is ever reached (mid-ring on the
 * owner-screening leg, or during the greeting <Play>), Twilio never executes
 * /voicemail-done, so NO email fires at all, even though a real call with a real
 * caller ID happened. This function is the network-standard fix, included here
 * from first deploy rather than added later.
 *
 * This function is wired at the NUMBER level (Phone Numbers -> Manage -> this
 * number -> Voice Configuration -> "Call status changes"), separate from the
 * "A call comes in" webhook. Twilio calls it once, after every call to this
 * number fully ends, regardless of which TwiML verb was executing at hangup.
 *
 * Logic: skip (send nothing) if either of the two cases the existing flow
 * already covers applies:
 *   (a) a Recording exists for this CallSid -> /voicemail-done already handled
 *       it (either "New voicemail" or its own "Missed call, no message" email).
 *   (b) the owner-screening child call was answered with real duration -> the
 *       call was taken live, and staying silent on an answered call is this
 *       system's existing by-design behavior.
 * Otherwise, the caller hung up before ever reaching voicemail. Send a distinct
 * "hung up before message" alert so it's not confused with a real voicemail.
 *
 * Small known race: if a caller hangs up mid-recording, Twilio may still be
 * finalizing the Recording resource when this fires. Rare in practice (the
 * completed status callback fires after the whole TwiML document, including
 * the Record verb's own action, has already run); a Recording-check false
 * negative here would just produce one extra "hung up before message" alert
 * alongside the real one from /voicemail-done, not a missed alert.
 *
 * Env vars: SENDGRID_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM, SITE_LABEL.
 * ACCOUNT_SID / AUTH_TOKEN must be present ("Add my Twilio Credentials to ENV")
 * so getTwilioClient() can query calls/recordings.
 * MUST be Public: this is Twilio's own signed webhook, not user-facing TwiML.
 */
exports.handler = async function (context, event, callback) {
  try {
    const callSid = event.CallSid;
    const from = event.From || 'an unknown caller';
    const duration = event.CallDuration || '0';
    const label = context.SITE_LABEL || 'Lead line';

    // Only act on the inbound customer-facing call finishing. Ignore anything
    // that isn't a completed inbound call (e.g. a stray status ping).
    if (event.Direction && event.Direction.indexOf('inbound') === -1) {
      return callback(null, 'not inbound, skip');
    }
    if (event.CallStatus !== 'completed') {
      return callback(null, 'not completed, skip: ' + event.CallStatus);
    }

    const client = context.getTwilioClient();

    // Case (a): a recording already exists for this call. voicemail-done.js
    // already emailed for it (voicemail or no-message-left). Don't duplicate.
    const recordings = await client.recordings.list({ callSid: callSid, limit: 1 });
    if (recordings.length > 0) {
      return callback(null, 'recording exists, voicemail-done already handled it, skip');
    }

    // Case (b): the owner (or partner) screening leg was actually answered and
    // bridged (a real conversation happened). Silence on an answered call is
    // this system's existing by-design behavior; don't alert on it.
    const children = await client.calls.list({ parentCallSid: callSid });
    const bridged = children.some(function (c) {
      return c.status === 'completed' && parseInt(c.duration || '0', 10) > 0;
    });
    if (bridged) {
      return callback(null, 'answered live, skip');
    }

    // Neither: the caller hung up before ever reaching voicemail. This is the
    // gap. Send a distinct alert so it reads differently from a real voicemail
    // or a "no message left at the beep" call.
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(context.SENDGRID_API_KEY);
    const to = (context.ALERT_EMAIL_TO || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    await sgMail.send({
      to: to,
      from: context.ALERT_EMAIL_FROM,
      subject: '[' + label + '] Call from ' + from + ' (hung up before voicemail)',
      text:
        'A call came in on the ' + label + ' line and the caller hung up before ' +
        'reaching voicemail, so no message or recording exists.\n' +
        'Caller: ' + from + '\n' +
        'Call length: ' + duration + ' seconds\n' +
        'Time: ' + new Date().toISOString() + '\n\n' +
        'This is often a hang-up, wrong number, or a lead platform\'s own ' +
        'verification call. Worth a callback if it looks like a real lead.',
    });
    callback(null, 'sent hung-up-before-voicemail alert');
  } catch (e) {
    console.error('call-status handler failed', e);
    callback(null, 'error, see function logs: ' + e.message);
  }
};
