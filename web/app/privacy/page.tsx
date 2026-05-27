import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Privacy · Nutrition Lab" };

export default function PrivacyPage() {
  return (
    <>
      <TopBar breadcrumb={["Settings", "Privacy"]} title="Privacy" eyebrow="Non-clinical positioning" />

      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
        <Card eyebrow="What we store" title="The minimum to run your experiments">
          <p className="m-0 text-[13px] leading-[1.6] text-ink-2">
            Your experiments, daily logs, meals, body-weight entries, symptom
            ratings, supplement notes, and confounders. We treat all of this as
            sensitive health-related data and keep only what&apos;s needed to run
            your experiments and produce reports.
          </p>
        </Card>

        <Card eyebrow="What we don't do" title="No tricks">
          <ul className="m-0 list-disc pl-4 text-[13px] leading-[1.7] text-ink-2">
            <li>No third-party analytics or ad trackers.</li>
            <li>No selling or sharing of your data.</li>
            <li>No medical diagnosis, treatment, or prescription.</li>
            <li>No automatic calorie cuts or restriction plans.</li>
          </ul>
        </Card>

        <Card eyebrow="Your controls" title="Export and delete">
          <p className="m-0 text-[13px] leading-[1.6] text-ink-2">
            You can export everything you&apos;ve entered as a JSON file at any
            time, and you can permanently delete all of your data. Both live on
            the <span className="text-signal-ink">Account</span> page. Deletion
            is immediate and cannot be undone.
          </p>
        </Card>

        <Card eyebrow="Not a medical service" title="A lab notebook, not a clinic">
          <p className="m-0 text-[13px] leading-[1.6] text-ink-2">
            This product is a personal lab notebook for learning how food
            choices relate to how you feel. It is not a medical device and does
            not provide medical advice. For anything involving illness,
            disordered eating, allergies, or chronic conditions, please consult
            a qualified clinician.
          </p>
        </Card>
      </div>
    </>
  );
}
