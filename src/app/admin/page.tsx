import { AdminGeneratorForm } from "@/components/admin-generator-form";

export default function AdminGeneratorPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-foreground">New bulletin entry</h1>
      <p className="mt-1 text-sm text-muted">
        Paste in a raw regulatory update. We&apos;ll draft a structured entry — summary,
        impact score, affected regulated activities and an action checklist — for you to
        review before it goes live.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <AdminGeneratorForm />
      </div>
    </div>
  );
}
