/**
 * Twilio Function: /screen  (decides whether to bridge the owner's leg)
 *
 * The action target of the /whisper screening Gather.
 *  - A key was pressed  -> return empty TwiML, which completes the whisper and
 *    BRIDGES the owner to the caller.
 *  - No key (declined, ignored, on another call, Do Not Disturb, or a carrier
 *    voicemail answered) -> hang up this leg, so the parent call falls through to
 *    the recorded greeting + voicemail in /incoming-call. This is what stops a
 *    carrier voicemail from stealing the call.
 */
exports.handler = function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  if (event.Digits) {
    // Accepted: an empty response completes the whisper and bridges the call.
    return callback(null, twiml);
  }
  // Not accepted: drop this leg so the caller falls through to voicemail.
  twiml.hangup();
  callback(null, twiml);
};
