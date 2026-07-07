import { NextRequest, NextResponse } from "next/server";
import { leadFormSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = leadFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  console.log("[api/lead] received payload:", parsed.data);

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookUrl) {
    console.warn("[api/lead] N8N_WEBHOOK_URL not set — skipping forward to n8n");
    return NextResponse.json({ ok: true, forwarded: false });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { "x-webhook-secret": webhookSecret } : {}),
      },
      body: JSON.stringify(parsed.data),
    });

    if (!res.ok) {
      console.error("[api/lead] n8n webhook responded with", res.status);
      return NextResponse.json({ error: "Downstream error" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, forwarded: true });
  } catch (err) {
    console.error("[api/lead] failed to reach n8n webhook:", err);
    return NextResponse.json({ error: "Downstream error" }, { status: 502 });
  }
}
