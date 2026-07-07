import { CheckCircle2, Layers3, ShieldCheck } from "lucide-react";
import LeadForm from "@/components/LeadForm";

const trustItems = [
  { icon: CheckCircle2, label: "Free consultation" },
  { icon: ShieldCheck, label: "No commitment" },
  { icon: Layers3, label: "Web · Mobile · Automation" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-12 px-6 py-16 sm:py-24 lg:flex-row lg:items-center lg:justify-center lg:gap-20">
        <div className="flex-1 lg:self-center">
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium text-accent">
            Bloom Studio
          </span>
          <h1 className="text-balance mt-6 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            Tell us what you&apos;re&nbsp;building
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-gray-600">
            Share a few details about your project and we&apos;ll get back
            to you within a day.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            {trustItems.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-sm text-gray-500">
                <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full lg:max-w-md">
          <LeadForm />
        </div>
      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Bloom Studio. All rights reserved.
      </footer>
    </main>
  );
}
