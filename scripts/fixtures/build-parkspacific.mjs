// Builds demo/parkspacific-financial.json — the labelled sample workbook for
// ParksPacific Financial's hosted preview. The company is real; every client
// firm, invoice, note and figure below is invented sample data.
import { writeFileSync } from "node:fs";

const AS_OF = "2026-10-02";
const base = "https://parkspacific.example/workbook";
const usd = (n) => `$${n.toLocaleString("en-US")}`;
const pretty = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const rows = [];
const add = (type, id, domain, title, content, meta) =>
  rows.push({
    external_id: `sheet-${type}-${id}`,
    domain,
    title,
    content,
    source_url: `${base}/${type}s/${id}`,
    metadata: { sheet: `${type[0].toUpperCase()}${type.slice(1)}s`, type, as_of: AS_OF, ...meta },
  });

// Engagements tab — the client roster on the offer ladder.
const engagements = [
  ["halvorsen", "Halvorsen & Mendes LLP", "Platinum — Elite FCFO", 3400, "monthly", 18, "2026-05-01", "Monthly risk update meeting with the managing partner; dashboards maintained monthly."],
  ["okafor", "Okafor Brandt Litigation Group", "Gold — Executive FCFO", 8600, "fixed", 14, "2026-09-08", "Six-week engagement, currently in week 4. Focus: realization, WIP and collections."],
  ["kealoha", "Kealoha Fitzgerald LLP", "Platinum — Elite FCFO + AI add-on", 5000, "monthly", 9, "2026-03-01", "Platinum $2,600/month plus AI consulting add-on $2,400/month (AI policy and governance)."],
  ["vance", "Vance Whitcombe & Rao", "Silver — Business Health Review", 1500, "fixed", 6, "2026-09-28", "Two-day Business Health Review scheduled Oct 7–8."],
  ["delacroix", "Delacroix Sutton PC", "Gold — Executive FCFO", 9800, "fixed", 22, "2026-09-24", "Six-week engagement, week 2. 50% deposit invoiced at kickoff."],
  ["pemberton", "Pemberton Ashe LLP", "Platinum — Elite FCFO", 1800, "monthly", 5.5, "2026-06-01", "Monthly dashboard refresh and risk review."],
  ["ridgeway", "Ridgeway Family Law", "Legacy bookkeeping", 900, "monthly", 2.1, "2025-04-01", "Legacy bookkeeping client. Supported, not marketed; referral transition planned."],
];
for (const [id, firm, tier, fee, basis, revenueM, since, note] of engagements)
  add("engagement", id, "cx", `Engagement — ${firm} (${tier})`,
    `${firm}. Tier: ${tier}. Fee: ${usd(fee)}${basis === "monthly" ? " per month" : " fixed"}. Firm revenue about $${revenueM}M. Client since ${pretty(since)}. ${note}`,
    { client: firm, tier, fee, basis, firm_revenue_m: revenueM, since, owner: "Aaron" });

// Deliverables tab — what is promised and when.
const deliverables = [
  ["halvorsen-risk-oct", "Halvorsen & Mendes LLP", "October monthly risk update meeting", "2026-10-06", "In progress", "Prep deck in progress; WIP aging and realization trend updated."],
  ["okafor-dashboard", "Okafor Brandt Litigation Group", "Utilization, realization & collection dashboard", "2026-10-05", "Blocked", "Waiting on the WIP export from the firm's practice management system. Promised by the managing partner for Oct 2; not received."],
  ["kealoha-ai-policy", "Kealoha Fitzgerald LLP", "AI policy & governance review — first draft", "2026-10-09", "In progress", "Draft for the firm's AI steering committee."],
  ["vance-prework", "Vance Whitcombe & Rao", "Business Health Review pre-read: P&L, AR aging, WIP report", "2026-10-05", "Waiting on client", "Document request sent Sep 28. Needed before the Oct 7–8 review."],
  ["delacroix-baseline", "Delacroix Sutton PC", "Baseline financial health review", "2026-10-08", "In progress", "Week 2 deliverable of the Gold engagement."],
  ["pemberton-dash", "Pemberton Ashe LLP", "Monthly dashboard refresh — September", "2026-10-07", "Not started", "Needs September close numbers from the firm's controller."],
  ["okafor-recs", "Okafor Brandt Litigation Group", "Draft recommendations", "2026-10-14", "Not started", "Depends on the realization dashboard."],
  ["ridgeway-close", "Ridgeway Family Law", "September bookkeeping close", "2026-10-10", "Not started", "Legacy bookkeeping work."],
];
for (const [id, firm, item, due, status, detail] of deliverables)
  add("deliverable", id, "operations", `Deliverable — ${firm}: ${item}`,
    `${firm}: ${item}. Due ${pretty(due)}. Status: ${status}. Owner: Aaron. ${detail}`,
    { client: firm, item, due, status, owner: "Aaron" });

