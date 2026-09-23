import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildAvatarContext } from "@/lib/avatar-context";

const ANAM_SESSION_TOKEN_URL = "https://api.anam.ai/v1/auth/session-token";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const apiKey = process.env.ANAM_API_KEY;
  const avatarId = process.env.ANAM_AVATAR_ID;
  const avatarModel = process.env.ANAM_AVATAR_MODEL || "cara-4";
  const voiceId = process.env.ANAM_VOICE_ID;
  const personaName = process.env.ANAM_PERSONA_NAME || "Outreach Assistant";

  if (!apiKey || !avatarId || !voiceId || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Avatar service is not configured." }, { status: 503 });
  }

  const link = await getDb().recipientLink.findUnique({ where: { token }, include: { campaignRecipient: { include: { campaign: true, recipient: true } } } });
  if (!link || link.status !== "ACTIVE") {
    return NextResponse.json({ error: "Invitation unavailable." }, { status: 404 });
  }
  if (link.expiresAt && link.expiresAt <= new Date()) {
    await getDb().recipientLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "This invitation expired after 24 hours." }, { status: 410 });
  }

  const context = buildAvatarContext({
    campaign: link.campaignRecipient.campaign,
    recipient: link.campaignRecipient.recipient,
    campaignRecipient: link.campaignRecipient,
  });

  try {
    const response = await fetch(ANAM_SESSION_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ personaConfig: { name: personaName, avatarId, avatarModel, voiceId, llmId: "CUSTOMER_CLIENT_V1" } }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Anam session-token request failed", { status: response.status });
      return NextResponse.json(
        {
          error: "Unable to prepare the avatar session.",
          ...(process.env.NODE_ENV === "development" ? { providerStatus: response.status } : {}),
        },
        { status: 502 },
      );
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
        contextSnapshot: {
          prompt: context.prompt,
          ragMode: true,
          campaign: { name: link.campaignRecipient.campaign.name, message: link.campaignRecipient.campaign.message, notes: context.campaignNotes },
          recipient: { name: context.recipientName, notes: context.recipientNotes },
          campaignRecipientNotes: context.campaignRecipientNotes,
        },
      },
    });

    return NextResponse.json({ sessionId: session.id, sessionToken: body.sessionToken }, { status: 201 });
  } catch (error) {
    console.error("Anam session-token network error", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Unable to prepare the avatar session." }, { status: 502 });
  }
}
