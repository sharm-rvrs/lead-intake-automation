"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { budgetOptions, leadFormSchema } from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

type FieldErrors = Partial<Record<"name" | "email" | "company" | "message" | "budget", string>>;

const inputClasses =
  "mt-1 block h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

export default function LeadForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const values = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      company: String(formData.get("company") ?? ""),
      message: String(formData.get("message") ?? ""),
      budget: String(formData.get("budget") ?? ""),
    };

    const parsed = leadFormSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setFormError("Something went wrong on our end. Please try again in a moment.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-lg font-semibold text-gray-900">
          Thanks for reaching out!
        </p>
        <p className="mt-2 text-sm text-gray-600">
          We&apos;ve got your message and will get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 rounded-xl border border-gray-200 bg-white p-8"
    >
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className={inputClasses}
          placeholder="Jane Doe"
        />
        {errors.name && <p className="mt-1 text-sm text-rose-600">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className={inputClasses}
          placeholder="jane@example.com"
        />
        {errors.email && <p className="mt-1 text-sm text-rose-600">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="company" className="block text-sm font-medium text-gray-700">
          Company <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="company"
          name="company"
          type="text"
          className={inputClasses}
          placeholder="Acme Co."
        />
        {errors.company && <p className="mt-1 text-sm text-rose-600">{errors.company}</p>}
      </div>

      <div>
        <label htmlFor="budget" className="block text-sm font-medium text-gray-700">
          Project budget
        </label>
        <div className="relative">
          <select
            id="budget"
            name="budget"
            defaultValue=""
            className={`${inputClasses} appearance-none pr-10`}
          >
            <option value="" disabled>
              Select a range
            </option>
            {budgetOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        {errors.budget && <p className="mt-1 text-sm text-rose-600">{errors.budget}</p>}
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700">
          Your project
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          placeholder="What are you hoping to build or improve?"
        />
        {errors.message && <p className="mt-1 text-sm text-rose-600">{errors.message}</p>}
      </div>

      {formError && <p className="text-sm text-rose-600">{formError}</p>}

      <div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-accent-dark disabled:opacity-60"
        >
          {status === "submitting" ? "Sending..." : "Send message"}
        </button>
        <p className="mt-3 text-center text-xs text-gray-400">
          We&apos;ll only use this to reply to you.
        </p>
      </div>
    </form>
  );
}
