"use client";

import { useEffect, useMemo, useState } from "react";

type Zone = "zero" | "low" | "mid" | "high";
type Color = "red" | "black" | "green";
type Outcome = "win-high" | "win-mid" | "win-zero" | "loss-low" | "tracking-only";
type ResetMode = "reset-on-covered-win" | "partial-recovery";
type TabKey = "dashboard" | "log" | "triggers" | "help";

type TriggerSettings = {
  lookback: number;
  minHighHits: number;
  minLowMisses: number;
  minUncoveredDrought: number;
  minColorStreak: number;
  preferredColor: "any" | "red" | "black";
};

type AppSettings = {
  bankroll: number;
  chipValue: number;
  baseScale: number;
  targetProfitBuffer: number;
  tableMaxStake: number;
  resetMode: ResetMode;
  triggerSettings: TriggerSettings;
};

type SequenceState = {
  active: boolean;
  openLosses: number;
  currentScale: number;
  currentStake: number;
  recommendedNextScale: number;
  recommendedNextStake: number;
  sequenceProfit: number;
  sequenceSpinCount: number;
  startedAt: string | null;
};

type SpinEntry = {
  id: string;
  number: number;
  ts: string;
  color: Color;
  zone: Zone;
  dozen: number | null;
  column: number | null;
  sequenceActive: boolean;
  scaleUsed: number | null;
  stakeUsed: number | null;
  pnlUnits: number;
  pnlCash: number;
  outcome: Outcome;
  notes: string[];
};

type PersistedState = {
  settings: AppSettings;
  sequence: SequenceState;
  spins: SpinEntry[];
  sessionNotes: string;
};

const STORAGE_KEY = "bond-roulette-v1";
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Live Dashboard" },
  { key: "log", label: "Spin Log" },
  { key: "triggers", label: "Trigger Rules / Settings" },
  { key: "help", label: "Strategy / Help" },
];

const defaultSettings: AppSettings = {
  bankroll: 500,
  chipValue: 1,
  baseScale: 1,
  targetProfitBuffer: 8,
  tableMaxStake: 400,
  resetMode: "reset-on-covered-win",
  triggerSettings: {
    lookback: 12,
    minHighHits: 5,
    minLowMisses: 8,
    minUncoveredDrought: 3,
    minColorStreak: 3,
    preferredColor: "any",
  },
};

const defaultSequence = (settings: AppSettings): SequenceState => ({
  active: false,
  openLosses: 0,
  currentScale: settings.baseScale,
  currentStake: 20 * settings.baseScale,
  recommendedNextScale: settings.baseScale,
  recommendedNextStake: 20 * settings.baseScale,
  sequenceProfit: 0,
  sequenceSpinCount: 0,
  startedAt: null,
});

const defaultPersisted = (): PersistedState => ({
  settings: defaultSettings,
  sequence: defaultSequence(defaultSettings),
  spins: [],
  sessionNotes: "",
});

function getColor(num: number): Color {
  if (num === 0) return "green";
  return RED_NUMBERS.has(num) ? "red" : "black";
}

function getZone(num: number): Zone {
  if (num === 0) return "zero";
  if (num >= 1 && num <= 12) return "low";
  if (num >= 13 && num <= 18) return "mid";
  return "high";
}

function getDozen(num: number): number | null {
  if (num === 0) return null;
  return Math.ceil(num / 12);
}

function getColumn(num: number): number | null {
  if (num === 0) return null;
  const mod = num % 3;
  if (mod === 1) return 1;
  if (mod === 2) return 2;
  return 3;
}

function getPnlUnits(num: number, scale: number): number {
  const zone = getZone(num);
  if (zone === "high") return 8 * scale;
  if (zone === "mid") return 10 * scale;
  if (zone === "zero") return 16 * scale;
  return -20 * scale;
}

function outcomeFor(num: number): Outcome {
  const zone = getZone(num);
  if (zone === "high") return "win-high";
  if (zone === "mid") return "win-mid";
  if (zone === "zero") return "win-zero";
  return "loss-low";
}

function getRecommendedScale(openLosses: number, settings: AppSettings) {
  return Math.max(settings.baseScale, Math.ceil((openLosses + settings.targetProfitBuffer) / 8));
}

