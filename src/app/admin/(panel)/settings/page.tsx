import { requireAdmin } from "@/lib/server/auth";
import { getPaymentsEnabled, getSetting } from "@/lib/server/settings";
import { PaymentsToggle } from "@/features/settings/client/PaymentsToggle";
import { AdminNotificationSettings } from "@/features/settings/client/AdminNotificationSettings";
import { SiteContentSettings } from "@/features/settings/client/SiteContentSettings";
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
  const [paymentsEnabled, notifyPairs, siteContent] = await Promise.all([
    getPaymentsEnabled(),
    Promise.all(
      ADMIN_NOTIFY_TYPES.map(
        async (t) =>
          [t.key, (await getSetting(adminNotifyKey(t.key))) !== "false"] as const
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