// Invoices tab — billing and receivables.
const invoices = [
  ["PPF-2609-01", "Halvorsen & Mendes LLP", 3400, "2026-09-01", "2026-09-15", "Paid", "September Platinum retainer"],
  ["PPF-2610-01", "Halvorsen & Mendes LLP", 3400, "2026-10-01", "2026-10-15", "Open", "October Platinum retainer"],
  ["PPF-2609-03", "Kealoha Fitzgerald LLP", 5000, "2026-09-01", "2026-09-15", "Overdue", "September Platinum retainer + AI add-on"],
  ["PPF-2610-03", "Kealoha Fitzgerald LLP", 5000, "2026-10-01", "2026-10-15", "Open", "October Platinum retainer + AI add-on"],
  ["PPF-2609-07", "Okafor Brandt Litigation Group", 4300, "2026-09-08", "2026-09-22", "Paid", "Gold engagement — 50% deposit"],
  ["PPF-2609-09", "Delacroix Sutton PC", 4900, "2026-09-24", "2026-10-01", "Overdue", "Gold engagement — 50% deposit"],
  ["PPF-2609-10", "Vance Whitcombe & Rao", 1500, "2026-09-28", "2026-09-28", "Paid", "Business Health Review"],
  ["PPF-2609-06", "Pemberton Ashe LLP", 1800, "2026-09-01", "2026-09-15", "Overdue", "September Platinum retainer"],
  ["PPF-2610-06", "Pemberton Ashe LLP", 1800, "2026-10-01", "2026-10-15", "Open", "October Platinum retainer"],
  ["PPF-2608-12", "Ridgeway Family Law", 900, "2026-08-01", "2026-08-15", "Overdue", "August bookkeeping"],
  ["PPF-2609-12", "Ridgeway Family Law", 900, "2026-09-01", "2026-09-15", "Paid", "September bookkeeping"],
];
for (const [id, firm, amount, issued, due, status, desc] of invoices)
  add("invoice", id, "finance", `Invoice ${id} — ${firm}, ${usd(amount)} (${status})`,
    `Invoice ${id} to ${firm}: ${desc}. Amount ${usd(amount)}. Issued ${pretty(issued)}, due ${pretty(due)}. Status: ${status}.`,
    { client: firm, invoice: id, amount, currency: "USD", issued, due, status, description: desc });

// Pipeline tab — prospects moving up the offer ladder.
const prospects = [
  ["brightwater", "Brightwater Legal Group", 12, "Stage 2 — $17 risk report purchased", 1500, "Offer the Business Health Review", "2026-09-29", "Bought the $17 risk and mitigation report Sep 22. Follow-up offering the Business Health Review was due Sep 29."],
  ["castellan", "Castellan Moore LLP", 31, "Silver — BHR proposal sent", 1500, "Follow-up call", "2026-10-02", "Business Health Review proposal sent Sep 25 to the firm administrator."],
  ["ironwood", "Ironwood Trial Lawyers", 8, "Gold — proposal sent", 7400, "Decision expected", "2026-10-06", "Completed a Business Health Review in August. Gold proposal for $7,400 sent Sep 18."],
  ["sato", "Sato Whitfield PLLC", 16, "Stage 1 — one-pager download", 0, "Send the $17 risk report offer", "2026-10-09", "Downloaded the one-page risk giveaway from a LinkedIn post on Sep 30."],
];
for (const [id, firm, revenueM, stage, value, next, follow, detail] of prospects)
  add("prospect", id, "sales", `Prospect — ${firm}: ${stage}`,
    `${firm} (about $${revenueM}M revenue). Ladder stage: ${stage}. ${value ? `Proposed value ${usd(value)}.` : "No proposal yet."} Next step: ${next}, due ${pretty(follow)}. ${detail}`,
    { client: firm, stage, value, next_step: next, follow_up: follow, firm_revenue_m: revenueM, owner: "Aaron" });

// Task list tab — the owner's to-do list, priority by leading asterisks (**** highest).
const tasks = [
  ["t1", "****", "Send Okafor Brandt a revised dashboard date if the WIP export is still missing", "2026-10-03", "Open", "Okafor Brandt Litigation Group"],
  ["t2", "****", "Kealoha Fitzgerald: payment reminder for invoice PPF-2609-03", "2026-10-02", "Open", "Kealoha Fitzgerald LLP"],
  ["t3", "***", "Prepare Business Health Review agenda for Vance Whitcombe & Rao", "2026-10-06", "Open", "Vance Whitcombe & Rao"],
  ["t4", "***", "Brightwater Legal Group: send the Business Health Review offer", "2026-09-29", "Open", "Brightwater Legal Group"],
  ["t5", "**", "Write the Ridgeway bookkeeping referral transition plan", "2026-11-01", "Open", "Ridgeway Family Law"],
  ["t6", "**", "Schedule Q4 quarterly reviews with Platinum clients", "2026-10-15", "Open", ""],
  ["t7", "*", "File September receipts and reconcile the business card", "2026-10-10", "Open", ""],
  ["t8", "***", "Halvorsen & Mendes risk meeting deck", "2026-10-01", "Done", "Halvorsen & Mendes LLP"],
];
for (const [id, priority, item, due, status, firm] of tasks)
  add("task", id, "company", `Task ${priority} ${item}`,
    `To-do (priority ${priority}): ${item}. Due ${pretty(due)}. Status: ${status}.${firm ? ` Client: ${firm}.` : ""}`,
    { client: firm, item, priority, due, status, owner: "Aaron" });

