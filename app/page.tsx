"use client";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { format } from "date-fns";
import { ChatRow, JourneyOutput } from "@/lib/types";
import { generateMsgIds } from "@/lib/utils";

type RawRow = { timestamp: string; sender: string; message: string };

export default function Home() {
  const [raw, setRaw] = useState<RawRow[]>([]);
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [journey, setJourney] = useState<JourneyOutput | null>(null);
  const [weeklyText, setWeeklyText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  function handleFile(file?: File | null) {
    if (!file) return;
    setError("");
    
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const data = res.data.map(r => ({
            timestamp: new Date(r.timestamp).toISOString(),
            sender: String(r.sender ?? "").trim(),
            message: String(r.message ?? "").trim(),
          })).filter(r => r.timestamp && r.sender && r.message);
          
          setRaw(data);
          const msgIds = generateMsgIds(data);
          const withIds: ChatRow[] = data.map((r, i) => ({ msg_id: msgIds[i], ...r }));
          setRows(withIds);
          
          if (withIds.length) {
            setFrom(withIds[0].timestamp.slice(0,10));
            setTo(withIds[withIds.length-1].timestamp.slice(0,10));
          }
        } catch (err) {
          setError("Error parsing CSV data. Please check your file format.");
          console.error(err);
        }
      },
      error: (err) => {
        setError(`CSV parsing error: ${err.message}`);
      },
    });
  }

  const filtered = useMemo(() => {
    if (!from || !to) return rows;
    return rows.filter(r => r.timestamp.slice(0,10) >= from && r.timestamp.slice(0,10) <= to);
  }, [rows, from, to]);

  async function buildJourney() {
    if (filtered.length === 0) {
      setError("No messages to process. Please upload a CSV file.");
      return;
    }

    setJourney(null);
    setWeeklyText("");
    setIsLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: filtered, 
          memberName: "Member", 
          timezone: "Asia/Singapore" 
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) { 
        setError(data.error ?? "Failed to generate journey");
        return; 
      }
      
      setJourney(data as JourneyOutput);
    } catch (err) {
      setError("Network error. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function buildWeekly() {
    if (filtered.length === 0) {
      setError("No messages to process. Please upload a CSV file.");
      return;
    }

    setIsLoading(true);
    setError("");
    
    const weekStart = from || (rows[0]?.timestamp.slice(0,10) ?? "");
    const weekEnd = to || (rows.at(-1)?.timestamp.slice(0,10) ?? "");
    
    try {
      const res = await fetch("/api/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          weekRange: [weekStart, weekEnd], 
          messages: filtered, 
          priorTimeline: journey?.journey_timeline ?? [] 
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) { 
        setError(data.error ?? "Failed to generate weekly summary");
        return; 
      }
      
      setWeeklyText(data.text ?? "");
    } catch (err) {
      setError("Network error. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Elyx Chat Journey</h1>
        <p className="text-gray-600">
          Upload a CSV with columns: <code className="bg-gray-100 px-2 py-1 rounded text-sm">timestamp,sender,message</code>. 
          Generate the 8-month journey and weekly summary using Gemini AI.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3 items-start mb-6">
        <div className="p-6 rounded-lg border bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Upload & Configure</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-gray-700">CSV File</label>
            <input 
              type="file" 
              accept=".csv" 
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">From Date</label>
              <input 
                className="border border-gray-300 rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                type="date" 
                value={from} 
                onChange={e=>setFrom(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">To Date</label>
              <input 
                className="border border-gray-300 rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                type="date" 
                value={to} 
                onChange={e=>setTo(e.target.value)} 
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={buildJourney} 
              disabled={isLoading || filtered.length === 0}
              className="w-full rounded-md bg-black text-white px-4 py-2 font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Processing..." : "🚀 Generate Journey"}
            </button>
            <button 
              onClick={buildWeekly}
              disabled={isLoading || filtered.length === 0}
              className="w-full rounded-md bg-gray-900 text-white px-4 py-2 font-medium hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Processing..." : "🧠 Weekly Summary"}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 p-6 rounded-lg border bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            Preview ({filtered.length} messages)
          </h2>
          <div className="overflow-auto max-h-80 border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700">msg_id</th>
                  <th className="text-left p-3 font-medium text-gray-700">timestamp</th>
                  <th className="text-left p-3 font-medium text-gray-700">sender</th>
                  <th className="text-left p-3 font-medium text-gray-700">message</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0,200).map(r=>(
                  <tr key={r.msg_id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs">{r.msg_id}</td>
                    <td className="p-3 text-xs">{format(new Date(r.timestamp), "yyyy-MM-dd HH:mm")}</td>
                    <td className="p-3 font-medium">{r.sender}</td>
                    <td className="p-3">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No messages to display. Upload a CSV file to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {journey && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Journey Analysis Results</h2>
          
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="p-6 rounded-lg border bg-white shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Conversations (first 50)</h3>
              <pre className="text-xs overflow-auto max-h-96 bg-gray-50 p-4 rounded border">
                {JSON.stringify(journey.conversations?.slice(0,50) ?? [], null, 2)}
              </pre>
            </div>
            
            <div className="p-6 rounded-lg border bg-white shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Journey Timeline</h3>
              <pre className="text-xs overflow-auto max-h-96 bg-gray-50 p-4 rounded border">
                {JSON.stringify(journey.journey_timeline ?? [], null, 2)}
              </pre>
            </div>
            
            <div className="p-6 rounded-lg border bg-white shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Point-in-time</h3>
              <pre className="text-xs overflow-auto max-h-96 bg-gray-50 p-4 rounded border">
                {JSON.stringify(journey.point_in_time ?? {}, null, 2)}
              </pre>
            </div>
            
            <div className="p-6 rounded-lg border bg-white shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Rationale Graph / Ops Metrics</h3>
              <pre className="text-xs overflow-auto max-h-96 bg-gray-50 p-4 rounded border">
                {JSON.stringify({ 
                  rationale_graph: journey.rationale_graph, 
                  ops_metrics: journey.ops_metrics 
                }, null, 2)}
              </pre>
            </div>
          </div>
          
          <div className="p-6 rounded-lg border bg-white shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Weekly Summary</h3>
            <div className="prose max-w-none">
              <div className="bg-gray-50 p-4 rounded border whitespace-pre-wrap text-sm">
                {weeklyText || journey.weekly_summary?.exec_brief || "—"}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}