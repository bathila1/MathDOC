import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sendSms } from "@/lib/server/sms";
import { APP_NAME, SMS_GATEWAY_AUTH_ERROR } from "@/lib/shared/constants";
import { getDebugErrorsEnabled } from "@/lib/server/settings";

/**
 * Supabase Auth "Send SMS" hook. Supabase calls this endpoint whenever it
 * needs to deliver an OTP; we forward the code through Hutch.
 * Configure in Supabase: Auth → Hooks → Send SMS hook → HTTPS →
 *   https://<your-domain>/api/auth/sms-hook  (secret goes in SUPABASE_AUTH_HOOK_SECRET)
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  const payload = await request.text();

  let data: { user?: { phone?: string }; sms?: { otp?: string } };

  if (secret) {
    try {
      const wh = new Webhook(secret.replace(/^v1,whsec_/, ""));
      data = wh.verify(payload, {
        "webhook-id": request.headers.get("webhook-id") ?? "",
        "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": request.headers.get("webhook-signature") ?? "",
      }) as typeof data;
    } catch {
      return NextResponse.json(
        { error: { http_code: 401, message: "Invalid hook signature." } },
        { status: 401 }
      );
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: { http_code: 500, message: "Hook secret not configured." } },
        { status: 500 }
      );
    }
    data = JSON.parse(payload);
  }

  const phone = data.user?.phone;
  const otp = data.sms?.otp;
  if (!phone || !otp) {
    return NextResponse.json(
      { error: { http_code: 400, message: "Missing phone or otp in payload." } },
      { status: 400 }
    );
  }

  const result = await sendSms(
    phone.startsWith("+") ? phone : `+${phone}`,
    `Your ${APP_NAME} login code is ${otp}. It expires in 5 minutes.`,
    `${APP_NAME} OTP`
  );

  if (!result.sent) {
    // Supabase relays this message back through signInWithOtp, so it is what
    // the student ends up reading. A credential failure gets named rather
    // than blamed on the number — it takes an operator to fix, and the
    // generic wording had people re-typing a number that was never wrong.
    const credentialFailure =
      result.reason === "gateway_auth" || result.reason === "not_configured";

    if (credentialFailure) {
      console.error(
        "STUDENT LOGIN IS DOWN: could not authenticate to the Hutch SMS " +
          `gateway (${result.reason}). No OTP can be delivered until the ` +
          "HUTCH_SMS_* credentials are fixed — see docs/sms-otp-setup.md."
      );
    }

    const message = credentialFailure
      ? SMS_GATEWAY_AUTH_ERROR
      : (result.error ?? "SMS failed.");

    // Debug mode (admin → Settings) appends which of the failure modes it
    // was, so an operator can tell a wrong password from a Hutch outage
    // without reading the server logs.
    const detailed = (await getDebugErrorsEnabled())
      ? `${message} (reason: ${result.reason})`
      : message;

    return NextResponse.json(
      { error: { http_code: 502, message: detailed } },
      { status: 502 }
    );
  }
  return NextResponse.json({});
}
