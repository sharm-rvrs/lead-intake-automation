# Architecture

Two n8n workflows run this system: **Lead Intake**, triggered by a webhook the instant a lead comes in, and **Follow-Up Check**, triggered on a daily schedule to catch leads who've gone quiet. This document walks through both, node by node, with the reasoning behind each step.

## A pattern used throughout: cross-node data references

Several nodes in both workflows call an external API (Airtable, Groq) and the response becomes the new `$json` for everything downstream. That means any node further down the chain that still needs the *original* lead data (the visitor's name, email, message) can't just read `$json`, it has to reach back to a specific earlier node by name, for example `$('Validate & Normalize').item.json.email`. This came up repeatedly while building the workflows: a node several steps past an HTTP call would silently receive `undefined` for a field that used to be there, because the HTTP response had replaced it. Every node in both workflows that needs upstream lead data references it explicitly by node name rather than assuming it survived the trip.

## Workflow 1: Lead Intake

Triggered by `POST /webhook/lead-intake`.

**Lead Webhook.** Receives the POST and responds `200` immediately (`responseMode: onReceived`), before any validation or processing happens. This matters for two reasons: the visitor doesn't wait on Groq or Airtable round-trips to get their success state, and it means a failed secret check or malformed payload never leaks any signal back to whoever sent the request, since the response is identical either way. Anything that goes wrong happens after the response and shows up in the execution log for review.

**Validate & Normalize** (Code node). Checks the `x-webhook-secret` header against `$env.WEBHOOK_SECRET` and throws if it doesn't match, which stops the execution right here. If it matches, trims every field and lowercases the email, so the rest of the workflow, and Airtable, always sees a consistent, normalized shape regardless of what the client sent.

**Valid Email Format?** (IF node). A regex check on the normalized email. The invalid branch goes to **Notify Discord: Malformed Lead**, an embed posted to the general alerts webhook, since this is a defense-in-depth check against direct webhook calls that skip the frontend's own Zod validation, not something a normal form submission should ever trigger.

**Search Lead by Email** (HTTP Request). A GET against Airtable's REST API with `filterByFormula: {Email} = "<email>"`, using a plain HTTP Request node rather than n8n's native Airtable node so the exact request shape stays visible and portable rather than depending on a specific node build.

**Lead Exists?** (IF node), branching on `records.length > 0`:
- **True** → **Prepare Duplicate Update** (Code node) reads the existing record's Message field and appends a timestamped `[Follow-up inquiry ...]` note with the new message, then **Update Existing Lead** (HTTP PATCH) writes it back. The execution ends here: no duplicate record, no second reply email, no second Discord notification.
- **False** → continues to classification.

**Build Groq Prompt** (Code node). Assembles the system prompt (classification rules, reply-drafting rules covering length, tone, paragraph formatting, and a strict no-fabrication rule) and a user prompt built from the lead's fields.

**Groq Classify & Draft Reply** (HTTP Request). Calls Groq's OpenAI-compatible chat completions endpoint with `response_format: json_object`, asking for `{ category, confidence, reply_subject, reply_body }` in one call, so classification and reply drafting happen together rather than as two separate AI calls.

**Parse Groq Response** (Code node). LLM output is never guaranteed to be clean JSON on every call, so this strips common markdown code-fence wrapping, attempts `JSON.parse` in a try/catch, and falls back to `category: "unclassified"` with safe empty defaults if anything goes wrong. This guarantees the lead still gets saved to Airtable even if the AI step misbehaves, rather than the whole execution failing and the inquiry disappearing. The category is also normalized into a Title Case `categoryLabel` here, since Airtable's Category field uses Title Case options and the classifier naturally returns lowercase.

**Spam & High Confidence?** (IF node): `category == "spam" AND confidence > 0.8`.
- **True** → **Create Airtable Record (Spam - Closed)** saves the lead with `Status: Closed` and the AI draft for reference (even though it's never sent), then **Notify Discord: Spam Lead Closed** posts an alert. No reply email goes out.
- **False** → **Create Airtable Record (Awaiting Reply)** saves the lead with `Status: Awaiting Reply` and `Last Contacted` set to now, then **Send Reply Email** (Gmail node, OAuth2 credential) sends the drafted reply, then **Notify Discord: New Lead** posts a green embed to `#leads` with the name, email, category, confidence, and budget.

Both Discord notification nodes have `continueOnFail: true`: a Discord outage or bad webhook URL shouldn't fail the whole lead-processing execution after the record's already been saved and the email's already been sent.

## Workflow 2: Follow-Up Check

Triggered daily at 9:00 AM Asia/Manila (set at the workflow level via `settings.timezone`, not relying on the n8n instance's global timezone).

**List Awaiting Replies** (HTTP Request). Airtable search with `filterByFormula: AND({Status} = "Awaiting Reply", DATETIME_DIFF(NOW(), {Last Contacted}, "days") >= 3)`. This single query is the entire idempotency mechanism: once a record's `Status` changes to `Follow-up Sent`, it no longer matches this filter and will never be picked up by a future run. There's no separate "already followed up" flag to maintain.

**Extract Records** (Code node). Airtable's response is one item containing a `records` array; this flattens it into one n8n item per lead record, so the loop below processes them individually.

**Loop Over Items** (Split In Batches, batch size 1). n8n's standard loop pattern: the `loop` output feeds into the per-item chain below, which feeds back into this same node's input to pull the next batch, and the `done` output fires once every item has been processed, reaching **Follow-ups Complete** (a no-op marker).

Per item:

**Build Follow-up Prompt** (Code node). A separate, shorter system prompt from the main reply, tuned for a brief check-in (40 to 80 words) rather than a full response: reference the original inquiry, one gentle question or next step, and the same no-fabrication and paragraph-formatting rules as the main workflow.

**Groq Draft Follow-up** (HTTP Request). Same pattern as the main workflow, but the response schema is just `{ reply_subject, reply_body }`, since there's no re-classification needed for a follow-up.

**Parse Follow-up Response** (Code node). Same safe-parsing approach as the main workflow, but if parsing fails here the fallback is a complete, ready-to-send generic check-in message rather than an empty default, since there's no branching logic downstream to catch an empty body the way the spam gate does in the main workflow.

**Send Follow-up Email** (Gmail node). Sends the follow-up using the same OAuth2 credential as the main workflow.

**Update Airtable Record** (HTTP PATCH). Sets `Status: Follow-up Sent` and refreshes `Last Contacted` to now, then loops back into **Loop Over Items** for the next record.
