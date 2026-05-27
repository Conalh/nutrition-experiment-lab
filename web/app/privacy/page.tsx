import { Card } from "@/components/ui";

export const metadata = { title: "Privacy · Nutrition Lab" };

export default function PrivacyPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Privacy</h1>
      <p className="mt-0 text-muted">
        How your data is handled in this private beta.
      </p>

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">What we store</h3>
        <p className="text-sm leading-relaxed">
          Your experiments, daily logs, meals, body-weight entries, symptom
          ratings, supplement notes, and confounders. We treat all of this as
          sensitive health-related data and keep it to the minimum needed to
          run your experiments and produce reports.
        </p>
      </Card>

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">What we don&apos;t do</h3>
        <ul className="list-disc pl-[18px] text-sm leading-relaxed">
          <li>No third-party analytics or ad trackers.</li>
          <li>No selling or sharing of your data.</li>
          <li>No medical diagnosis, treatment, or prescription.</li>
          <li>No automatic calorie cuts or restriction plans.</li>
        </ul>
      </Card>

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">Your controls</h3>
        <p className="text-sm leading-relaxed">
          You can export everything you&apos;ve entered as a JSON file at any
          time, and you can permanently delete all of your data. Both live on
          the{" "}
          <a href="/account" className="text-accent">
            Account
          </a>{" "}
          page. Deletion is immediate and cannot be undone.
        </p>
      </Card>

      <Card>
        <h3 className="mt-0 font-semibold">Not a medical service</h3>
        <p className="text-sm leading-relaxed">
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
