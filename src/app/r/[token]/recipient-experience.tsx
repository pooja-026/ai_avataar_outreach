"use client";

import { AnamEvent, createClient } from "@anam-ai/js-sdk";
import { useRef, useState } from "react";

type Props = { firstName: string | null; campaignName: string; message: string; token: string };
type State = "welcome" | "connecting" | "live" | "error";

export function RecipientExperience({ firstName, campaignName, message, token }: Props) {
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<State>("welcome");
  const [error, setError] = useState("");
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const audioRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const providerSessionIdRef = useRef<string | null>(null);
  const messageHistoryRef = useRef<Array<{ role: string; content: string }>>([]);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizedRef = useRef(false);
  const lastProcessedUserMessageIdRef = useRef<string | null>(null);
  const greeting = firstName ? `Welcome, ${firstName}` : "Welcome";

  async function saveConversation(ended = false) {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !messageHistoryRef.current.length) return;

    await fetch(`/api/recipient-links/${encodeURIComponent(token)}/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messageHistoryRef.current, ended, providerSessionId: providerSessionIdRef.current }),
    });
  }

  function scheduleConversationSave() {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => { void saveConversation(); }, 600);
  }

  function isLikelyInformationRequest(messages: Array<{ role: string; content: string }>) {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content.toLowerCase().trim() || "";
    return latestUserMessage.includes("?") || /^(what|when|where|why|how|which|who|can|could|do|does|is|are|tell me|i want to know)\b/.test(latestUserMessage);
  }

  async function answerWithCampaignKnowledge(messages: Array<{ id: string; role: string; content: string }>) {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!latestUserMessage || latestUserMessage.id === lastProcessedUserMessageIdRef.current || !clientRef.current) return;
    lastProcessedUserMessageIdRef.current = latestUserMessage.id;
    const requestStartedAt = performance.now();
    const talkStream = clientRef.current.createTalkMessageStream();
    let fillerSpoken = false;
    let answerUtteranceStarted = false;
    let speechQueue = Promise.resolve();
    const queueSpeech = (text: string, utteranceId?: string) => {
      speechQueue = speechQueue.then(() => talkStream.streamMessageChunk(text, false, utteranceId));
      return speechQueue;
    };
    const fillerTimer = isLikelyInformationRequest(messages) ? setTimeout(() => {
      if (fillerSpoken) return;
      fillerSpoken = true;
      void queueSpeech("Let me look into that for you.", crypto.randomUUID());
    }, 600) : null;
    try {
      const response = await fetch(`/api/recipient-links/${encodeURIComponent(token)}/sessions/${encodeURIComponent(sessionIdRef.current || "")}/rag-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages.map((message) => ({ role: message.role, content: message.content })) }),
      });
      if (!response.ok || !response.body) throw new Error("Unable to generate a grounded response.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pendingText = "";
      let receivedText = "";
      let firstResponseChunkAt: number | null = null;
      let firstSpeechChunkAt: number | null = null;

      const flushSpeakableText = async (final = false) => {
        while (pendingText) {
          const sentenceEnd = pendingText.search(/[.!?](?=\s|$)/);
          const longPhraseEnd = pendingText.length >= 150 ? pendingText.lastIndexOf(" ", 150) : -1;
          const end = sentenceEnd >= 0 ? sentenceEnd + 1 : longPhraseEnd > 40 ? longPhraseEnd : final ? pendingText.length : 0;
          if (!end) return;
          const speech = pendingText.slice(0, end).trim();
          pendingText = pendingText.slice(end).trimStart();
          if (!speech) continue;
          if (firstSpeechChunkAt === null) firstSpeechChunkAt = performance.now();
          await queueSpeech(speech, fillerSpoken && !answerUtteranceStarted ? crypto.randomUUID() : undefined);
          answerUtteranceStarted = true;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (!text) continue;
        if (firstResponseChunkAt === null) firstResponseChunkAt = performance.now();
        receivedText += text;
        pendingText += text;
        await flushSpeakableText();
      }
      pendingText += decoder.decode();
      await flushSpeakableText(true);
      if (!receivedText.trim()) throw new Error("Unable to generate a grounded response.");
      await speechQueue;
      await talkStream.endMessage();
      console.info("avatar_turn_latency", {
        responseFirstChunkMs: firstResponseChunkAt === null ? null : Math.round(firstResponseChunkAt - requestStartedAt),
        avatarFirstSpeechQueuedMs: firstSpeechChunkAt === null ? null : Math.round(firstSpeechChunkAt - requestStartedAt),
        totalResponseMs: Math.round(performance.now() - requestStartedAt),
        serverTiming: response.headers.get("Server-Timing"),
      });
    } finally {
      if (fillerTimer) clearTimeout(fillerTimer);
    }
  }

  async function startConversation() {
    setState("connecting"); setError("");
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRef.current = audio;
      const response = await fetch(`/api/recipient-links/${encodeURIComponent(token)}/avatar-session`, { method: "POST" });
      const body: unknown = await response.json();
      if (!response.ok || !body || typeof body !== "object" || !("sessionToken" in body) || typeof body.sessionToken !== "string") throw new Error("Unable to create your private avatar session.");
      if (!("sessionId" in body) || typeof body.sessionId !== "string") throw new Error("Unable to create your private avatar session.");
      sessionIdRef.current = body.sessionId;
      providerSessionIdRef.current = null;
      messageHistoryRef.current = [];
      lastProcessedUserMessageIdRef.current = null;
      finalizedRef.current = false;
      const client = createClient(body.sessionToken);
      clientRef.current = client;
      client.addListener(AnamEvent.SESSION_READY, (providerSessionId: string) => { providerSessionIdRef.current = providerSessionId; });
      client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, (messages) => {
        messageHistoryRef.current = messages.map((message) => ({ role: message.role, content: message.content })).filter((message) => (message.role === "user" || message.role === "persona") && Boolean(message.content?.trim()));
        scheduleConversationSave();
        void answerWithCampaignKnowledge(messages).catch(() => setError("We could not prepare a grounded answer. Please try again."));
      });
      client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
        if (!finalizedRef.current) {
          finalizedRef.current = true;
          void saveConversation(true);
        }
      });
      await client.streamToVideoElement("anam-avatar-video", audio);
      setState("live");
    } catch (cause) {
      audioRef.current?.getTracks().forEach((track) => track.stop()); audioRef.current = null;
      setError(cause instanceof Error && cause.name === "NotAllowedError" ? "Microphone access is needed to speak with the avatar. Please allow it and try again." : "We could not connect the avatar right now. Please try again.");
      setState("error");
    }
  }

  async function stopConversation() {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    finalizedRef.current = true;
    await saveConversation(true);
    await clientRef.current?.stopStreaming(); clientRef.current = null;
    audioRef.current?.getTracks().forEach((track) => track.stop()); audioRef.current = null;
    sessionIdRef.current = null;
    setState("welcome");
  }

  return <main className="min-h-screen overflow-hidden bg-[#07111f] text-white"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,238,.16),transparent_30%),radial-gradient(circle_at_85%_75%,rgba(99,102,241,.18),transparent_33%)]" /><div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-5 py-8 sm:px-8"><section className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[.045] shadow-2xl shadow-black/30 lg:grid-cols-[1.15fr_.85fr]"><div className="flex min-h-[540px] flex-col p-7 sm:p-10"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white text-sm font-bold text-slate-950">A</div><div><p className="text-sm font-semibold">Avataar Outreach</p><p className="text-xs text-slate-400">Private conversation space</p></div></div><div className="mt-auto max-w-xl"><p className="text-xs font-semibold tracking-[.16em] text-cyan-300 uppercase">A personal invitation</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{greeting}.</h1><p className="mt-5 text-lg leading-8 text-slate-300">You&apos;re invited to a private conversation about <span className="font-semibold text-white">{campaignName}</span>.</p><div className="mt-7 rounded-2xl border border-white/10 bg-black/15 p-5"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{message}</p></div></div><p className="mt-8 text-xs leading-5 text-slate-500">This invitation is personalized for you. Please do not forward this link.</p></div><div className="border-t border-white/10 bg-slate-950/40 p-7 sm:p-10 lg:border-t-0 lg:border-l"><div className="mx-auto flex max-w-sm flex-col items-center text-center"><div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900"><video autoPlay className={`size-full object-cover ${state === "live" ? "block" : "hidden"}`} id="anam-avatar-video" playsInline /><div className={`${state === "live" ? "hidden" : "grid"} size-full place-items-center bg-gradient-to-br from-cyan-200 via-indigo-300 to-violet-400`}><div className="grid size-36 place-items-center rounded-full border border-white/40 bg-slate-950/20 text-5xl">◌</div></div><span className="absolute right-4 bottom-4 size-3 rounded-full bg-emerald-400 ring-4 ring-slate-900" /></div><p className="mt-7 text-sm font-semibold text-cyan-200">Conversation concierge</p><h2 className="mt-3 text-2xl font-semibold">A focused space, just for you.</h2>{state === "live" ? <div className="mt-7 w-full"><p className="text-sm text-slate-300">Connected. You can begin speaking whenever you&apos;re ready.</p><button className="mt-4 w-full rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold" onClick={stopConversation} type="button">End conversation</button></div> : <div className="mt-7 w-full text-left">{state === "welcome" && <label className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm leading-5 text-slate-300"><input checked={consented} className="mt-0.5 size-4 accent-cyan-400" onChange={(event) => setConsented(event.target.checked)} type="checkbox" /><span>I understand this is a private, AI-assisted conversation experience.</span></label>}{state === "error" && <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">{error}</p>}<button className="mt-4 w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40" disabled={state === "connecting" || (state === "welcome" && !consented)} onClick={startConversation} type="button">{state === "connecting" ? "Connecting securely…" : state === "error" ? "Try again" : "Start conversation"}</button><p className="mt-3 text-center text-xs text-slate-500">Microphone access is requested only when you start.</p></div>}</div></div></section></div></main>;
}
