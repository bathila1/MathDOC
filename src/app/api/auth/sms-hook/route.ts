import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sendSms } from "@/lib/server/sms";
import { APP_NAME } from "@/lib/shared/constants";

/**
 * Supabase Auth "Send SMS" hook. Supabase calls this endpoint whenever it
 * needs to deliver an OTP; we forward the code through SMSLenz.
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
    `Your ${APP_NAME} login code is ${otp}. It expires in 5 minutes.`
  );

  if (!result.sent) {
    return NextResponse.json(
      { error: { http_code: 502, message: result.error ?? "SMS failed." } },
      { status: 502 }
    );
  }
  return NextResponse.json({});
}
