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
import type { CertificateView } from "./queries";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    color: "#222",
    backgroundColor: "#fffdf5",
  },
  frame: {
    flex: 1,
    borderWidth: 4,
    borderColor: "#d97706",
    borderStyle: "solid",
    padding: 6,
  },
  inner: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d97706",
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { fontSize: 11, letterSpacing: 4, color: "#666", marginBottom: 6 },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 28 },
  certifies: { fontSize: 12, color: "#555" },
  name: {
    fontSize: 32,
    fontFamily: "Times-BoldItalic",
    marginTop: 10,
    marginBottom: 22,
  },
  body: {
    fontSize: 12,
    color: "#444",
    textAlign: "center",
    maxWidth: 380,
    lineHeight: 1.6,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 360,
    marginTop: 48,
  },
  signBlock: { width: 140 },
  signText: { fontSize: 11 },
  signName: { fontSize: 16, fontFamily: "Times-Italic", marginBottom: 4 },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: "#999",
    paddingTop: 4,
    fontSize: 9,
    color: "#777",
  },
  certId: { fontSize: 8, color: "#999", marginTop: 30 },
});

export async function renderCertificatePdf(
  view: CertificateView
): Promise<Buffer> {
  const { certificate, studentName, taskCount } = view;
  const doc = (
    <Document title={`MathDOC Certificate — ${studentName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.inner}>
            <Text style={styles.eyebrow}>CERTIFICATE OF COMPLETION</Text>
            <Text style={styles.brand}>MathDOC</Text>
            <Text style={styles.certifies}>This certifies that</Text>
            <Text style={styles.name}>{studentName}</Text>
            <Text style={styles.body}>
              has successfully completed all {taskCount} tasks of their
              Personal Improvement Plan, showing real dedication and progress
              in mathematics.
            </Text>
            <View style={styles.signRow}>
              <View style={styles.signBlock}>
                <Text style={styles.signText}>
                  {format(new Date(certificate.issued_at), "d MMMM yyyy")}
                </Text>
                <Text style={styles.signLine}>Date</Text>
              </View>
              <View style={styles.signBlock}>
                <Text style={styles.signName}>Sir</Text>
                <Text style={styles.signLine}>Teacher</Text>
              </View>
            </View>
            <Text style={styles.certId}>
              Certificate ID: {certificate.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
