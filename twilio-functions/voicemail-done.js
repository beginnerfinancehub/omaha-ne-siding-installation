/**
 * Twilio Function: /voicemail-done  (the <Record> action)
 *
 * The single, reliable email per call. Fires when the recording ends (a
 * synchronous callback that does NOT depend on Twilio's transcription service).
 * MUST be Public so Twilio's Record-action request is never blocked.
 *  - Voicemail left (RecordingDuration >= 2s): email with the recording attached
 *    as an mp3 (listen with no login). If the attach fails, the email still sends
 *    with the recording link as a fallback. A transcript follows separately from
 *    /send-voicemail-email if transcription is available.
 *  - No message (under 2s): a "missed call, no message" email.
 *
 * Env vars: SENDGRID_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM, SITE_LABEL.
 * ACCOUNT_SID / AUTH_TOKEN (present via "Add my Twilio Credentials to ENV") fetch
 * the recording for the attachment.
 */
exports.handler = async function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(context.SENDGRID_API_KEY);
    const duration = parseInt(event.RecordingDuration || '0', 10);
    const recordingUrl = event.RecordingUrl || '';
    const from = event.From || 'an unknown caller';
    const label = context.SITE_LABEL || 'Lead line';
    const to = (context.ALERT_EMAIL_TO || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    let msg;

    if (duration >= 2 && recordingUrl) {
      msg = {
        to: to,
        from: context.ALERT_EMAIL_FROM,
        subject: '[' + label + '] New voicemail from ' + from,
        text:
          'New voicemail on the ' + label + ' line.\n' +
          'From: ' + from + '\n' +
          'Length: ' + duration + ' seconds\n\n' +
          'The recording is attached as an mp3. A transcript follows in a separate email if available.\n\n' +
          'Call them back.',
      };
      try {
        if (context.ACCOUNT_SID && context.AUTH_TOKEN) {
          const auth = Buffer.from(context.ACCOUNT_SID + ':' + context.AUTH_TOKEN).toString('base64');
          const resp = await fetch(recordingUrl + '.mp3', { headers: { Authorization: 'Basic ' + auth } });
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            msg.attachments = [{
              content: buf.toString('base64'),
              filename: 'voicemail.mp3',
              type: 'audio/mpeg',
              disposition: 'attachment',
            }];
          }
        }
      } catch (e) {
        console.error('recording attach failed', e);
      }
      if (!msg.attachments) {
        msg.text =
          'New voicemail on the ' + label + ' line.\n' +
          'From: ' + from + '\n' +
          'Length: ' + duration + ' seconds\n\n' +
          'Listen (sign in to Twilio if prompted):\n' + recordingUrl + '.mp3\n\n' +
          'A transcript follows in a separate email if available. Call them back.';
      }
    } else {
      msg = {
        to: to,
        from: context.ALERT_EMAIL_FROM,
        subject: '[' + label + '] Missed call from ' + from,
        text:
          'Missed call on the ' + label + ' line (no voicemail left).\n' +
          'Caller: ' + from + '\n' +
          'Time: ' + new Date().toISOString() + '\n\n' +
          'Call them back.',
      };
    }

    try {
      await sgMail.send(msg);
    } catch (err) {
      // If the send failed with an attachment, retry once without it.
      if (msg.attachments) {
        delete msg.attachments;
        msg.text += '\n\n(The recording attachment could not be sent; listen at ' + recordingUrl + '.mp3)';
        await sgMail.send(msg);
      } else {
        throw err;
      }
    }
  } catch (e) {
    console.error('voicemail-done email failed', e);
  }
  twiml.hangup();
  callback(null, twiml);
};
