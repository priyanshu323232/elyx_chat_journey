export type ChatRow = {
  msg_id: string;           // generated
  timestamp: string;        // ISO
  sender: string;
  message: string;
};

export type JourneyOutput = {
  conversations: { id: string; ts: string; sender: string; text: string; tags: string[] }[];
  journey_timeline: { date: string; event: string; why_trace: string[]; owner?: string; pillar?: string; kpis?: Record<string, any> }[];
  point_in_time: { as_of: string; snapshot: { plan: any; status: any; open_questions: string[]; assumptions?: string[] } };
  rationale_graph: { decision: string; date: string; evidence: string[]; expected_outcome?: string; review_date?: string; result?: string }[];
  ops_metrics: { touchpoints_per_week: number; by_role_hours: Record<string, number>; diagnostics_completed: string[] };
  weekly_summary: { period: string; exec_brief: string; wins: string[]; risks: string[]; next_actions: { owner: string; due: string; action: string }[]; kpis?: Record<string, any> };
};