/**
 * Twilio Function: /whisper  (screening prompt on the OWNER's answering leg)
 *
 * Played to whoever answers the owner's phone, NEVER to the customer. Two jobs:
 *  (a) tell the owner which site the lead is for (via SITE_LABEL), and
 *  (b) require a keypress to accept, so a declined / ignored / carrier-voicemail
 *      answer does NOT bridge; /screen then hangs that leg up and the parent call
 *      falls through to the recorded greeting + voicemail.
 *
 * The prompt names the site (SITE_LABEL), the fixed network-standard whisper
 * pattern: owner-facing only, never reaches the customer, and names the site so
 * the owner can route the call correctly across multiple sites. The 1-second
 * pause is the answer-supervision clip fix.
 */
exports.handler = function (context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  const label = context.SITE_LABEL || 'your leads';
  const gather = twiml.gather({
    numDigits: 1,
    timeout: 8,
    actionOnEmptyResult: true,
    action: 'https://' + context.DOMAIN_NAME + '/screen',
    method: 'POST',
  });
  gather.pause({ length: 1 });
  gather.say(
    { voice: 'Polly.Joanna' },
    'Call for ' + label + '. Press any key to take it.'
  );
  callback(null, twiml);
};
