"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Issue, Message, RecordRow, Source } from "@/lib/brain";

export type Provider = "" | "openai" | "anthropic";
export type Connection = "idle" | "checking" | "connected" | "error";
// What the user was doing when they were asked to connect an AI. It resumes once.
type Intent = { type: "ask"; question: string } | { type: "analyze" } | null;
const post = (url: string, body: object) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export function useBrain() {
  const [configured, setConfigured] = useState(false),
    [preview, setPreview] = useState(false),
    [project, setProject] = useState(""),
    [setupError, setSetupError] = useState(""),
    [monitoring, setMonitoring] = useState({
      enabled: false,
      minutes: 60,
      instructions: "",
    }),
    [loaded, setLoaded] = useState(false),
    [company, setCompany] = useState(""),
    [sources, setSources] = useState<Source[]>([]),
    [records, setRecords] = useState<RecordRow[]>([]),
    [issues, setIssues] = useState<Issue[]>([]),
    [messages, setMessages] = useState<Message[]>([]),
    [tokens, setTokens] = useState<Record<string, boolean>>({}),
    [busy, setBusy] = useState(false),
    [asking, setAsking] = useState(false),
    [analyzing, setAnalyzing] = useState(false),
    [failed, setFailed] = useState<{ question: string; error: string } | null>(
      null,
    ),
    [draft, setDraft] = useState(""),
    [page, setPage] = useState("home"),
    [connectOpen, setConnectOpen] = useState(false),
    [provider, setProvider] = useState<Provider>(""),
    [apiKey, setApiKey] = useState(""),
    [model, setModel] = useState(""),
    [connection, setConnection] = useState<Connection>("idle"),
    [connectionError, setConnectionError] = useState(""),
    [answeredBy, setAnsweredBy] = useState("");
  const intent = useRef<Intent>(null);
  // Closing setup invalidates an in-flight check so it cannot submit afterward.
  const connectionAttempt = useRef(0);
  // The workspace id, readable from callbacks created before it loaded.
  const ws = useRef("");
  // Latest connection details, readable from callbacks without re-creating them.
  const choice = useRef({ provider, apiKey, model });
  const conversation = useRef<Message[]>([]);
  useEffect(() => {
    conversation.current = messages;
  }, [messages]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/brain");
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    setConfigured(data.configured);
    setPreview(data.demo);
    setProject(data.project || "");
    ws.current = data.workspace;
    setCompany(data.company);
    setSources(data.sources || []);
    setRecords(data.records || []);
    setIssues(data.issues || []);
    setMessages(data.messages || []);
    setTokens(data.tokens || {});
    setMonitoring(data.monitoring);
    if (data.ai) {
      choice.current = {
        provider: data.ai.provider,
        apiKey: "",
        model: data.ai.model || "",
      };
      setProvider(data.ai.provider);
      setModel(data.ai.model || "");
      setConnection("connected");
    }
    setSetupError("");
  }, []);

  const ask = useCallback(async (question: string) => {
    const text = question.trim();
    if (!text) return;
    setPage("chat");
    setFailed(null);
    setDraft("");
    setAsking(true);
    const mine: Message = { role: "user", content: text };
    setMessages((v) => [...v, mine]);
    try {
      const res = await post("/api/chat", {
        question: text,
        workspace: ws.current,
        history: conversation.current
          .map(({ role, content }) => ({ role, content }))
          .slice(-12),
        ...choice.current,
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setAnsweredBy(data.model || "");
      const answer: Message = {
        role: "assistant",
        content: data.answer,
        citations: data.citations,
      };
      setMessages((v) => [...v, answer]);
      if (ws.current !== "demo") {
        const saved = await post("/api/brain", {
          action: "messages",
          messages: [mine, answer],
        });
        if (!saved.ok)
          toast.error(
            "The answer is here, but this conversation could not be saved.",
          );
      }
    } catch (e) {
      // Take the unanswered question back out so Retry sends it once.
      setMessages((v) => v.filter((x) => x !== mine));
      setFailed({
        question: text,
        error: e instanceof Error ? e.message : "Could not get an answer.",
      });
    } finally {
      setAsking(false);
    }
  }, []);

  const analyze = useCallback(async () => {
    if (ws.current === "demo")
      return void toast.info(
        "Run your own copy to analyze your company. This preview shows sample issues.",
      );
    setAnalyzing(true);
    try {
      const res = await post("/api/analyze", {
        workspace: ws.current,
        ...choice.current,
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setAnsweredBy(data.model || "");
      toast.success(`Analysis done: ${data.found} issues found.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not analyze.");
    } finally {
      setAnalyzing(false);
    }
  }, [refresh]);

  const resume = useCallback(() => {
    const next = intent.current;
    intent.current = null;
    sessionStorage.removeItem("brain-intent");
    if (next?.type === "ask") void ask(next.question);
    if (next?.type === "analyze") void analyze();
  }, [ask, analyze]);

  // Test the chosen AI for real; only a working connection counts as connected.
  const connect = useCallback(
    async (next: Provider, key = "", modelId = choice.current.model) => {
      const attempt = ++connectionAttempt.current;
      setProvider(next);
      setConnection("checking");
      setConnectionError("");
      try {
        const res = await post("/api/ai", {
          action: "test",
          provider: next,
          apiKey: key,
          model: modelId,
        });
        const data = await res.json();
        if (attempt !== connectionAttempt.current) return;
        if (!res.ok) throw Error(data.error);
        choice.current = {
          provider: next,
          apiKey: ws.current === "demo" ? key : "",
          model: data.model || modelId,
        };
        setApiKey(ws.current === "demo" ? key : "");
        setModel(data.model || modelId);
        setAnsweredBy(data.model || "");
        setConnection("connected");
        localStorage.setItem("brain-ai", next);
        setConnectOpen(false);
        resume();
      } catch (e) {
        if (attempt !== connectionAttempt.current) return;
        setConnection("error");
        setConnectionError(
          e instanceof Error ? e.message : "Could not connect.",
        );
      }
    },
    [resume],
  );

  const disconnect = useCallback(async () => {
    if (ws.current !== "demo") {
      const res = await post("/api/ai", { action: "disconnect" });
      if (!res.ok) return void toast.error("Could not disconnect. Try again.");
    }
    connectionAttempt.current += 1;
    localStorage.removeItem("brain-ai");
    choice.current = { ...choice.current, provider: "", apiKey: "" };
    setProvider("");
    setApiKey("");
    setConnection("idle");
    setAnsweredBy("");
  }, []);

  // Run an AI action now, or open setup and run it once the AI is connected.
  const needAi = useCallback(
    (next: Exclude<Intent, null>) => {
      if (connection === "connected") {
        intent.current = next;
        return resume();
      }
      intent.current = next;
      setConnectOpen(true);
    },
    [connection, resume],
  );
  const openConnect = useCallback(() => {
    intent.current = null;
    sessionStorage.removeItem("brain-intent");
    setConnectionError("");
    setConnection((c) => (c === "error" ? "idle" : c));
    setConnectOpen(true);
  }, []);
  const closeConnect = useCallback(() => {
    connectionAttempt.current += 1;
    // Cancelling keeps the question in the box without sending it.
    if (intent.current?.type === "ask") setDraft(intent.current.question);
    intent.current = null;
    sessionStorage.removeItem("brain-intent");
    setConnectOpen(false);
    setConnection((c) => (c === "connected" ? c : "idle"));
  }, []);

  useEffect(() => {
    // refresh updates state only after its network request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
      .catch((e) => setSetupError(e.message))
      .finally(() => setLoaded(true));
  }, [refresh]);

  async function mutation(url: string, body: object) {
    setBusy(true);
    try {
      const res = await post(url, body),
        data = await res.json();
      if (!res.ok) throw Error(data.error);
      await refresh();
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not finish.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function saveCompany(name: string) {
    try {
      await mutation("/api/brain", { action: "company", name });
      toast.success("Company name saved.");
    } catch {}
  }
  async function loadDemo() {
    try {
      await mutation("/api/brain", { action: "sample" });
      toast.success("Sample company loaded.");
    } catch {}
  }
  async function syncSource(kind: string, name: string, key?: string) {
    const data = await mutation("/api/sync", { kind, ...(key ? { key } : {}) });
    toast.success(`${data.synced} records synced from ${name}.`);
    return data;
  }
  async function disconnectSource(kind: string) {
    await mutation("/api/sync", { kind, action: "disconnect" });
    toast.success("Connection removed. Previously synced records are kept.");
  }
  async function importRecords(kind: string, name: string, list: unknown[]) {
    try {
      const data = await mutation("/api/ingest", { kind, name, records: list });
      toast.success(`${data.imported} records imported.`);
      return true;
    } catch {
      return false;
    }
  }
  async function resolveIssue(id: string, resolved: boolean) {
    if (preview) {
      setIssues((items) =>
        items.map((i) => (i.id === id ? { ...i, resolved } : i)),
      );
      return;
    }
    try {
      await mutation("/api/brain", { action: "resolve", id, resolved });
    } catch {}
  }
  async function newConversation() {
    if (preview) {
      setMessages([]);
      setFailed(null);
      return;
    }
    try {
      await mutation("/api/brain", { action: "clear-chat" });
      setFailed(null);
    } catch {}
  }
  async function connectDatabase(url: string, key: string) {
    await mutation("/api/setup", { action: "database", url, key });
    toast.success("Your database is connected.");
  }
  async function saveMonitoring(settings: typeof monitoring) {
    await mutation("/api/setup", { action: "monitoring", ...settings });
    toast.success("Attention settings saved.");
  }
  async function runCheck() {
    const result = await mutation("/api/run", {});
    const error =
      result.sources?.find((s: { error?: string }) => s.error)?.error ||
      result.analysis?.error;
    if (error) toast.error(error);
    else if (result.analysis?.skipped?.startsWith("Connect an AI")) {
      toast.info("Sources checked. Connect AI to analyze them.");
      needAi({ type: "analyze" });
    } else
      toast.success(
        result.analysis?.skipped ||
          `Updated sources and found ${result.analysis?.found || 0} issues.`,
      );
  }

  const kindOf = (r: RecordRow) =>
    sources.find((s) => s.id === r.source_id)?.kind || "";
  const from = (kind: string) => records.filter((r) => kindOf(r) === kind);
  return {
    loaded,
    configured,
    preview,
    project,
    setupError,
    monitoring,
    connectDatabase,
    saveMonitoring,
    runCheck,
    disconnectSource,
    refresh,
    company,
    sources,
    records,
    issues,
    messages,
    tokens,
    busy,
    asking,
    analyzing,
    failed,
    draft,
    setDraft,
    page,
    setPage,
    provider,
    model,
    connection,
    connectionError,
    connected: connection === "connected",
    answeredBy,
    connectOpen,
    openConnect,
    closeConnect,
    connect,
    clearConnectionError: () => {
      setConnectionError("");
      setConnection((c) => (c === "error" ? "idle" : c));
    },
    disconnect,
    askQuestion: (question: string) => needAi({ type: "ask", question }),
    runAnalysis: () => needAi({ type: "analyze" }),
    saveCompany,
    loadDemo,
    syncSource,
    importRecords,
    resolveIssue,
    newConversation,
    kindOf,
    from,
    demo: sources.some((s) => s.mode === "sample"),
  };
}
export type Brain = ReturnType<typeof useBrain>;
