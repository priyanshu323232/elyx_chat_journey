// lib/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_ORDER = [
  process.env.GEMINI_MODEL_PRIMARY || "gemini-1.5-pro",
  "gemini-1.5-flash-002",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

export async function generateWithFallback(opts: {
  apiKey: string;
  prompt: string;
}) {
  const { apiKey, prompt } = opts;
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastErr: any;
  for (const modelName of MODEL_ORDER) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      return { text, modelUsed: modelName };
    } catch (e: any) {
      const msg = String(e?.message || "");
      const is429 =
        e?.status === 429 || /quota|too many requests|rate[- ]?limit/i.test(msg);

      if (!is429) throw e; // different error – bubble up

      lastErr = e;
      // optional tiny wait if Google suggests one (e.g. "retryDelay":"4s")
      const m = msg.match(/"retryDelay":"(\d+)s"/);
      const ms = m ? Number(m[1]) * 1000 : 0;
      if (ms) await new Promise((r) => setTimeout(r, ms));
      // then try the next (cheaper) model
    }
  }
  throw lastErr ?? new Error("All Gemini models failed due to quota.");
}

/** Keep message IDs but trim long texts and cap total serialized size. */
export function compactMessages<T extends { message: string }>(
  rows: T[],
  {
    maxPerMessageChars = 800,
    maxSerializedChars = 120_000,
  }: { maxPerMessageChars?: number; maxSerializedChars?: number } = {}
) {
  // hard trim long messages
  const trimmed = rows.map((r) => ({
    ...r,
    message: r.message?.slice(0, maxPerMessageChars) ?? "",
  }));

  // if still huge, progressively drop oldest 10% until it fits
  let working = [...trimmed];
  const size = () => JSON.stringify({ messages: working }).length;
  while (size() > maxSerializedChars && working.length > 50) {
    const cut = Math.max(1, Math.ceil(working.length * 0.1));
    working = working.slice(cut); // drop oldest
  }
  return working;
}
