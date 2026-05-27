import { Card } from "@/components/ui";

export const metadata = { title: "Privacy · Nutrition Lab" };

export default function PrivacyPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Privacy</h1>
      <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
        How your data is handled in this private beta.
      </p>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>What we store</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Your experiments, daily logs, meals, body-weight entries, symptom
          ratings, supplement notes, and confounders. We treat all of this as
          sensitive health-related data and keep it to the minimum needed to
          run your experiments and produce reports.
        </p>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>What we don&apos;t do</h3>
        <ul style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 18 }}>
          <li>No third-party analytics or ad trackers.</li>
          <li>No selling or sharing of your data.</li>
          <li>No medical diagnosis, treatment, or prescription.</li>
          <li>No automatic calorie cuts or restriction plans.</li>
        </ul>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Your controls</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          You can export everything you&apos;ve entered as a JSON file at any
          time, and you can permanently delete all of your data. Both live on
          the <a href="/account" style={{ color: "var(--accent)" }}>Account</a>{" "}
          page. Deletion is immediate and cannot be undone.
        </p>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>Not a medical service</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          This product is a personal lab notebook for learning how food choices
          relate to how you feel. It is not a medical device and does not
          provide medical advice. For anything involving illness, disordered
          eating, allergies, or chronic conditions, please consult a qualified
          clinician.
        </p>
      </Card>
    </div>
  );
}
