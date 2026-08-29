/**
 * Twilio Function: /send-voicemail-email  (the record transcribeCallback)
 *
 * Fires when a voicemail's transcription is ready. Sends a short follow-up email
 * with just the transcript text (no attachment). The recording itself is sent
 * separately, attached, by /voicemail-done (the Record action), which does not
 * depend on transcription. Keeping this function simple and attachment-free is
 * deliberate: the transcript is best-effort, the recording is the reliable path.
 *
 * Public. Email only, never SMS.
 *
 * Env vars: SENDGRID_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM, SITE_LABEL.
 */
exports.handler = function (context, event, callback) {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(context.SENDGRID_API_KEY);

  const transcription = event.TranscriptionText || '(no transcription text available)';
  const from = event.From || 'an unknown caller';
  const label = context.SITE_LABEL || 'Lead line';
  const to = (context.ALERT_EMAIL_TO || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  sgMail
    .send({
      to: to,
      from: context.ALERT_EMAIL_FROM,
      subject: '[' + label + '] Voicemail transcript from ' + from,
      text:
        'Transcript of the voicemail from ' + from + ' on the ' + label + ' line:\n\n' +
        transcription + '\n\n' +
        '(The recording was sent in a separate email.)',
    })
    .then(function () { callback(null, 'sent'); })
    .catch(function (err) { callback(err); });
};
