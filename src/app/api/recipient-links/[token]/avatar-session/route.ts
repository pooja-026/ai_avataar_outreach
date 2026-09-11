import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const ANAM_SESSION_TOKEN_URL = "https://api.anam.ai/v1/auth/session-token";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const apiKey = process.env.ANAM_API_KEY;
  const personaId = process.env.ANAM_PERSONA_ID;

  if (!apiKey || !personaId) {
    return NextResponse.json({ error: "Avatar service is not configured." }, { status: 503 });
  }

  const link = await getDb().recipientLink.findUnique({ where: { token } });
  if (!link || link.status !== "ACTIVE" || (link.expiresAt && link.expiresAt <= new Date())) {
    return NextResponse.json({ error: "Invitation unavailable." }, { status: 404 });
  }

  try {
    const response = await fetch(ANAM_SESSION_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ personaConfig: { personaId } }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Anam session-token request failed", { status: response.status });
      return NextResponse.json({ error: "Unable to prepare the avatar session." }, { status: 502 });
    }

    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("sessionToken" in body) || typeof body.sessionToken !== "string") {
      return NextResponse.json({ error: "Avatar service returned an invalid response." }, { status: 502 });
    }

    const session = await getDb().avatarSession.create({
      data: {
        campaignRecipientId: link.campaignRecipientId,
        recipientLinkId: link.id,
        status: "CREATED",
      },
    });

    return NextResponse.json({ sessionId: session.id, sessionToken: body.sessionToken }, { status: 201 });
  } catch (error) {
    console.error("Anam session-token network error", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Unable to prepare the avatar session." }, { status: 502 });
  }
}
