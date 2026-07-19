import "server-only";
import { toSmsLenzContact } from "@/lib/shared/phone";

/** True when SMSLenz credentials are present; otherwise SMS is simulated. */
export function smsConfigured(): boolean {
  return Boolean(
    process.env.SMSLENZ_USER_ID &&
      process.env.SMSLENZ_API_KEY &&
      process.env.SMSLENZ_SENDER_ID
  );
}

/**
 * SMSLenz gateway (https://smslenz.lk). Used for booking notifications and,
 * via the Supabase Send-SMS auth hook, for login OTP codes.
 * Without env keys (local dev) messages are logged to the console instead,
 * and the UI shows an on-screen preview of what would have been sent.
 */
export async function sendSms(
  phoneE164: string,
  message: string
): Promise<{ sent: boolean; error?: string }> {
  if (!smsConfigured()) {
    console.log(`[SIMULATED SMS to ${phoneE164}]\n${message}`);
    return { sent: true };
  }
  const userId = process.env.SMSLENZ_USER_ID;
  const apiKey = process.env.SMSLENZ_API_KEY;
  const senderId = process.env.SMSLENZ_SENDER_ID;

  try {
    const res = await fetch(
      process.env.SMSLENZ_API_URL ?? "https://smslenz.lk/api/send-sms",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          api_key: apiKey,
          sender_id: senderId,
          contact: toSmsLenzContact(phoneE164),
          message,
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`SMSLenz error ${res.status}: ${body}`);
      return { sent: false, error: `SMS gateway returned ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("SMSLenz request failed", e);
    return { sent: false, error: "Could not reach the SMS gateway." };
  }
}
