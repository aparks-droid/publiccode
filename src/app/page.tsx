"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowUp,
  Plus,
  X,
  Check,
  Database,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  CircleHelp,
  LogOut,
  Loader2,
  Link2,
  Sparkles,
  Building2,
  Package,
  Wallet,
  Megaphone,
  Users,
  Headphones,
} from "lucide-react";
import { supabase, configured } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
type Source = {
  id: string;
  name: string;
  kind: string;
  status: string;
  last_sync?: string;
};
type RecordRow = {
  id: string;
  title: string;
  domain: string;
  content: string;
  updated_at: string;
};
type Citation = { number: number; title: string; url?: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};
const domains = [
  {
    id: "operations",
    name: "Operations",
    icon: Building2,
    desc: "Projects, processes & decisions",
    color: "#ebf0fd",
  },
  {
    id: "finance",
    name: "Finance",
    icon: Wallet,
    desc: "Revenue, expenses & cash flow",
    color: "#eaf4e9",
  },
  {
    id: "sales",
    name: "Sales",
    icon: Users,
    desc: "Relationships, deals & pipeline",
    color: "#fff0e7",
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: Package,
    desc: "Products, stock & suppliers",
    color: "#f2ecfa",
  },
  {
    id: "marketing",
    name: "Marketing",
    icon: Megaphone,
    desc: "Campaigns, content & performance",
    color: "#fcecf1",
  },
  {
    id: "cx",
    name: "Customer experience",
    icon: Headphones,
    desc: "Feedback, support & retention",
    color: "#e6f4f3",
  },
];
const connectors = [
  {
    name: "Slack",
    kind: "slack",
    initial: "#",
    desc: "Conversations & decisions",
    color: "#f5eafa",
  },
  {
    name: "Google Drive",
    kind: "drive",
    initial: "△",
    desc: "Documents & company knowledge",
    color: "#edf4e8",
  },
  {
    name: "ERP / accounting",
    kind: "erp",
    initial: "↗",
    desc: "Finance, operations & inventory",
    color: "#eaf0ff",
  },
  {
    name: "CRM",
    kind: "crm",
    initial: "◉",
    desc: "Customers, contacts & deals",
    color: "#fff0e8",
  },
  {
    name: "Customer support",
    kind: "support",
    initial: "☷",
    desc: "Tickets, feedback & resolutions",
    color: "#e8f4f2",
  },
  {
    name: "Website & social",
    kind: "web",
    initial: "◎",
    desc: "Content, traffic & campaigns",
    color: "#f8eaf0",
  },
];
export default function Home() {
  const [page, setPage] = useState("overview"),
    [modal, setModal] = useState(""),
    [session, setSession] = useState<Session | null>(null),
    [workspace, setWorkspace] = useState(""),
    [company, setCompany] = useState("Your company"),
    [sources, setSources] = useState<Source[]>([]),
    [records, setRecords] = useState<RecordRow[]>([]),
    [messages, setMessages] = useState<Message[]>([]),
    [question, setQuestion] = useState(""),
    [domain, setDomain] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [provider, setProvider] = useState("anthropic"),
    [apiKey, setApiKey] = useState(""),
    [model, setModel] = useState("claude-sonnet-4-6"),
    [bridgeToken, setBridgeToken] = useState(""),
    [codexReady, setCodexReady] = useState(false),
    [selected, setSelected] = useState(""),
    [importText, setImportText] = useState("");
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector('[role="dialog"]');
    const elements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input, textarea, select, a[href]",
        ) || [],
      );
    elements()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal("");
      if (event.key !== "Tab") return;
      const focusable = elements();
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [modal]);
  async function refresh(id: string) {
    if (!supabase) return;
    const [s, r, m] = await Promise.all([
      supabase
        .from("sources")
        .select("*")
        .eq("workspace_id", id)
        .order("created_at"),
      supabase
        .from("records")
        .select("id,title,domain,content,updated_at")
        .eq("workspace_id", id)
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("messages")
        .select("*")
        .eq("workspace_id", id)
        .order("created_at")
        .limit(100),
    ]);
    if (s.error || r.error || m.error)
      setNotice("Could not load all workspace data. Try again.");
    setSources(s.data || []);
    setRecords(r.data || []);
    setMessages(m.data || []);
  }
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!session || !supabase) {
        setWorkspace("");
        setSources([]);
        setRecords([]);
        setMessages([]);
        return;
      }
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setNotice(
          "Workspace unavailable. Apply the Supabase migration before signing in.",
        );
        return;
      }
      if (data) {
        setWorkspace(data.id);
        setCompany(data.name);
        await refresh(data.id);
      } else setModal("workspace");
    }
    void load();
    return () => {
      active = false;
    };
  }, [session]);
  async function auth(signup: boolean) {
    if (!supabase) {
      setNotice(
        "Supabase is not configured. Follow the setup recipe in the repository.",
      );
      return;
    }
    setBusy(true);
    const result = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setNotice(result.error.message);
    else if (signup && !result.data.session)
      setNotice("Check your email to confirm your account, then sign in.");
    else setModal("");
  }
  async function createWorkspace() {
    if (!session || !supabase) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        name: company.trim() || "My company",
        owner_id: session.user.id,
      })
      .select()
      .single();
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setWorkspace(data.id);
      setModal("");
      await refresh(data.id);
    }
  }
  async function addSource(kind: string, name: string) {
    if (!workspace || !supabase) {
      setModal(session ? "workspace" : "auth");
      return;
    }
    const { data, error } = await supabase
      .from("sources")
      .insert({ workspace_id: workspace, kind, name })
      .select()
      .single();
    if (error) setNotice(error.message);
    else {
      await refresh(workspace);
      setSelected(data.id);
      setModal("import");
    }
  }
  async function importRecords() {
    setBusy(true);
    try {
      const list = JSON.parse(importText);
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ source: selected, records: list }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setNotice(`${data.imported} records imported into your brain.`);
      setImportText("");
      setModal("");
      await refresh(workspace);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Invalid JSON");
    } finally {
      setBusy(false);
    }
  }
  async function bridge(path: string, body: object = {}) {
    const res = await fetch(`http://127.0.0.1:4318/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw Error(data.error || "Bridge request failed");
    return data;
  }
  async function codexLogin() {
    try {
      const data = await bridge("login");
      if (data.authUrl)
        window.open(data.authUrl, "_blank", "noopener,noreferrer");
      setNotice(
        "Complete Codex login in the browser, then click Check connection.",
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Start the local bridge first.",
      );
    }
  }
  async function send(text = question) {
    if (!text.trim() || busy) return;
    if (!workspace) {
      setModal(session ? "workspace" : "auth");
      return;
    }
    const next: Message = { role: "user", content: text.trim() };
    setMessages((v) => [...v, next]);
    setQuestion("");
    setBusy(true);
    try {
      await supabase!
        .from("messages")
        .insert({ workspace_id: workspace, ...next });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          question: text,
          workspace,
          domain,
          provider,
          apiKey,
          model,
        }),
      });
      let data = await res.json();
      if (!res.ok) throw Error(data.error);
      if (provider === "codex") {
        if (!codexReady) throw Error("Connect Codex in Model settings first.");
        const result = await bridge("chat", {
          question: text,
          system: data.system,
        });
        data = { ...data, answer: result.answer };
      }
      const answer: Message = {
        role: "assistant",
        content: data.answer,
        citations: data.citations,
      };
      setMessages((v) => [...v, answer]);
      const saved = await supabase!
        .from("messages")
        .insert({ workspace_id: workspace, ...answer });
      if (saved.error)
        setNotice("Answer received, but could not save chat history.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not send question.");
    } finally {
      setBusy(false);
    }
  }
  const connected = sources.filter((s) => s.status === "connected").length;
  return (
    <div className="app">
      <header>
        <button className="brand" onClick={() => setPage("overview")}>
          <span className="orb small" />
          company brain<span className="edition">by cortex</span>
        </button>
        <nav>
          {[
            ["overview", "Overview"],
            ["sources", "Sources"],
            ["chat", "Ask your brain"],
          ].map(([id, label]) => (
            <button
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
              key={id}
            >
              {label}
              {id === "chat" && <Sparkles size={13} />}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="workspace-name">{company}</span>
          <button
            className="avatar"
            aria-label="Account"
            onClick={() => setModal("auth")}
          >
            {session ? email.slice(0, 1).toUpperCase() || "B" : "B"}
          </button>
        </div>
      </header>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <main>
        {page === "overview" && (
          <>
            <div className="eyebrow">
              <span className="status-dot" /> YOUR BUSINESS, CONNECTED
            </div>
            <div className="page-heading">
              <div>
                <h1>
                  A little context.
                  <br />
                  <span>A whole company of clarity.</span>
                </h1>
                <p>
                  One place for what your business knows. A starting point for
                  everything you build.
                </p>
              </div>
              <button className="primary" onClick={() => setPage("chat")}>
                <Sparkles size={15} /> Ask your brain <ArrowUpRight size={15} />
              </button>
            </div>
            <section className="hero-grid">
              <div className="brain-card">
                <div className="card-top">
                  <span className="eyebrow">COMPANY MEMORY</span>
                  <span className="pill">
                    {connected ? "Live workspace" : "Ready to connect"}
                  </span>
                </div>
                <div className="constellation">
                  <svg viewBox="0 0 700 210" aria-hidden="true">
                    <path
                      d="M100 48 Q230 48 350 105 T600 48 M100 162 Q230 162 350 105 T600 162 M350 20 L350 190"
                      fill="none"
                      stroke="#ded8eb"
                      strokeWidth="1"
                      strokeDasharray="4 5"
                    />
                  </svg>
                  <span className="node n1">
                    # <span>conversations</span>
                  </span>
                  <span className="node n2">
                    ▤ <span>documents</span>
                  </span>
                  <div className="orb large" />
                  <span className="node n3">
                    ◉ <span>customers</span>
                  </span>
                  <span className="node n4">
                    ↗ <span>business data</span>
                  </span>
                </div>
                <div className="brain-bottom">
                  <div>
                    <strong>Your company, in context.</strong>
                    <p>Connect the dots between teams, tools, and decisions.</p>
                  </div>
                  <button
                    className="round"
                    aria-label="Connect sources"
                    onClick={() => setPage("sources")}
                  >
                    <ArrowUpRight size={19} />
                  </button>
                </div>
              </div>
              <div className="brief-card">
                <span className="eyebrow">THE BIG PICTURE</span>
                <h2>
                  It starts with
                  <br />a connection.
                </h2>
                <p>
                  Bring your existing knowledge into one shared memory. Your
                  tools stay where they are.
                </p>
                <div className="stat-row">
                  <span>Connected sources</span>
                  <strong>{connected.toString().padStart(2, "0")}</strong>
                </div>
                <div className="stat-row">
                  <span>Records in memory</span>
                  <strong>
                    {records.length === 100
                      ? "100+"
                      : records.length.toString().padStart(2, "0")}
                  </strong>
                </div>
                <button
                  className="text-button"
                  onClick={() => setPage("sources")}
                >
                  Add your first source <ArrowRight size={15} />
                </button>
              </div>
            </section>
            <div className="section-heading">
              <div>
                <h2>Every part of the business.</h2>
                <p>Shared context. Different perspectives.</p>
              </div>
              <span className="eyebrow">06 KNOWLEDGE SPACES</span>
            </div>
            <div className="spaces">
              {domains.map((d) => (
                <button
                  className="space-card"
                  key={d.id}
                  onClick={() => {
                    setDomain(d.id);
                    setPage("space");
                  }}
                >
                  <div className="space-top">
                    <span
                      className="space-icon"
                      style={{ background: d.color }}
                    >
                      <d.icon size={19} />
                    </span>
                    <ArrowUpRight size={16} />
                  </div>
                  <h3>{d.name}</h3>
                  <p>{d.desc}</p>
                  <div className="space-footer">
                    <span className="tiny-dot" />
                    {records.filter((r) => r.domain === d.id).length ||
                      "No"}{" "}
                    records<span>Explore</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="bottom-note">
              <Layers size={15} />
              <span>
                Built to grow with you. Connect a source today. Build your next
                tool on the same brain.
              </span>
              <button onClick={() => setModal("recipe")}>
                View the recipe <ArrowUpRight size={13} />
              </button>
            </div>
          </>
        )}
        {page === "sources" && (
          <>
            <div className="eyebrow">THE CONNECTION LAYER</div>
            <div className="page-heading">
              <div>
                <h1>Better together.</h1>
                <p>Bring your tools into one queryable workspace.</p>
              </div>
              <span className="pill">
                <Database size={13} /> Supabase ·{" "}
                {configured ? "configured" : "setup required"}
              </span>
            </div>
            <div className="info-strip">
              <Link2 size={18} />
              <div>
                <strong>Your systems remain the source of truth.</strong>
                <p>
                  Adapters import searchable records into Supabase, preserving
                  source links and timestamps. Provider sync adapters are ready
                  for you to build.
                </p>
              </div>
            </div>
            <div className="sources-grid">
              {connectors.map((c) => (
                <div className="source-card" key={c.kind}>
                  <span className="source-logo" style={{ background: c.color }}>
                    {c.initial}
                  </span>
                  <h2>{c.name}</h2>
                  <p>{c.desc}</p>
                  <span className="pill neutral">Import adapter</span>
                  <button
                    className="secondary"
                    onClick={() => addSource(c.kind, c.name)}
                  >
                    <Plus size={14} /> Add source
                  </button>
                </div>
              ))}
            </div>
            <div className="section-heading">
              <div>
                <h2>Your sources</h2>
                <p>Connection status reflects imported data.</p>
              </div>
            </div>
            {!sources.length ? (
              <div className="empty">
                <Database size={24} />
                <h3>A place for everything you know.</h3>
                <p>
                  Add a source above to register it and import your first
                  records.
                </p>
              </div>
            ) : (
              sources.map((s) => (
                <div className="source-row" key={s.id}>
                  <Database size={18} />
                  <div>
                    <strong>{s.name}</strong>
                    <p>
                      {s.last_sync
                        ? `Last import ${new Date(s.last_sync).toLocaleString()}`
                        : "Waiting for first import"}
                    </p>
                  </div>
                  <span className="pill">{s.status}</span>
                  <button
                    className="secondary"
                    onClick={() => {
                      setSelected(s.id);
                      setModal("import");
                    }}
                  >
                    Import records
                  </button>
                </div>
              ))
            )}
          </>
        )}
        {page === "space" && (
          <>
            <button className="text-button" onClick={() => setPage("overview")}>
              ← All spaces
            </button>
            <div className="page-heading">
              <div>
                <div className="eyebrow">KNOWLEDGE SPACE</div>
                <h1>{domains.find((d) => d.id === domain)?.name}</h1>
                <p>{domains.find((d) => d.id === domain)?.desc}</p>
              </div>
              <button className="primary" onClick={() => setPage("chat")}>
                Ask about {domain}
                <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="space-placeholder">
              <div>
                <span className="eyebrow">OVERVIEW</span>
                <h2>Your {domain} workspace.</h2>
                <p>
                  Connected records will live here. As your brain grows, add
                  summaries, charts, and tools powered by the same data.
                </p>
              </div>
              <div
                className="placeholder-chart"
                aria-label="Placeholder chart, no data"
              >
                {[35, 65, 45, 85, 60, 95, 72, 100].map((h, i) => (
                  <i key={i} style={{ height: h }} />
                ))}
                <span>Awaiting connected data</span>
              </div>
            </div>
            <div className="section-heading">
              <h2>Source records</h2>
            </div>
            {records.filter((r) => r.domain === domain).length ? (
              records
                .filter((r) => r.domain === domain)
                .map((r) => (
                  <article className="record" key={r.id}>
                    <span className="eyebrow">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </span>
                    <h3>{r.title}</h3>
                    <p>{r.content}</p>
                  </article>
                ))
            ) : (
              <div className="empty">
                <Layers size={25} />
                <h3>No knowledge here yet.</h3>
                <p>Import records tagged “{domain}” to begin.</p>
                <button
                  className="secondary"
                  onClick={() => setPage("sources")}
                >
                  Connect a source
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
        {page === "chat" && (
          <div className="chat-layout">
            <div className="chat-heading">
              <div>
                <span className="eyebrow">ASK YOUR BRAIN</span>
                <h2>A conversation with your company.</h2>
              </div>
              <button className="secondary" onClick={() => setModal("model")}>
                <SlidersHorizontal size={14} />
                {provider === "codex" ? "Codex" : "Anthropic"}
                <span
                  className={`tiny-dot ${apiKey || codexReady ? "green" : ""}`}
                />
              </button>
            </div>
            <div className="scope">
              <span>Look across</span>
              <select
                aria-label="Knowledge scope"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              >
                <option value="">The whole business</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <span className="scope-count">{connected} connected sources</span>
            </div>
            <div className="chat-messages">
              {!messages.length ? (
                <div className="chat-welcome">
                  <span className="orb medium" />
                  <h1>What’s on your mind?</h1>
                  <p>Ask a question. Connect the dots. Find the next step.</p>
                  <div className="suggestions">
                    {[
                      "What needs our attention this week?",
                      "What do we know about our customers?",
                      "Summarize our financial position.",
                      "Where are operations getting stuck?",
                    ].map((q) => (
                      <button key={q} onClick={() => setQuestion(q)}>
                        {q}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`message ${m.role}`}>
                    <span className="eyebrow">
                      {m.role === "user" ? "YOU" : "COMPANY BRAIN"}
                    </span>
                    <div className="message-text">{m.content}</div>
                    {!!m.citations?.length && (
                      <details>
                        <summary>{m.citations.length} source records</summary>
                        {m.citations.map((c) => (
                          <div key={c.number}>
                            [{c.number}]{" "}
                            {c.url && /^https?:\/\//.test(c.url) ? (
                              <a href={c.url} target="_blank" rel="noreferrer">
                                {c.title}
                              </a>
                            ) : (
                              c.title
                            )}
                          </div>
                        ))}
                      </details>
                    )}
                  </div>
                ))
              )}
              {busy && (
                <div className="thinking">
                  <Loader2 className="spin" size={15} /> Looking through your
                  workspace…
                </div>
              )}
            </div>
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                aria-label="Ask a question"
                placeholder="Ask anything about your business…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div>
                <span>
                  <Database size={13} /> Workspace knowledge
                </span>
                <button
                  className="primary"
                  disabled={busy || !question.trim()}
                  aria-label="Send question"
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </form>
            <p className="chat-disclaimer">
              Grounded in your sources. Check the evidence before making
              decisions.
            </p>
          </div>
        )}
      </main>
      <footer>
        <span className="brand-mini">
          <span className="orb mini" />
          company brain
        </span>
        <span>Your knowledge. Your models. Your workspace.</span>
        <button onClick={() => setModal("recipe")}>
          <CircleHelp size={14} /> Setup recipe
        </button>
      </footer>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal("")}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close dialog"
              onClick={() => setModal("")}
            >
              <X size={19} />
            </button>
            {modal === "auth" && (
              <>
                <span className="eyebrow">YOUR WORKSPACE</span>
                <h2>
                  {session
                    ? "You’re signed in."
                    : "Make room for your company."}
                </h2>
                {session ? (
                  <>
                    <p>{session.user.email}</p>
                    <button
                      className="secondary"
                      onClick={async () => {
                        await supabase?.auth.signOut();
                        setApiKey("");
                        setBridgeToken("");
                        setCodexReady(false);
                        setModal("");
                      }}
                    >
                      <LogOut size={15} /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      Use your email to access your private business workspace.
                      Model accounts connect separately.
                    </p>
                    <label>
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                      />
                    </label>
                    <button
                      className="primary full"
                      disabled={busy}
                      onClick={() => auth(false)}
                    >
                      Sign in
                    </button>
                    <button
                      className="secondary full"
                      disabled={busy}
                      onClick={() => auth(true)}
                    >
                      Create account
                    </button>
                  </>
                )}
              </>
            )}
            {modal === "workspace" && (
              <>
                <h2>Name your company brain.</h2>
                <label>
                  Company name
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </label>
                <button
                  className="primary full"
                  disabled={busy}
                  onClick={createWorkspace}
                >
                  Create workspace
                </button>
              </>
            )}
            {modal === "model" && (
              <>
                <span className="eyebrow">YOUR MODELS, YOUR ACCOUNT</span>
                <h2>Choose how you think.</h2>
                <div className="tabs">
                  <button
                    className={provider === "anthropic" ? "active" : ""}
                    onClick={() => setProvider("anthropic")}
                  >
                    Anthropic API
                  </button>
                  <button
                    className={provider === "codex" ? "active" : ""}
                    onClick={() => setProvider("codex")}
                  >
                    Codex account
                  </button>
                </div>
                {provider === "anthropic" ? (
                  <>
                    <p>
                      Your API key stays in this tab’s memory and is sent only
                      to this app’s server to call Anthropic. API billing is
                      separate from a Claude subscription.
                    </p>
                    <label>
                      Anthropic API key
                      <input
                        type="password"
                        autoComplete="off"
                        placeholder="sk-ant-…"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </label>
                    <label>
                      Model ID
                      <input
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      />
                    </label>
                    <button
                      className="primary full"
                      onClick={() => setModal("")}
                    >
                      Use this model
                      <Check size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      Use your Codex account through the included local bridge.
                      Your Codex credentials stay on your computer.
                    </p>
                    <code className="code">
                      npm run bridge -- --origin{" "}
                      {typeof window !== "undefined"
                        ? window.location.origin
                        : "http://localhost:3000"}
                    </code>
                    <label>
                      Bridge pairing token
                      <input
                        type="password"
                        autoComplete="off"
                        value={bridgeToken}
                        onChange={(e) => setBridgeToken(e.target.value)}
                      />
                    </label>
                    <button className="primary full" onClick={codexLogin}>
                      Sign in with Codex
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      className="secondary full"
                      onClick={async () => {
                        try {
                          const r = await bridge("account");
                          setCodexReady(!!r.account);
                          setNotice(
                            r.account
                              ? "Codex connected."
                              : "Finish Codex login first.",
                          );
                        } catch {
                          setNotice(
                            "Bridge unavailable. Start the local bridge and check the pairing token.",
                          );
                        }
                      }}
                    >
                      Check connection
                    </button>
                  </>
                )}
              </>
            )}
            {modal === "import" && (
              <>
                <span className="eyebrow">SOURCE ADAPTER</span>
                <h2>Give your brain some context.</h2>
                <p>
                  Paste normalized JSON records to import now, or connect your
                  own adapter to <code>POST /api/ingest</code>. Native provider
                  sync is not installed yet.
                </p>
                <label>
                  Records
                  <textarea
                    className="json-input"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={
                      '[{"external_id":"invoice-001","domain":"finance","title":"Invoice","content":"Your actual source content","source_url":"https://…"}]'
                    }
                  />
                </label>
                <p className="muted">
                  Source ID: <code>{selected}</code>
                </p>
                <button
                  className="primary full"
                  disabled={busy || !importText.trim()}
                  onClick={importRecords}
                >
                  Import to Supabase
                  <ArrowRight size={15} />
                </button>
              </>
            )}
            {modal === "recipe" && (
              <>
                <span className="eyebrow">BUILT TO BE YOURS</span>
                <h2>Your company brain recipe.</h2>
                <ol className="recipe">
                  <li>
                    <strong>Create your workspace.</strong>
                    <p>Sign in with email and give your company a name.</p>
                  </li>
                  <li>
                    <strong>Connect your context.</strong>
                    <p>
                      Register a source and import records. Extend the ingest
                      API with your own MCP or API adapters.
                    </p>
                  </li>
                  <li>
                    <strong>Bring your model.</strong>
                    <p>Add an Anthropic key or pair the local Codex bridge.</p>
                  </li>
                  <li>
                    <strong>Build on your brain.</strong>
                    <p>
                      Use the shared Supabase records for your next marketing,
                      operations, or finance tool.
                    </p>
                  </li>
                </ol>
                <a
                  className="primary full"
                  href="https://github.com/how-to-ai-co/company-brain"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open the repository
                  <ArrowUpRight size={15} />
                </a>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
