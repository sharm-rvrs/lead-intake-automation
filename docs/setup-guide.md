# Setup Guide

This is a complete walkthrough for reproducing this project from zero: every account you need, every credential, every environment variable, and every import step, for both a local development environment and a production deployment.

## 1. Accounts you'll need

Create these before starting:

- **GitHub** - to host the repository
- **Groq** ([console.groq.com](https://console.groq.com)) - free API key for AI classification and reply drafting
- **Airtable** ([airtable.com](https://airtable.com)) - free account for the CRM base
- **Discord** - a server where you can create two incoming webhooks
- **Google Cloud** ([console.cloud.google.com](https://console.cloud.google.com)) - for a Gmail OAuth2 client
- **Railway** ([railway.app](https://railway.app)) - to self-host n8n in production
- **Vercel** ([vercel.com](https://vercel.com)) - to deploy the landing page

## 2. Airtable base

Create a base named **Bloom Studio CRM** with a single table named **Leads** and these fields:

| Field | Type | Notes |
|---|---|---|
| Name | Single line text | |
| Email | Single line text | |
| Company | Single line text | |
| Message | Long text | |
| Category | Single select | Options: `Sales`, `Support`, `Partnership`, `Spam` (Title Case, exactly) |
| Status | Single select | Options: `New`, `Awaiting Reply`, `Replied`, `Follow-up Sent`, `Closed` (Title Case, exactly) |
| AI Draft | Long text | Stores the AI-drafted subject and body for reference |
| Created At | Created time | Auto-populated by Airtable, do not set manually |
| Last Contacted | Date | Include a time component |

The select option casing matters: the workflows write values like `Spam` and `Awaiting Reply`, and the Airtable API will reject a value that doesn't exactly match an existing option (and your API token likely won't have permission to silently create a new one).

Once created, open the base in your browser and copy the base ID from the URL (`airtable.com/appXXXXXXXXXXXXXX/...`) and the table ID from the API docs panel (`Help → API documentation`, or from a request URL, it looks like `tblXXXXXXXXXXXXXX`). You'll need both in step 6.

Generate a **Personal Access Token** (Airtable account settings → Developer Hub → Personal access tokens) scoped to this base, with `data.records:read` and `data.records:write`. You do not need `schema.bases:write` since the workflows never create new fields or select options, only records.

## 3. Groq API key

Create an API key at [console.groq.com](https://console.groq.com/keys). The workflows use the `llama-3.3-70b-versatile` model via the OpenAI-compatible chat completions endpoint.

## 4. Discord webhooks

Create two incoming webhooks (Server Settings → Integrations → Webhooks), one per channel:

- A general alerts webhook, used for malformed-lead and spam-closed notifications
- A `#leads` channel webhook, used for the new-lead notification

Copy both webhook URLs.

## 5. Google Cloud OAuth client (for Gmail)

1. In Google Cloud Console, create a project and enable the **Gmail API**.
2. Configure the OAuth consent screen (internal or external, with the `gmail.send` scope).
3. Create an OAuth client of type **Web application**.
4. Add an authorized redirect URI for every environment that will need to sign in:
   - Local: `http://localhost:5678/rest/oauth2-credential/callback`
   - Production: `https://<your-railway-domain>/rest/oauth2-credential/callback`

You don't create the actual n8n credential yet, that happens after n8n is running (step 7 and step 9). Credentials are never stored in the workflow JSON exports, only a dangling reference to them, so this step has to be repeated for every environment.

## 6. Local n8n

1. Clone the repo and `cd n8n/`.
2. Copy `.env.example` to `.env` and fill in:
   - `WEBHOOK_SECRET` - any strong random string; this is the shared secret between the landing page and n8n
   - `GROQ_API_KEY`
   - `DISCORD_WEBHOOK_URL` (general alerts webhook)
   - `DISCORD_LEADS_WEBHOOK_URL` (`#leads` webhook)
   - `AIRTABLE_PAT`
3. Run `docker compose up -d`. This starts n8n at `http://localhost:5678`.
4. Open the editor and create the owner account (n8n no longer supports the old `N8N_BASIC_AUTH_ACTIVE` env-based auth; this first-run screen is how login works now).
5. **Import both workflows**: Workflows → Import from File → select `n8n/workflows/lead-intake.json`, repeat for `follow-up.json`.
6. **Point the Airtable nodes at your base.** The exported workflows hardcode the base ID and table ID from this project's own Airtable base directly in each HTTP Request node's URL. Open every Airtable-calling node and replace `app2ldUhplS9k34QZ`/`tbl21HHue6IsXwNZR` with your own base ID and table ID from step 2:
   - In **Lead Intake**: `Search Lead by Email`, `Create Airtable Record (Spam - Closed)`, `Create Airtable Record (Awaiting Reply)`, `Update Existing Lead`
   - In **Follow-Up Check**: `List Awaiting Replies`, `Update Airtable Record`
7. **Create the Gmail credential**: Credentials → Add Credential → Gmail OAuth2 API, sign in with the account that should send replies.
8. Open the **Send Reply Email** node (Lead Intake) and the **Send Follow-up Email** node (Follow-Up Check), and select the credential you just created on both.
9. Toggle both workflows **Active**.

## 7. Local landing page

1. `cd landing-page/`
2. Copy `.env.example` to `.env.local` and set:
   - `N8N_WEBHOOK_URL=http://localhost:5678/webhook/lead-intake`
   - `WEBHOOK_SECRET` - must match the value from step 6
3. `npm install`
4. `npm run dev`, then open `http://localhost:3000`

At this point you have a fully working local loop: submit the form, watch the execution in n8n, see the record land in Airtable, get the reply email.

## 8. Production: n8n on Railway

1. Create a new Railway project from the `n8nio/n8n` Docker image.
2. Attach a persistent volume mounted at `/home/node/.n8n`.
3. Set the same environment variables as the local `.env` (step 6), plus:
   - `WEBHOOK_URL` set to your Railway domain, e.g. `https://your-app.up.railway.app/`
   - `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` - without this, every Code and HTTP Request node that reads `$env.*` (the secret, the API keys, the webhook URLs) throws "access to env vars denied," since newer n8n builds block environment access from inside nodes by default
   - `RAILWAY_RUN_AS_ROOT=true` - Railway's container runtime otherwise hits an `EACCES` permissions error writing to the mounted volume
4. Deploy, then open the app's URL and create the owner account.
5. Confirm the Google OAuth client (step 5) has this exact domain's callback URL added.
6. Repeat the import steps from step 6 (import both workflows, point the Airtable nodes at your base if not already done, create a fresh Gmail OAuth2 credential and reassign it on both Gmail nodes since the local credential doesn't exist on this instance, activate both workflows).

## 9. Production: landing page on Vercel

1. Push the repo to GitHub if you haven't already.
2. In Vercel: Add New → Project → import the GitHub repo.
3. Set **Root Directory** to `landing-page` (the Next.js app isn't at the repo root).
4. Add environment variables for the Production environment:
   - `N8N_WEBHOOK_URL` = `https://<your-railway-domain>/webhook/lead-intake`
   - `WEBHOOK_SECRET` = the same value set on Railway in step 8
5. Deploy.

## 10. End-to-end verification checklist

Once both are live:

1. Submit the live form with a real message. Confirm the success state shows in the browser.
2. In n8n, open **Lead Intake → Executions** and confirm a successful execution appears.
3. Check Airtable for the new record: `Status: Awaiting Reply`, `Category` populated, `AI Draft` populated.
4. Confirm the reply email arrived, correctly paragraphed, no attribution footer.
5. Confirm the `#leads` Discord channel got the new-lead embed.
6. Submit an obviously malformed email and confirm the malformed-lead Discord alert fires with no Airtable record created.
7. Submit an obviously spammy message and confirm the record is created with `Status: Closed` and the spam alert fires, with no reply email sent.
8. Resubmit the same email from step 1 and confirm the existing record gets an appended follow-up note instead of a duplicate.
9. Seed an Airtable record with `Status: Awaiting Reply` and `Last Contacted` backdated 3+ days, then manually execute **Follow-Up Check** in n8n rather than waiting for the schedule. Confirm the follow-up email sends and the record updates to `Status: Follow-up Sent`.
