// ============================================================
// AFRICA'S TALKING INTEGRATION POINT
// ============================================================
// This is the ONLY file that talks to the Africa's Talking SDK.
// Everything else in the app calls the functions exported below.
//
// >>> TO GO LIVE, YOU NEED TO EDIT backend/.env (not this file):
//   AT_USERNAME, AT_API_KEY, AT_SMS_SENDER_ID,
//   AT_USSD_SERVICE_CODE, AT_VOICE_CALLER_ID
// See backend/.env.example for step-by-step instructions on where
// to get each value from the Africa's Talking dashboard.
// ============================================================

import AfricasTalking from "africastalking";
import dotenv from "dotenv";
dotenv.config();

const hasCredentials =
  process.env.AT_API_KEY && process.env.AT_API_KEY !== "PASTE_YOUR_SANDBOX_API_KEY_HERE";

let sms, voice;

if (hasCredentials) {
  const at = AfricasTalking({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || "sandbox",
  });
  sms = at.SMS;
  voice = at.VOICE;
} else {
  console.warn(
    "\n[Africa's Talking] No AT_API_KEY found in .env — running in MOCK mode.\n" +
    "SMS/Voice calls will be logged to the console and saved as 'simulated' in the DB,\n" +
    "instead of actually hitting the Africa's Talking API.\n" +
    "Add real credentials to backend/.env to send live sandbox messages.\n"
  );
}

const SPONSOR_TAG = " -- Powered by Java House Nairobi"; // <= 40 chars, swap for your sponsor

/**
 * Send an SMS via Africa's Talking, with a micro-sponsorship tag appended
 * (this is PitchLink's monetization mechanic for grassroots organizers).
 * @param {string} to - E.164 phone number, e.g. +2547XXXXXXXX
 * @param {string} message
 * @returns {Promise<{status: string, providerRef: string|null, body: string}>}
 */
export async function sendSms(to, message) {
  const fullBody = `${message}${SPONSOR_TAG}`.slice(0, 160); // keep it to one SMS segment where possible

  if (!hasCredentials) {
    console.log(`[MOCK SMS] to=${to} body="${fullBody}"`);
    return { status: "simulated", providerRef: null, body: fullBody };
  }

  try {
    const result = await sms.send({
      to: [to],
      message: fullBody,
      // from: process.env.AT_SMS_SENDER_ID || undefined, // leave undefined to use sandbox default
    });
    const recipient = result?.SMSMessageData?.Recipients?.[0];
    return {
      status: recipient?.status === "Success" ? "sent" : "failed",
      providerRef: recipient?.messageId || null,
      body: fullBody,
    };
  } catch (err) {
    console.error("[AT SMS] send failed:", err.message);
    return { status: "failed", providerRef: null, body: fullBody, error: err.message };
  }
}

/**
 * Trigger an outbound automated voice call (text-to-speech) — used for
 * urgent match-cancellation alerts.
 * @param {string} to - E.164 phone number to call
 * @param {string} ttsMessage - what the robocall should say
 */
export async function triggerVoiceAlert(to, ttsMessage) {
  if (!hasCredentials) {
    console.log(`[MOCK VOICE CALL] to=${to} says="${ttsMessage}"`);
    return { status: "simulated", providerRef: null };
  }

  try {
    const result = await voice.call({
      callFrom: process.env.AT_VOICE_CALLER_ID,
      callTo: [to],
    });
    // NOTE: Africa's Talking Voice works as an event-driven flow: after the
    // call connects, AT hits your `/api/voice/events` callback (see
    // routes/voice.js) asking what to say/play next. That's where the
    // actual TTS XML/response for `ttsMessage` gets served from.
    return {
      status: result?.entries?.[0]?.status || "queued",
      providerRef: result?.entries?.[0]?.sessionId || null,
    };
  } catch (err) {
    console.error("[AT Voice] call failed:", err.message);
    return { status: "failed", providerRef: null, error: err.message };
  }
}

export const isLiveMode = hasCredentials;
