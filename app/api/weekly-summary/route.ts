import { NextRequest, NextResponse } from "next/server";
import { ChatRow } from "@/lib/types";
import { generateWithFallback, compactMessages } from "@/lib/gemini";

export const runtime = "nodejs";

const ROLE = `Role: Weekly Health Program Summarizer (Chat-Only).

Create: 5-line exec brief; wins & risks (each with msg_id); plan diffs vs last week + owner; next actions (owner,due,why msg_ids); KPI table only if metrics appear in chat; else N/A. Include 5 why-trace bullets. No chain-of-thought. Do not invent data.

Format as markdown with clear sections. Be concise and evidence-based.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const weekRange: [string, string] = body?.weekRange;
    const messages: ChatRow[] = body?.messages ?? [];
    const priorTimeline = body?.priorTimeline ?? [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages[] required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google API key not configured" }, { status: 500 });
    }

    const compact = compactMessages(messages);
    const input = { week_range: weekRange, messages: compact, prior_timeline: priorTimeline };
    const prompt = `${ROLE}\n\nInputs JSON:\n${JSON.stringify(input)}`;

    const { text, modelUsed } = await generateWithFallback({ apiKey, prompt });

    return NextResponse.json({ text }, { status: 200, headers: { "x-gemini-model": modelUsed } });
  } catch (e: any) {
    console.error("Weekly summary API error:", e);
    return NextResponse.json({ error: e.message || "Unknown error occurred" }, { status: 500 });
  }
}
