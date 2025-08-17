import { NextRequest, NextResponse } from "next/server";
import { ChatRow, JourneyOutput } from "@/lib/types";
import { generateWithFallback, compactMessages } from "@/lib/gemini";

export const runtime = "nodejs";

const SYSTEM = `You are Elyx Journey Builder (Chat-Only). Input is an array of messages with fields: msg_id, timestamp, sender, message.

Produce ONE JSON object with:
- conversations [{id,ts,sender,text,tags}],
- journey_timeline [{date,event,why_trace,owner,pillar,kpis}],
- point_in_time {as_of,snapshot{plan,status,open_questions,assumptions}},
- rationale_graph [{decision,date,evidence,expected_outcome,review_date,result}],
- ops_metrics {touchpoints_per_week,by_role_hours,diagnostics_completed},
- weekly_summary {period,exec_brief,wins,risks,next_actions[{owner,due,action}],kpis}

Rules: Every decision/plan/test/therapy MUST include a why_trace with exact msg_ids. No chain-of-thought; only short, evidence-linked rationales (≤25 words). If using high-level cadence from the Elyx brief (quarterly diagnostics, ~5 member-initiated chats/week, bi-weekly exercise updates, ~50% adherence, frequent travel, base Singapore), clearly tag items not evidenced in chat as "assumed (brief)". Use ISO timestamps. WhatsApp-like tone.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatRow[] = body?.messages;
    const memberName: string = body?.memberName ?? "Member";
    const timezone: string = body?.timezone ?? "Asia/Singapore";

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages[] required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google API key not configured" }, { status: 500 });
    }

    // Compact to avoid token/PM limits
    const compact = compactMessages(messages);
    const input = { member_name: memberName, timezone, messages: compact };
    const prompt = `${SYSTEM}\n\nInput JSON:\n${JSON.stringify(input)}`;

    // Try pro, fall back to flash automatically on 429/quota
    const { text, modelUsed } = await generateWithFallback({ apiKey, prompt });

    // Parse response (JSON or fenced JSON)
    try {
      const json = JSON.parse(text) as JourneyOutput;
      return NextResponse.json(json, { status: 200, headers: { "x-gemini-model": modelUsed } });
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[1]) as JourneyOutput;
        return NextResponse.json(json, { status: 200, headers: { "x-gemini-model": modelUsed } });
      }
      return NextResponse.json(
        { error: "Model did not return valid JSON", raw: text.slice(0, 1000) + "..." },
        { status: 422, headers: { "x-gemini-model": modelUsed } }
      );
    }
  } catch (e: any) {
    console.error("Journey API error:", e);
    return NextResponse.json({ error: e.message || "Unknown error occurred" }, { status: 500 });
  }
}
