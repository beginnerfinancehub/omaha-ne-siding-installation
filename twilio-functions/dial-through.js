/**
 * Twilio Function: /dial-through  (destination gather target for owner mode)
 *
 * Runs only for an owner dial-through started in /incoming-call. Dials the
 * number the owner typed, using the site's Twilio number as caller ID so the
 * recipient sees the business number, not the owner's personal cell.
 */
exports.handler = function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  const digits = (event.Digits || '').replace(/[^0-9]/g, '');

  if (!digits) {
    twiml.say({ voice: 'Polly.Joanna' }, 'No number entered. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  }

  // 10 digits -> assume US, prepend +1; otherwise treat as already-full E.164 digits.
  const dest = digits.length === 10 ? '+1' + digits : '+' + digits;

  const dial = twiml.dial({
    callerId: context.TWILIO_NUMBER,
    answerOnBridge: true,
  });
  dial.number(dest);
  callback(null, twiml);
};