function currency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function NumberButton({ number, onClick }: { number: number; onClick: (n: number) => void }) {
  const color = getColor(number);
  return (
    <button
      onClick={() => onClick(number)}
      className={cls(
        "rounded-xl border px-3 py-3 text-sm font-semibold transition hover:scale-[1.02]",
        color === "green" && "border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20",
        color === "red" && "border-rose-400/30 bg-rose-500/15 text-rose-100 hover:bg-rose-500/20",
        color === "black" && "border-slate-500/40 bg-slate-800 text-slate-100 hover:bg-slate-700"
      )}
    >
      {number}
    </button>
  );
}

function StatCard({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "warn" | "danger" }) {
  const tones = {
    default: "border-white/10 bg-white/5",
    good: "border-emerald-400/20 bg-emerald-500/10",
    warn: "border-amber-400/20 bg-amber-500/10",
    danger: "border-rose-400/20 bg-rose-500/10",
  };
  return (
    <div className={cls("rounded-2xl border p-4", tones[tone])}>
      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {sub ? <div className="mt-1 text-sm text-slate-400">{sub}</div> : null}
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [sequence, setSequence] = useState<SequenceState>(defaultSequence(defaultSettings));
  const [spins, setSpins] = useState<SpinEntry[]>([]);
  const [sessionNotes, setSessionNotes] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.settings) setSettings(parsed.settings);
      if (parsed.sequence) setSequence(parsed.sequence);
      if (parsed.spins) setSpins(parsed.spins);
      if (typeof parsed.sessionNotes === "string") setSessionNotes(parsed.sessionNotes);
    } catch {
      // ignore bad local state
    }
  }, []);

  useEffect(() => {
    const payload: PersistedState = { settings, sequence, spins, sessionNotes };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [settings, sequence, spins, sessionNotes]);

  useEffect(() => {
    setSequence((current) => {
      const nextScale = current.active
        ? current.recommendedNextScale
        : getRecommendedScale(current.openLosses, settings);
      return {
        ...current,
        currentScale: current.active ? current.currentScale : settings.baseScale,
        currentStake: current.active ? current.currentStake : 20 * settings.baseScale,
        recommendedNextScale: nextScale,
        recommendedNextStake: 20 * nextScale,
      };
    });
  }, [settings]);

  const recentSpins = useMemo(() => spins.slice(0, settings.triggerSettings.lookback), [spins, settings.triggerSettings.lookback]);

  const triggerSnapshot = useMemo(() => {
    const highHits = recentSpins.filter((spin) => spin.zone === "high").length;
    const lowHits = recentSpins.filter((spin) => spin.zone === "low").length;
    const lowMisses = recentSpins.length - lowHits;
    const uncoveredDrought = (() => {
      let count = 0;
      for (const spin of spins) {
        if (spin.zone === "low") break;
        count += 1;
      }
      return count;
    })();

    let colorStreak = 0;
    let streakColor: Color | null = null;
    for (const spin of spins) {
      if (spin.color === "green") break;
      if (!streakColor) {
        streakColor = spin.color;
        colorStreak = 1;
      } else if (spin.color === streakColor) {
        colorStreak += 1;
      } else {
        break;
      }
    }

    const settingsHit = {
      highHits: highHits >= settings.triggerSettings.minHighHits,
      lowMisses: lowMisses >= settings.triggerSettings.minLowMisses,
      drought: uncoveredDrought >= settings.triggerSettings.minUncoveredDrought,
      color:
        colorStreak >= settings.triggerSettings.minColorStreak &&
        (settings.triggerSettings.preferredColor === "any" || streakColor === settings.triggerSettings.preferredColor),
    };

    const readyCount = Object.values(settingsHit).filter(Boolean).length;

    return {
      highHits,
      lowHits,
      lowMisses,
      uncoveredDrought,
      colorStreak,
      streakColor,
      settingsHit,
      readyCount,
      recommendation:
        readyCount >= 3
          ? "Conditions look aligned for a manual entry review. This is a trigger assistant only, not a predictive edge."
          : "No strong trigger cluster yet. Keep tracking and wait for cleaner conditions.",
    };
  }, [recentSpins, settings.triggerSettings, spins]);

  const totalProfitUnits = useMemo(() => spins.reduce((sum, spin) => sum + spin.pnlUnits, 0), [spins]);
  const totalProfitCash = totalProfitUnits * settings.chipValue;
  const recommendedStakeCash = sequence.recommendedNextStake * settings.chipValue;
  const currentStakeCash = sequence.currentStake * settings.chipValue;
  const bankrollAfterRecommended = settings.bankroll - recommendedStakeCash;
  const exceedsBankroll = recommendedStakeCash > settings.bankroll;
  const exceedsTableMax = sequence.recommendedNextStake > settings.tableMaxStake;

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateTrigger<K extends keyof TriggerSettings>(key: K, value: TriggerSettings[K]) {
    setSettings((current) => ({
      ...current,
      triggerSettings: {
        ...current.triggerSettings,
        [key]: value,
      },
    }));
  }

  function resetSequence(overrideSettings = settings) {
    setSequence(defaultSequence(overrideSettings));
  }

  function handleSpin(number: number) {
    const ts = new Date().toISOString();
    const zone = getZone(number);
    const color = getColor(number);
    const dozen = getDozen(number);
    const column = getColumn(number);

    let pnlUnits = 0;
    let scaleUsed: number | null = null;
    let stakeUsed: number | null = null;
    let outcome: Outcome = "tracking-only";
    const notes: string[] = [];

    setSequence((current) => {
      if (!current.active) {
        notes.push("Tracked only — no James Bond sequence was active.");
        return current;
      }

      scaleUsed = current.currentScale;
      stakeUsed = current.currentStake;
      pnlUnits = getPnlUnits(number, current.currentScale);
      outcome = outcomeFor(number);

      if (zone === "low") {
        const nextOpenLosses = current.openLosses + current.currentStake;
        const nextScale = getRecommendedScale(nextOpenLosses, settings);
        notes.push("Uncovered 1–12 result. Loss added to open losses.");
        return {
          ...current,
          active: true,
          openLosses: nextOpenLosses,
          currentScale: nextScale,
          currentStake: 20 * nextScale,
          recommendedNextScale: nextScale,
          recommendedNextStake: 20 * nextScale,
          sequenceProfit: current.sequenceProfit + pnlUnits,
          sequenceSpinCount: current.sequenceSpinCount + 1,
        };
      }

      if (settings.resetMode === "partial-recovery") {
        const recoveredLosses = Math.max(0, current.openLosses - Math.max(0, pnlUnits));
        const nextScale = getRecommendedScale(recoveredLosses, settings);
        notes.push("Covered win in partial recovery mode.");
        return {
          ...current,
          active: recoveredLosses > 0,
          openLosses: recoveredLosses,
          currentScale: recoveredLosses > 0 ? nextScale : settings.baseScale,
          currentStake: recoveredLosses > 0 ? 20 * nextScale : 20 * settings.baseScale,
          recommendedNextScale: recoveredLosses > 0 ? nextScale : settings.baseScale,
          recommendedNextStake: recoveredLosses > 0 ? 20 * nextScale : 20 * settings.baseScale,
          sequenceProfit: current.sequenceProfit + pnlUnits,
          sequenceSpinCount: current.sequenceSpinCount + 1,
          startedAt: recoveredLosses > 0 ? current.startedAt : null,
        };
      }

      notes.push("Covered win. Sequence reset to base scale.");
      return {
        ...defaultSequence(settings),
        sequenceProfit: current.sequenceProfit + pnlUnits,
      };
    });

    const entry: SpinEntry = {
      id: crypto.randomUUID(),
      number,
      ts,
      color,
      zone,
      dozen,
      column,
      sequenceActive: sequence.active,
      scaleUsed,
      stakeUsed,
      pnlUnits,
      pnlCash: pnlUnits * settings.chipValue,
      outcome,
      notes,
    };

    setSpins((current) => [entry, ...current]);
  }

  function startSequence() {
    const scale = getRecommendedScale(sequence.openLosses, settings);
    setSequence((current) => ({
      ...current,
      active: true,
      currentScale: scale,
      currentStake: 20 * scale,
      recommendedNextScale: scale,
      recommendedNextStake: 20 * scale,
      startedAt: current.startedAt ?? new Date().toISOString(),
    }));
  }

  function clearSession() {
    setSpins([]);
    setSessionNotes("");
    resetSequence();
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-cyan-400/10 bg-gradient-to-br from-slate-900 via-slate-950 to-[#0d1528] p-6 shadow-2xl shadow-cyan-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Roulette Entry Assistant</div>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Live session tracker for European roulette and James Bond entry management.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Honest framing only: roulette is random, the house edge remains, and this tool does not predict outcomes. It exists to track recent spins, surface manual entry triggers, and calculate bankroll-aware James Bond progression stakes.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              <StatCard label="Mode" value="European only" sub="Single zero • 0–36 • no 00" tone="good" />
              <StatCard
                label="Recommended next stake"
                value={`${sequence.recommendedNextStake}u`}
                sub={currency(recommendedStakeCash)}
                tone={exceedsBankroll || exceedsTableMax ? "danger" : "warn"}
              />
            </div>
          </div>
          {(exceedsBankroll || exceedsTableMax) && (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              <strong className="font-semibold">Hard warning:</strong>{" "}
              {exceedsBankroll ? "The recommended next stake exceeds the bankroll setting. " : ""}
              {exceedsTableMax ? "The recommended next stake exceeds the table max setting." : ""}
            </div>
          )}
        </header>

        <nav className="mt-6 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cls(
                "rounded-full border px-4 py-2 text-sm transition",
                activeTab === tab.key
                  ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "dashboard" && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Live dashboard</h2>
                    <p className="mt-1 text-sm text-slate-400">Track recent spins, assess your manual trigger rules, then decide if and when to begin a sequence.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                    Trigger score: <span className="font-semibold text-white">{triggerSnapshot.readyCount}/4</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label={`19–36 hits in last ${settings.triggerSettings.lookback}`}
                    value={String(triggerSnapshot.highHits)}
                    sub={`Need ${settings.triggerSettings.minHighHits}+`}
                    tone={triggerSnapshot.settingsHit.highHits ? "good" : "default"}
                  />
                  <StatCard
                    label={`1–12 misses in last ${settings.triggerSettings.lookback}`}
                    value={String(triggerSnapshot.lowMisses)}
                    sub={`Need ${settings.triggerSettings.minLowMisses}+`}
                    tone={triggerSnapshot.settingsHit.lowMisses ? "good" : "default"}
                  />
                  <StatCard
                    label="Uncovered drought"
                    value={`${triggerSnapshot.uncoveredDrought} spins`}
                    sub={`Need ${settings.triggerSettings.minUncoveredDrought}+`}
                    tone={triggerSnapshot.settingsHit.drought ? "good" : "default"}
                  />
                  <StatCard
                    label="Current colour streak"
                    value={triggerSnapshot.streakColor ? `${triggerSnapshot.colorStreak} ${triggerSnapshot.streakColor}` : "0"}
                    sub={`Need ${settings.triggerSettings.minColorStreak}+`}
                    tone={triggerSnapshot.settingsHit.color ? "good" : "default"}
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-cyan-400/10 bg-cyan-500/5 p-4 text-sm leading-7 text-slate-200">
                  {triggerSnapshot.recommendation}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Current bankroll</div>
                    <div className="mt-2 text-xl font-semibold text-white">{currency(settings.bankroll)}</div>
                    <div className="mt-1 text-sm text-slate-400">After recommended stake: {currency(bankrollAfterRecommended)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Session P/L</div>
                    <div className={cls("mt-2 text-xl font-semibold", totalProfitUnits >= 0 ? "text-emerald-300" : "text-rose-300")}>
                      {totalProfitUnits >= 0 ? "+" : ""}
                      {totalProfitUnits}u
                    </div>
                    <div className="mt-1 text-sm text-slate-400">{currency(totalProfitCash)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Open losses</div>
                    <div className="mt-2 text-xl font-semibold text-white">{sequence.openLosses}u</div>
                    <div className="mt-1 text-sm text-slate-400">Recovery uses weakest covered win: +8 × scale</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Sequence state</div>
                    <div className="mt-2 text-xl font-semibold text-white">{sequence.active ? "Live" : "Idle"}</div>
                    <div className="mt-1 text-sm text-slate-400">{sequence.sequenceSpinCount} sequence spins logged</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Live spin entry console</h3>
                    <p className="text-sm text-slate-400">Tap numbers as they land. The app logs every result and only applies the James Bond maths if a sequence is active.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={startSequence}
                      className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      {sequence.active ? "Sequence active" : "Start / resume sequence"}
                    </button>
                    <button
                      onClick={() => resetSequence()}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                    >
                      Reset sequence
                    </button>
                    <button
                      onClick={clearSession}
                      className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 transition hover:bg-rose-500/15"
                    >
                      Clear session
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-6">
                  {Array.from({ length: 37 }, (_, i) => (
                    <NumberButton key={i} number={i} onClick={handleSpin} />
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Recent spins</h3>
                  <span className="text-sm text-slate-400">Newest first</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {spins.length === 0 ? (
                    <div className="text-sm text-slate-400">No spins logged yet.</div>
                  ) : (
                    spins.slice(0, 24).map((spin) => (
                      <div
                        key={spin.id}
                        className={cls(
                          "rounded-xl border px-3 py-2 text-sm",
                          spin.color === "green" && "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
                          spin.color === "red" && "border-rose-400/20 bg-rose-500/10 text-rose-100",
                          spin.color === "black" && "border-slate-500/30 bg-slate-900 text-slate-100"
                        )}
                      >
                        <div className="font-semibold">{spin.number}</div>
                        <div className="text-xs text-slate-300">{spin.zone}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-semibold text-white">James Bond calculator / progression panel</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <StatCard label="Current scale" value={`${sequence.currentScale}x`} sub={`Stake ${sequence.currentStake}u / ${currency(currentStakeCash)}`} />
                  <StatCard label="Next recommended scale" value={`${sequence.recommendedNextScale}x`} sub={`Stake ${sequence.recommendedNextStake}u / ${currency(recommendedStakeCash)}`} tone="warn" />
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-slate-500">19–36</div>
                      <div className="mt-1 text-base font-semibold text-white">{14 * sequence.recommendedNextScale}u</div>
                    </div>
                    <div>
                      <div className="text-slate-500">13–18</div>
                      <div className="mt-1 text-base font-semibold text-white">{5 * sequence.recommendedNextScale}u</div>
                    </div>
                    <div>
                      <div className="text-slate-500">0</div>
                      <div className="mt-1 text-base font-semibold text-white">{sequence.recommendedNextScale}u</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Total stake</div>
                      <div className="mt-1 text-base font-semibold text-white">{sequence.recommendedNextStake}u</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="font-medium text-white">Spin P/L at scale {sequence.recommendedNextScale}x</div>
                  <div className="flex items-center justify-between"><span>19–36 hit</span><span className="font-semibold text-emerald-300">+{8 * sequence.recommendedNextScale}u</span></div>
                  <div className="flex items-center justify-between"><span>13–18 hit</span><span className="font-semibold text-emerald-300">+{10 * sequence.recommendedNextScale}u</span></div>
                  <div className="flex items-center justify-between"><span>0 hit</span><span className="font-semibold text-emerald-300">+{16 * sequence.recommendedNextScale}u</span></div>
                  <div className="flex items-center justify-between"><span>1–12 hit</span><span className="font-semibold text-rose-300">-{20 * sequence.recommendedNextScale}u</span></div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-semibold text-white">Session notes</h3>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Example: waited for repeated high-zone pressure + black streak before entering."
                  className="mt-4 h-36 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500"
                />
              </div>
            </div>
          </section>
        )}

        {activeTab === "log" && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Spin log</h2>
                <p className="text-sm text-slate-400">Every spin is stored locally in your browser. No backend, no account, no cloud sync in v1.</p>
              </div>
              <div className="text-sm text-slate-400">{spins.length} total spins</div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-3">Time</th>
                    <th className="px-3 py-3">Number</th>
                    <th className="px-3 py-3">Zone</th>
                    <th className="px-3 py-3">Colour</th>
                    <th className="px-3 py-3">Scale</th>
                    <th className="px-3 py-3">Stake</th>
                    <th className="px-3 py-3">P/L (u)</th>
                    <th className="px-3 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {spins.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-slate-500" colSpan={8}>No spin data yet.</td>
                    </tr>
                  ) : (
                    spins.map((spin) => (
                      <tr key={spin.id} className="border-b border-white/5 text-slate-200">
                        <td className="px-3 py-3">{formatDate(spin.ts)}</td>
                        <td className="px-3 py-3 font-semibold text-white">{spin.number}</td>
                        <td className="px-3 py-3 uppercase">{spin.zone}</td>
                        <td className="px-3 py-3 capitalize">{spin.color}</td>
                        <td className="px-3 py-3">{spin.scaleUsed ?? "—"}</td>
                        <td className="px-3 py-3">{spin.stakeUsed ? `${spin.stakeUsed}u` : "—"}</td>
                        <td className={cls("px-3 py-3 font-semibold", spin.pnlUnits > 0 ? "text-emerald-300" : spin.pnlUnits < 0 ? "text-rose-300" : "text-slate-400")}>
                          {spin.pnlUnits > 0 ? "+" : ""}
                          {spin.pnlUnits}
                        </td>
                        <td className="px-3 py-3 text-slate-400">{spin.notes.join(" ") || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "triggers" && (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-xl font-semibold text-white">Trigger rules / settings</h2>
              <p className="mt-1 text-sm text-slate-400">These are visibility rules for your own entry judgement. They are not predictive signals.</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Lookback window</span>
                  <input type="number" min={3} max={50} value={settings.triggerSettings.lookback} onChange={(e) => updateTrigger("lookback", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Min 19–36 hits</span>
                  <input type="number" min={0} max={50} value={settings.triggerSettings.minHighHits} onChange={(e) => updateTrigger("minHighHits", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Min 1–12 misses</span>
                  <input type="number" min={0} max={50} value={settings.triggerSettings.minLowMisses} onChange={(e) => updateTrigger("minLowMisses", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Min uncovered drought</span>
                  <input type="number" min={0} max={50} value={settings.triggerSettings.minUncoveredDrought} onChange={(e) => updateTrigger("minUncoveredDrought", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Min colour streak</span>
                  <input type="number" min={0} max={20} value={settings.triggerSettings.minColorStreak} onChange={(e) => updateTrigger("minColorStreak", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Preferred colour</span>
                  <select value={settings.triggerSettings.preferredColor} onChange={(e) => updateTrigger("preferredColor", e.target.value as TriggerSettings["preferredColor"])} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2">
                    <option value="any">Any</option>
                    <option value="red">Red</option>
                    <option value="black">Black</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-xl font-semibold text-white">James Bond bankroll / progression settings</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Bankroll (£)</span>
                  <input type="number" min={1} value={settings.bankroll} onChange={(e) => updateSetting("bankroll", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Chip value (£ per unit)</span>
                  <input type="number" min={0.01} step="0.01" value={settings.chipValue} onChange={(e) => updateSetting("chipValue", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Base scale</span>
                  <input type="number" min={1} value={settings.baseScale} onChange={(e) => updateSetting("baseScale", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Target profit buffer (units)</span>
                  <input type="number" min={1} value={settings.targetProfitBuffer} onChange={(e) => updateSetting("targetProfitBuffer", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Table max stake (units)</span>
                  <input type="number" min={20} value={settings.tableMaxStake} onChange={(e) => updateSetting("tableMaxStake", Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Recovery mode</span>
                  <select value={settings.resetMode} onChange={(e) => updateSetting("resetMode", e.target.value as ResetMode)} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2">
                    <option value="reset-on-covered-win">Reset after any covered win</option>
                    <option value="partial-recovery">Partial recovery mode</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-50">
                Recovery formula: <code className="rounded bg-black/20 px-2 py-1">nextScale = max(baseScale, ceil((openLosses + targetProfitBuffer) / 8))</code>
              </div>
            </div>
          </section>
        )}

        {activeTab === "help" && (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-xl font-semibold text-white">Strategy / help</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                <p>
                  This prototype is a browser replacement for a live spreadsheet workflow. It is designed to help you watch recent outcomes, decide manually when you believe a trigger is present, and calculate the next James Bond stake safely relative to your configured bankroll.
                </p>
                <p>
                  It is <strong>not</strong> a claim of beating roulette. It does not predict spins, remove the house edge, or guarantee profit. European roulette remains random.
                </p>
                <p>
                  European-only coverage in v1:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-slate-300">
                  <li>Single zero only: 0–36</li>
                  <li>No American roulette / no 00 mode</li>
                  <li>Standard red / black, dozens, and columns</li>
                </ul>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-xl font-semibold text-white">James Bond layout summary</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="font-medium text-white">Standard 20-unit James Bond layout</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>14 units on 19–36</li>
                    <li>5 units on 13–18</li>
                    <li>1 unit on 0</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="font-medium text-white">At scale S</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>19–36 hit: +8 × S</li>
                    <li>13–18 hit: +10 × S</li>
                    <li>0 hit: +16 × S</li>
                    <li>1–12 hit: -20 × S</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-50">
                  Important: standard doubling is not enough here because the weakest covered win is only +8 × scale. That is why recovery must key off the weakest covered outcome, not a simple double.
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
