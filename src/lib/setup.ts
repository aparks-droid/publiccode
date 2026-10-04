// Finish-setup steps for ParksPacific Financial's Company Brain.
// Non-secret choices from the setup interview; credentials never live here.
export const SETUP_STEP_IDS = [
  "database",
  "spreadsheet",
  "ai",
  "destinations",
] as const;
export type SetupStepId = (typeof SETUP_STEP_IDS)[number];
export const SETUP_CHOICES = ["now", "later", "help"];
export type SetupStatus =
  | "Sample"
  | "Not connected"
  | "Connected"
  | "Needs attention"
  | "Requires development";
export type SetupProgress = Partial<
  Record<SetupStepId, { choice: string; at: string }>
>;
export const SELECTED_SOURCES = {
  spreadsheet: "Spreadsheet (Excel or Google Sheets export)",
};
