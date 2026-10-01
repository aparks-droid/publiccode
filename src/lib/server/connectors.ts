import type { LocalConfig } from "./local";
export type Kind = "slack" | "stripe" | "attio";
export const kinds: Kind[] = ["slack", "stripe", "attio"];
export type SourceRecord = {
  external_id: string;
  domain: string;
  title: string;
  content: string;
  source_url?: string;
  metadata: Record<string, string | number>;
};
export type Pull = {
  records: SourceRecord[];
  account: string;
  summary: string;
};
// Provider responses are untrusted JSON. Keep parsing at this boundary.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function request(url: string, key: string, body?: object): Promise<Json> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 429)
    throw Error(
      `Source rate limit reached. Try again after ${res.headers.get("retry-after") || "60"} seconds. Your previous records are kept.`,
    );
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    const slackErrors: Record<string, string> = {
      missing_scope:
        "Add the requested read scopes to your Slack app, reinstall it, and copy the new token.",
      not_in_channel: "Invite your Slack app to the channel first.",
      invalid_auth: "Slack rejected that token.",
      token_revoked: "That Slack token was revoked. Create a new one.",
    };
    throw Error(
      slackErrors[data.error] ||
        (res.status === 401 || res.status === 403
          ? "The source rejected this key or its read permissions. Check the setup instructions."
          : `Source request failed (${res.status}). Check your key and permissions.`),
    );
  }
  return data;
}
async function slack(key: string): Promise<Pull> {
  const call = (method: string, params: Record<string, string> = {}) =>
    request(
      `https://slack.com/api/${method}?${new URLSearchParams(params)}`,
      key,
    );
  const team = await call("auth.test");
  const channels: Json[] = [];
  let cursor = "";
  do {
    const page = await call("conversations.list", {
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
      cursor,
    });
    channels.push(...page.channels.filter((c: Json) => c.is_member));
    cursor = page.response_metadata?.next_cursor || "";
  } while (cursor && channels.length < 100);
  if (!channels.length)
    throw Error(
      "Invite the Slack app to at least one channel with /invite @your-app, then connect again.",
    );
  const records: SourceRecord[] = [];
  const oldest = String(Math.floor(Date.now() / 1000) - 30 * 86400);
  let capped = channels.length > 20 || !!cursor;
  for (const ch of channels.slice(0, 20)) {
    let pageCursor = "",
      count = 0;
    do {
      const page = await call("conversations.history", {
        channel: ch.id,
        oldest,
        limit: "100",
        cursor: pageCursor,
      });
      for (const m of page.messages || []) {
        if (
          !m.text ||
          m.subtype === "channel_join" ||
          m.subtype === "channel_leave"
        )
          continue;
        const posted = new Date(Number(m.ts) * 1000).toISOString();
        records.push({
          external_id: `${ch.id}-${m.ts}`,
          domain: "operations",
          title: `#${ch.name} — ${m.text.slice(0, 90)}`,
          content: `${m.user || m.bot_id || "Slack"} in #${ch.name} at ${posted}: ${m.text}`,
          source_url: `${team.url}archives/${ch.id}/p${m.ts.replace(".", "")}`,
          metadata: {
            channel: ch.name,
            author: m.user || "",
            posted_at: posted,
            text: m.text,
            replies: Number(m.reply_count || 0),
          },
        });
      }
      count += page.messages?.length || 0;
      pageCursor = page.response_metadata?.next_cursor || "";
    } while (pageCursor && count < 300);
    capped ||= !!pageCursor;
  }
  return {
    records,
    account: team.team || team.team_id,
    summary: `Last 30 days; ${Math.min(channels.length, 20)} joined channels; top-level messages only${capped ? "; import limit reached" : ""}. Thread replies are not included.`,
  };
}
// Stripe represents most currencies in hundredths; these are the zero-decimal charge currencies.
const zeroDecimal = new Set(
  "BIF CLP DJF GNF JPY KMF KRW MGA PYG RWF UGX VND VUV XAF XOF XPF".split(" "),
);
async function stripe(key: string): Promise<Pull> {
  const records: SourceRecord[] = [];
  let after = "",
    more = false;
  const since = Math.floor(Date.now() / 1000) - 90 * 86400;
  do {
    const params = new URLSearchParams({
      limit: "100",
      "created[gte]": String(since),
    });
    if (after) params.set("starting_after", after);
    const page = await request(
      `https://api.stripe.com/v1/charges?${params}`,
      key,
    );
    for (const c of page.data) {
      const currency = String(c.currency).toUpperCase(),
        divisor = zeroDecimal.has(currency) ? 1 : 100;
      const amount = c.amount / divisor,
        refunded = c.amount_refunded / divisor;
      const date = new Date(c.created * 1000).toISOString().slice(0, 10);
      const customer =
        c.billing_details?.name ||
        c.billing_details?.email ||
        c.customer ||
        "Customer";
      // Successful payments retain their gross amount and carry refunds separately.
      const status = c.status;
      records.push({
        external_id: c.id,
        domain: "finance",
        title: `Payment ${status} — ${customer}, ${amount} ${currency}`,
        content: `Stripe charge ${c.id}. Customer: ${customer}. Amount: ${amount} ${currency}. Refunded: ${refunded} ${currency}. Date: ${date}. Status: ${status}. ${c.description || ""}`,
        source_url: `https://dashboard.stripe.com/${c.livemode ? "" : "test/"}payments/${c.id}`,
        metadata: {
          type: "payment",
          customer,
          amount,
          refunded,
          net: status === "succeeded" ? amount - refunded : 0,
          currency,
          date,
          status,
          payment_intent: c.payment_intent || c.id,
          description: c.description || "",
        },
      });
    }
    more = page.has_more === true;
    after = page.data.at(-1)?.id || "";
    if (more && !after)
      throw Error("Stripe returned an incomplete page. Try syncing again.");
  } while (more && records.length < 1000);
  return {
    records,
    account:
      key.startsWith("rk_test_") || key.startsWith("sk_test_")
        ? "Stripe test data"
        : "Stripe",
    summary: `Last 90 days; ${records.length} payment attempts${more ? "; first 1,000 charges only" : ""}. Charges and refunds, not a full accounting ledger.`,
  };
}
function attribute(values: Json, key: string) {
  return values[key]?.[0] || {};
}
async function attio(key: string): Promise<Pull> {
  const records: SourceRecord[] = [];
  let offset = 0,
    more = true;
  while (more && offset < 1000) {
    const page = await request(
      "https://api.attio.com/v2/objects/deals/records/query",
      key,
      { limit: 100, offset },
    );
    for (const r of page.data) {
      const v = r.values || {};
      const title = attribute(v, "name").value || "Untitled deal";
      const stage = attribute(v, "stage").status?.title || "Unknown";
      const amount = attribute(v, "value");
      const owner = attribute(v, "owner");
      const id = r.id.record_id;
      records.push({
        external_id: id,
        domain: "sales",
        title,
        content: `Attio deal: ${title}. Stage: ${stage}. Source attributes: ${JSON.stringify(v).slice(0, 30000)}`,
        source_url: r.web_url,
        metadata: {
          type: "deal",
          customer: title,
          name: title,
          stage,
          value: Number(amount.currency_value || 0),
          currency: amount.currency_code || "",
          owner: owner.referenced_actor_id || "Unassigned",
          created_at: r.created_at || "",
          description: `Stage: ${stage}`,
        },
      });
    }
    offset += page.data.length;
    more = page.data.length === 100;
  }
  return {
    records,
    account: "Attio deals",
    summary: `${records.length} deals${more ? "; first 1,000 records only" : ""}. Uses your workspace's Deals object; source stages are preserved.`,
  };
}
export async function pullSource(kind: Kind, key: string) {
  if (!key.trim()) throw Error("Enter the source API key or token.");
  return { slack, stripe, attio }[kind](key.trim());
}
export function connectionStatus(config: LocalConfig) {
  return Object.fromEntries(
    kinds.map((k) => [k, !!config.connectors?.[k]?.key]),
  );
}
