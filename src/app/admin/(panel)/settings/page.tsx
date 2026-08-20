import { requireAdmin } from "@/lib/server/auth";
import {
  getDebugErrorsEnabled,
  getPaymentsEnabled,
  getSetting,
} from "@/lib/server/settings";
import { PaymentsToggle } from "@/features/settings/client/PaymentsToggle";
import { AdminNotificationSettings } from "@/features/settings/client/AdminNotificationSettings";
import { SiteContentSettings } from "@/features/settings/client/SiteContentSettings";
import { DataManagement } from "@/features/settings/client/DataManagement";
import { DebugErrorsToggle } from "@/features/settings/client/DebugErrorsToggle";
import {
  getSiteContent,
  getHeroImageUrl,
} from "@/features/settings/server/content";
import { ADMIN_NOTIFY_TYPES, adminNotifyKey } from "@/lib/shared/notifications";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [paymentsEnabled, debugErrors, notifyPairs, siteContent] =
    await Promise.all([
      getPaymentsEnabled(),
      getDebugErrorsEnabled(),
      Promise.all(
        ADMIN_NOTIFY_TYPES.map(
          async (t) =>
            [
              t.key,
              (await getSetting(adminNotifyKey(t.key))) !== "false",
            ] as const
        )
      ),
      getSiteContent(),
    ]);
  const notifyPrefs = Object.fromEntries(notifyPairs);
  const heroUrl = await getHeroImageUrl(siteContent);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Control how MathDOC behaves for students.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>
            When off, students book sessions without a pricing or payment step —
            bookings are confirmed straight away. Turn this on once the payment
            gateway is ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsToggle enabled={paymentsEnabled} />
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Home page content</CardTitle>
          <CardDescription>
            The heading, photo and social links shown on the public home page at
            mathdoc.edu.lk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SiteContentSettings
            initial={siteContent}
            initialHeroUrl={heroUrl}
          />
        </CardContent>
      </Card>

      <Card className="max-w-xl border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Clear data</CardTitle>
          <CardDescription>
            Permanently delete records — useful at the end of a year, or to
            clear out test data. Pick exactly what goes; your settings, survey
            questions and task templates are always kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataManagement />
        </CardContent>
      </Card>

      <Card className="max-w-xl border-destructive/40">
        <CardHeader>
          <CardTitle>Debug errors</CardTitle>
          <CardDescription>
            While on, login and SMS failures show the exact underlying cause
            instead of a friendly message — the gateway response, the config
            key, the provider that refused. Turn it on to diagnose a problem,
            then turn it back off:{" "}
            <strong className="text-destructive">
              these messages are shown to anyone on the public login page
            </strong>
            , not just to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DebugErrorsToggle enabled={debugErrors} />
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Notification control centre</CardTitle>
          <CardDescription>
            Choose which alerts you get in the teacher panel. Students always
            receive their own notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminNotificationSettings prefs={notifyPrefs} />
        </CardContent>
      </Card>
    </div>
  );
}
