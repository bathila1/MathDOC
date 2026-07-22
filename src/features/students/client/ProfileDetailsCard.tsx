"use client";

import { useState } from "react";
import { ProfileForm, type ProfileValues } from "./ProfileForm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

/**
 * The student's details on their profile page: read-only by default,
 * editable in place — no jump to the registration page.
 */
export function ProfileDetailsCard({
  values,
  readOnlyRows,
}: {
  /** current values, used to prefill the inline form */
  values: ProfileValues;
  /** label/value pairs shown when not editing (includes phone, quiz, etc.) */
  readOnlyRows: [string, string | null][];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>My details</CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit details
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <ProfileForm
            mode="edit"
            withCard={false}
            initial={values}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {readOnlyRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b pb-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">
                  {value ?? <span className="text-muted-foreground/60">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
