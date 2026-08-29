/**
 * Twilio Function: /incoming-call  (Voice webhook for the site's published number)
 *
 * Two modes:
 *  1. OWNER dial-through (From === OWNER_NUMBER): prompt for a destination number
 *     and bridge outbound using the site's Twilio number as caller ID, so the
 *     owner's callbacks and cold calls show the business number.
 *  2. Customer call: ring the owner with call SCREENING. The owner must press a
 *     key to accept (see /whisper + /screen). If the owner declines, ignores the
 *     call, is on another call, has Do Not Disturb on, or the phone is off (so the
 *     carrier voicemail answers), the screening leg is hung up and the call FALLS
 *     THROUGH to the recorded greeting + voicemail below, so a caller can never
 *     land in the owner's personal carrier voicemail.
 *
 * Personal numbers are never hard-coded; they come from Service Environment
 * Variables: OWNER_NUMBER, optional PARTNER_NUMBER, TWILIO_NUMBER. The voicemail
 * callbacks use SITE_LABEL, SENDGRID_API_KEY, and ALERT_EMAIL_TO / ALERT_EMAIL_FROM.
 * DOMAIN_NAME is provided automatically by the runtime.
 */
exports.handler = function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  const domain = context.DOMAIN_NAME;

  // Mode 1: owner is calling in, start an outbound dial-through.
  if (context.OWNER_NUMBER && event.From === context.OWNER_NUMBER) {
    const gather = twiml.gather({
      input: 'dtmf',
      numDigits: 11,
      timeout: 8,
      finishOnKey: '#',
      action: 'https://' + domain + '/dial-through',
      method: 'POST',
    });
    gather.say(
      { voice: 'Polly.Joanna' },
      'Enter the number to call, starting with 1, then press pound.'
    );
    twiml.hangup();
    return callback(null, twiml);
  }

  // Mode 2: customer call. Ring the owner with screening (a keypress to accept).
  const whisperUrl = 'https://' + domain + '/whisper';
  const dial = twiml.dial({
    timeout: 12,
    answerOnBridge: true,
    callerId: context.TWILIO_NUMBER || event.To,
  });
  dial.number({ url: whisperUrl }, context.OWNER_NUMBER);
  if (context.PARTNER_NUMBER) {
    dial.number({ url: whisperUrl }, context.PARTNER_NUMBER);
  }

  // Fall-through voicemail: reached ONLY when the call was not accepted (declined,
  // no answer, busy, Do Not Disturb, or a carrier voicemail that /screen hangs up).
  // A real, accepted, and completed conversation ends the call before this point.
  twiml.play('https://' + domain + '/greeting.mp3');
  twiml.record({
    maxLength: 120,
    playBeep: true,
    transcribe: true,
    transcribeCallback: 'https://' + domain + '/send-voicemail-email',
    action: 'https://' + domain + '/voicemail-done',
  });
  twiml.hangup();

  callback(null, twiml);
};
