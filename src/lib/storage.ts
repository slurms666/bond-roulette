import { AppState } from "./types";

export const STORAGE_KEY = "bond-roulette-v2";

export function loadState(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppState) : null;
  } catch {
    return null;
  }
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function downloadText(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function spinsToCsv(rows: AppState["spins"]) {
  const headers = [
    "index",
    "number",
    "colour",
    "parity",
    "rangeBand",
    "dozen",
    "column",
    "jamesBondZone",
    "triggerScore",
    "triggerReasons",
    "status",
    "betTaken",
    "triggerLabel",
    "scaleUsed",
    "totalStake",
    "stakeZero",
    "stakeMid",
    "stakeHigh",
    "spinPL",
    "runningPL",
    "openLossesAfter",
    "createdAt",
    "notes",
  ];

  const lines = rows.map((row) =>
    [
      row.index,
      row.number,
      row.colour,
      row.parity,
      row.rangeBand,
      row.dozen,
      row.column,
      row.jamesBondZone,
      row.triggerScore,
      row.triggerReasons.join(" | "),
      row.status,
      row.betTaken,
      row.triggerLabel ?? "",
      row.scaleUsed ?? "",
      row.totalStake ?? "",
      row.stakeZero ?? "",
      row.stakeMid ?? "",
      row.stakeHigh ?? "",
      row.spinPL ?? "",
      row.runningPL ?? "",
      row.openLossesAfter ?? "",
      row.createdAt,
      row.notes ?? "",
    ]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(",")
  );

  return [headers.join(","), ...lines].join("\n");
}