// Notes tab — meeting notes and commitments.
const notes = [
  ["okafor-0930", "Okafor Brandt Litigation Group", "2026-09-30", "Weekly check-in", "Managing partner promised the WIP export from the practice management system by Oct 2. We committed to deliver the realization dashboard by Oct 5. Early read: about $410,000 of unbilled WIP is older than 90 days."],
  ["kealoha-0929", "Kealoha Fitzgerald LLP", "2026-09-29", "AI steering committee", "We committed the AI policy draft by Oct 9. The managing partner said the September invoice was approved and would be paid that week."],
  ["delacroix-0924", "Delacroix Sutton PC", "2026-09-24", "Gold kickoff", "Agreed the 50% deposit is paid before the baseline review is delivered. Firm CFO is the day-to-day contact."],
  ["capacity-1001", "ParksPacific Financial", "2026-10-01", "Internal capacity review", "October holds a two-day Business Health Review, two Gold engagements and three Platinum monthly meetings, which fills the part-time calendar through Oct 16. Ridgeway bookkeeping moves to a referral partner; transition plan due by Nov 1."],
];
for (const [id, firm, date, meeting, text] of notes)
  add("note", id, "company", `Note — ${firm}: ${meeting} (${pretty(date)})`,
    `${meeting} with ${firm}, ${pretty(date)}. ${text}`,
    { client: firm, date, meeting });

const ids = new Set(rows.map((r) => r.external_id));
const issue = (title, consequence, category, priority, due, status, action, customer, evidence) => {
  for (const e of evidence) if (!ids.has(e)) throw Error(`Missing evidence ${e}`);
  return { title, consequence, category, priority, owner: "Aaron", due, status, action, customer, evidence };
};
const issues = [
  issue("Okafor Brandt dashboard blocked on WIP export",
    "The realization dashboard is due Oct 5 and the promised WIP export has not arrived; draft recommendations on Oct 14 depend on it.",
    "Customers", "high", "2026-10-05", "Waiting on the client's WIP export",
    "Call the managing partner today to get the export, or agree a revised dashboard date in writing.",
    "Okafor Brandt Litigation Group",
    ["sheet-deliverable-okafor-dashboard", "sheet-note-okafor-0930", "sheet-deliverable-okafor-recs", "sheet-task-t1"]),
  issue("Kealoha September invoice overdue",
    "$5,000 is past due despite the managing partner's Sep 29 assurance, and the October invoice is already open.",
    "Revenue", "high", "2026-10-05", "Promised payment not received",
    "Send a courteous reminder referencing the Sep 29 conversation before the AI policy draft goes out.",
    "Kealoha Fitzgerald LLP",
    ["sheet-invoice-PPF-2609-03", "sheet-note-kealoha-0929", "sheet-invoice-PPF-2610-03"]),
  issue("Delacroix deposit unpaid before baseline review",
    "The kickoff agreement requires the $4,900 deposit before the Oct 8 baseline review is delivered.",
    "Revenue", "medium", "2026-10-08", "Deposit past its Oct 1 due date",
    "Confirm payment timing with the firm CFO this week.",
    "Delacroix Sutton PC",
    ["sheet-invoice-PPF-2609-09", "sheet-note-delacroix-0924", "sheet-deliverable-delacroix-baseline"]),
  issue("Brightwater follow-up missed after $17 purchase",
    "A qualified $17 buyer has had no Business Health Review offer three days after the planned follow-up.",
    "Customers", "medium", "2026-09-29", "Follow-up overdue",
    "Send the Business Health Review offer with one clear call to action.",
    "Brightwater Legal Group",
    ["sheet-prospect-brightwater", "sheet-task-t4"]),
  issue("October advisory calendar near capacity",
    "The calendar is full through Oct 16, so a Gold win from Ironwood would need a start date after that.",
    "People", "medium", "2026-10-06", "Booked through Oct 16",
    "Decide the earliest Ironwood start date before their Oct 6 decision.",
    "",
    ["sheet-note-capacity-1001", "sheet-prospect-ironwood", "sheet-deliverable-vance-prework"]),
];

writeFileSync(new URL("../../demo/parkspacific-financial.json", import.meta.url), JSON.stringify({
  company: "ParksPacific Financial",
  note: "Labelled sample workbook for ParksPacific Financial's preview. ParksPacific Financial is a real company; the client firms, invoices, notes and figures in these records are invented samples, not client data.",
  sources: [{ kind: "web", name: "Client workbook", records: rows }],
  issues,
}, null, 1) + "\n");
console.log(`${rows.length} records, ${issues.length} issues`);
