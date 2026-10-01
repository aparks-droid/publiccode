import demo from "../../../demo/driftwood-coffee.json";
export function demoSnapshot() {
  const sources = demo.sources.map((s) => ({
    id: `demo-${s.kind}`,
    name: s.name,
    kind: s.kind,
    mode: "sample",
    status: "connected",
    last_sync: "2026-10-01T00:00:00Z",
  }));
  return {
    demo: true,
    configured: false,
    workspace: "demo",
    company: demo.company,
    sources,
    records: demo.sources.flatMap((s) =>
      s.records.map((r) => ({
        ...r,
        id: `demo-${s.kind}-${r.external_id}`,
        source_id: `demo-${s.kind}`,
        updated_at: "2026-10-01T00:00:00Z",
      })),
    ),
    issues: demo.issues.map((i, n) => ({
      ...i,
      id: `demo-issue-${n}`,
      origin: "sample",
      model: "",
      resolved: false,
      created_at: "2026-10-01T00:00:00Z",
    })),
    messages: [],
    tokens: {},
    ai: null,
    monitoring: { enabled: false, minutes: 60, instructions: "" },
  };
}
