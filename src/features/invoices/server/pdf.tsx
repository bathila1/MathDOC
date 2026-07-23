import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import type { InvoiceView } from "./queries";
import { formatPhone } from "@/lib/shared/phone";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#111" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  brand: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  sub: { color: "#666", marginTop: 2 },
  invoiceTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "right" },
  hr: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 18 },
  label: { color: "#666", fontFamily: "Helvetica-Bold", marginBottom: 3 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    paddingBottom: 6,
    marginTop: 24,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 10,
  },
  cellDesc: { flex: 3 },
  cellAmount: { flex: 1, textAlign: "right" },
  total: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14, gap: 24 },
  totalLabel: { fontFamily: "Helvetica-Bold" },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 14 },
  status: { marginTop: 6, textAlign: "right", fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 40, left: 48, right: 48, textAlign: "center", color: "#888", fontSize: 9 },
});

const statusText: Record<string, string> = {
  paid: "PAID",
  bypassed: "PAYMENT PENDING",
  unpaid: "UNPAID",
};

export async function renderInvoicePdf(view: InvoiceView): Promise<Buffer> {
  const { invoice, appointment, slot, student } = view;
  const doc = (
    <Document title={`MathDOC Invoice ${invoice.id.slice(0, 8)}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.row}>
          <View>
            <Text style={styles.brand}>MathDOC</Text>
            <Text style={styles.sub}>Personal Maths Coaching</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={{ ...styles.sub, textAlign: "right" }}>
              #{invoice.id.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={styles.status}>
              {statusText[invoice.status] ?? "UNPAID"}
            </Text>
          </View>
        </View>

        <View style={styles.hr} />

        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Billed to</Text>
            <Text>{student.full_name ?? "Student"}</Text>
            {student.phone ? <Text>{formatPhone(student.phone)}</Text> : null}
            {student.address ? <Text>{student.address}</Text> : null}
          </View>
          <View>
            <Text style={styles.label}>Issued</Text>
            <Text>{format(new Date(invoice.issued_at), "d MMMM yyyy")}</Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={{ ...styles.cellDesc, fontFamily: "Helvetica-Bold" }}>
            Description
          </Text>
          <Text style={{ ...styles.cellAmount, fontFamily: "Helvetica-Bold" }}>
            Amount
          </Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.cellDesc}>
            One-to-one tutoring session (
            {appointment.mode === "online" ? "online" : "in person"}) —{" "}
            {format(new Date(slot.starts_at), "EEE d MMM yyyy, h:mm a")}
          </Text>
          <Text style={styles.cellAmount}>
            Rs. {Number(invoice.amount).toLocaleString()}
          </Text>
        </View>

        <View style={styles.total}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            Rs. {Number(invoice.amount).toLocaleString()}
          </Text>
        </View>

        <Text style={styles.footer}>
          Thank you! Keep this invoice for your records.
        </Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
