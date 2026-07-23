import { requireAdmin } from "@/lib/server/auth";
import { getPaymentsEnabled } from "@/lib/server/settings";
import { PaymentsToggle } from "@/features/settings/client/PaymentsToggle";
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
  const paymentsEnabled = await getPaymentsEnabled();

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
    </div>
  );
}
