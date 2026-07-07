import { z } from "zod";

export const budgetOptions = [
  "Not sure yet",
  "Under $1,000",
  "$1,000 – $5,000",
  "$5,000 – $15,000",
  "$15,000+",
] as const;

export const leadFormSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email address."),
  company: z.string().trim().optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a bit more — at least 10 characters."),
  budget: z.enum(budgetOptions, {
    error: "Please select a budget range.",
  }),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
