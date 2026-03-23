"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDefaultState, defaultRules, demoNumbers } from "@/lib/defaults";
import { createSequenceState, getJamesBondProfit, getRecoveryLadder, getStakeBreakdown, refreshSequence, resolveScaleForSettings } from "@/lib/progression";
import { getColour } from "@/lib/roulette";
import { downloadText, loadState, saveState, spinsToCsv } from "@/lib/storage";
import { buildSpinFromNumber, buildTrackerSnapshot } from "@/lib/triggers";
import { AppState, Spin, Status, TriggerRule } from "@/lib/types";

type View = "dashboard" | "log" | "settings" | "calculator" | "help";
type RawSpinDraft = { number: number; betTaken: boolean; createdAt?: string; notes?: string; triggerLabel?: string };

const navItems: { href: string; label: string; view: View }[] = [
  { href: "/", label: "Dashboard", view: "dashboard" },
  { href: "/log", label: "Log", view: "log" },
  { href: "/settings", label: "Settings", view: "settings" },
  { href: "/calculator", label: "Calculator", view: "calculator" },
  { href: "/help", label: "Help", view: "help" },
];

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function currency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value || 0);
}

function statusTone(status: Status) {
  if (status === "ENTER") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  if (status === "WATCH") return "border-amber-400/20 bg-amber-500/10 text-amber-50";
  return "border-white/10 bg-white/5 text-slate-200";
}

function numberTone(number: number) {
  const color = getColour(number);
  if (color === "green") return "border-emerald-400/20 bg-emerald-500/15 text-emerald-100";
  if (color === "red") return "border-rose-400/20 bg-rose-500/15 text-rose-100";
  return "border-slate-500/30 bg-slate-900 text-slate-100";
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SmallMetric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={cls("rounded-2xl border p-4", tone ?? "border-white/10 bg-slate-950/70")}>
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
      {sub ? <div className="mt-1 text-sm text-slate-400">{sub}</div> : null}
    </div>
  );
}

function MiniBarChart({ values, labels, colorClass }: { values: number[]; labels: string[]; colorClass: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {values.map((value, i) => (
        <div key={`${labels[i]}-${value}`} className="space-y-2">
          <div className="flex h-28 items-end rounded-xl border border-white/10 bg-slate-950/70 p-2">
            <div className={cls("w-full rounded-md", colorClass)} style={{ height: `${Math.max(8, (value / max) * 100)}%` }} />
          </div>
          <div className="text-center text-xs text-slate-400">{labels[i]}</div>
          <div className="text-center text-sm font-medium text-white">{value}</div>
        </div>
      ))}
    </div>
  );
}

function recomputeStateFromDrafts(baseState: AppState, drafts: RawSpinDraft[]) {
  let nextState: AppState = {
    ...baseState,
    spins: [],
    sequence: createSequenceState(baseState.settings),
  };

  for (const draft of drafts) {
    const { spin } = buildSpinFromNumber(
      draft.number,
      nextState.spins,
      nextState.rules,
      nextState.settings.minimumWatchScore,
      nextState.settings.minimumEntryScore
    );

    let finalSpin: Spin = {
      ...spin,
      createdAt: draft.createdAt ?? spin.createdAt,
      notes: draft.notes,
      triggerLabel: draft.triggerLabel,
    };

    if (draft.betTaken) {
      const breakdown = getStakeBreakdown(nextState.sequence.nextScale);
      const pnl = getJamesBondProfit(draft.number, nextState.sequence.nextScale);
      const covered = pnl > 0;
      const nextOpenLosses = covered
        ? nextState.settings.autoResetAfterCoveredWin
          ? 0
          : Math.max(0, nextState.sequence.openLosses - pnl)
        : nextState.sequence.openLosses + breakdown.totalStake;

      const refreshedBase = refreshSequence(nextOpenLosses, nextState.settings, {
        active: !covered || !nextState.settings.autoResetAfterCoveredWin,
        betsTaken: nextState.sequence.betsTaken + 1,
        wins: nextState.sequence.wins + (covered ? 1 : 0),
        losses: nextState.sequence.losses + (covered ? 0 : 1),
        runningPL: nextState.sequence.runningPL + pnl,
        currentLosingSequence: covered ? 0 : nextState.sequence.currentLosingSequence + 1,
        longestLosingSequence: covered
          ? nextState.sequence.longestLosingSequence
          : Math.max(nextState.sequence.longestLosingSequence, nextState.sequence.currentLosingSequence + 1),
      });

      const peak = Math.max(0, nextState.sequence.runningPL, refreshedBase.runningPL);
      const currentDrawdown = Math.max(0, peak - refreshedBase.runningPL);
      const refreshed = {
        ...refreshedBase,
        currentDrawdown,
        maxDrawdown: Math.max(nextState.sequence.maxDrawdown, currentDrawdown),
      };

      finalSpin = {
        ...finalSpin,
        betTaken: true,
        scaleUsed: nextState.sequence.nextScale,
        totalStake: breakdown.totalStake,
        stakeZero: breakdown.stakeZero,
        stakeMid: breakdown.stakeMid,
        stakeHigh: breakdown.stakeHigh,
        spinPL: pnl,
        runningPL: refreshed.runningPL,
        openLossesAfter: refreshed.openLosses,
      };

      nextState = {
        ...nextState,
        sequence: refreshed,
        spins: [finalSpin, ...nextState.spins],
      };
    } else {
      finalSpin = {
        ...finalSpin,
        betTaken: false,
        runningPL: nextState.sequence.runningPL,
        openLossesAfter: nextState.sequence.openLosses,
      };
      nextState = {
        ...nextState,
        spins: [finalSpin, ...nextState.spins],
      };
    }
  }

  return nextState;
}

export function RouletteApp({ view }: { view: View }) {
  const [state, setState] = useState<AppState>(() => loadState() ?? createDefaultState());
  const [editId, setEditId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState<number>(0);
  const [editBetTaken, setEditBetTaken] = useState<boolean>(false);
  const [manualBetTaken, setManualBetTaken] = useState(true);
  const [keyboardBuffer, setKeyboardBuffer] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const keyboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const tracker = useMemo(() => buildTrackerSnapshot(state.spins), [state.spins]);
  const lastSpin = state.spins[0];
  const scaleResolution = useMemo(() => resolveScaleForSettings(state.sequence.openLosses, state.settings), [state.sequence.openLosses, state.settings]);
  const nextBreakdown = useMemo(() => getStakeBreakdown(state.sequence.nextScale), [state.sequence.nextScale]);
  const nextStakeCash = nextBreakdown.totalStake * state.settings.chipValue;
  const bankrollRemaining = state.settings.bankroll - nextStakeCash;
  const exceedsBankroll = nextStakeCash > state.settings.bankroll;
  const exceedsTable = nextBreakdown.totalStake > state.settings.tableMaxStake;
  const safeStepEstimate = Math.max(0, Math.floor(state.settings.bankroll / Math.max(1, nextStakeCash)));

  const rawDrafts = useMemo<RawSpinDraft[]>(() => {
    const oldestFirst = [...state.spins].reverse();
    return oldestFirst.map((spin) => ({
      number: spin.number,
      betTaken: spin.betTaken,
      createdAt: spin.createdAt,
      notes: spin.notes,
      triggerLabel: spin.triggerLabel,
    }));
  }, [state.spins]);

  const zoneCounts = useMemo(() => {
    const source = state.spins.slice(0, 24);
    return {
      uncovered: source.filter((s) => s.jamesBondZone === "uncovered").length,
      mid: source.filter((s) => s.jamesBondZone === "mid").length,
      high: source.filter((s) => s.jamesBondZone === "high").length,
      zero: source.filter((s) => s.jamesBondZone === "zero").length,
    };
  }, [state.spins]);

  const pnlSeries = useMemo(() => state.spins.filter((s) => s.betTaken).slice(0, 12).reverse().map((s) => s.runningPL ?? 0), [state.spins]);
  const triggerSeries = useMemo(() => state.spins.slice(0, 12).reverse().map((s) => s.triggerScore), [state.spins]);
  const recoveryLadder = useMemo(() => getRecoveryLadder(state.settings, state.sequence.openLosses, 6), [state.settings, state.sequence.openLosses]);

  const commitSpin = useCallback((number: number, betTaken = manualBetTaken) => {
    if (number < 0 || number > 36) return;
    const nextDrafts = [...rawDrafts, { number, betTaken }];
    setState((current) => recomputeStateFromDrafts({ ...current }, nextDrafts));
  }, [manualBetTaken, rawDrafts]);

  const undoLastSpin = useCallback(() => {
    const nextDrafts = rawDrafts.slice(0, -1);
    setState((current) => recomputeStateFromDrafts({ ...current }, nextDrafts));
  }, [rawDrafts]);

  function clearKeyboardTimer() {
    if (keyboardTimerRef.current) {
      clearTimeout(keyboardTimerRef.current);
      keyboardTimerRef.current = null;
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "Backspace") {
        event.preventDefault();
        if (keyboardBuffer) {
          setKeyboardBuffer((value) => value.slice(0, -1));
        } else {
          undoLastSpin();
        }
        return;
      }
      if (event.key === "Enter") {
        if (keyboardBuffer === "") return;
        const parsed = Number(keyboardBuffer);
        setKeyboardBuffer("");
        clearKeyboardTimer();
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 36) commitSpin(parsed);
        return;
      }
      if (event.key.toLowerCase() === "b") {
        setManualBetTaken((v) => !v);
        return;
      }
      if (/^[0-9]$/.test(event.key)) {
        const next = `${keyboardBuffer}${event.key}`;
        if (Number(next) > 36) {
          const single = Number(event.key);
          setKeyboardBuffer("");
          clearKeyboardTimer();
          commitSpin(single);
          return;
        }
        setKeyboardBuffer(next);
        clearKeyboardTimer();
        keyboardTimerRef.current = setTimeout(() => {
          const parsed = Number(next);
          setKeyboardBuffer("");
          if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 36) commitSpin(parsed);
        }, 800);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearKeyboardTimer();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [keyboardBuffer, commitSpin, undoLastSpin]);

  function clearSession() {
    if (!window.confirm("Clear the whole session? This will remove local spin history for this prototype.")) return;
    setState((current) => ({ ...current, spins: [], sequence: createSequenceState(current.settings), sessionNotes: "" }));
  }

  function seedDemo() {
    const nextDrafts = demoNumbers.map((number) => ({ number, betTaken: false }));
    const seeded = recomputeStateFromDrafts({ ...createDefaultState(), settings: state.settings, rules: state.rules, sessionNotes: state.sessionNotes }, nextDrafts);
    setState(seeded);
  }

  function updateRule(ruleId: string, patch: Partial<TriggerRule>) {
    setState((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    }));
  }

  function exportJson() {
    downloadText("bond-roulette-session.json", JSON.stringify(state, null, 2), "application/json");
  }

  function exportCsv() {
    downloadText("bond-roulette-spins.csv", spinsToCsv([...state.spins].reverse()), "text/csv;charset=utf-8");
  }

  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState;
        setState(parsed);
      } catch {
        window.alert("Invalid JSON backup file.");
      }
    };
    reader.readAsText(file);
  }

  function toggleBetForSpin(spinId: string) {
    const nextDrafts = rawDrafts.map((draft, index) => {
      const spin = [...state.spins].reverse()[index];
      return spin.id === spinId ? { ...draft, betTaken: !draft.betTaken } : draft;
    });
    setState((current) => recomputeStateFromDrafts({ ...current }, nextDrafts));
  }

  function openEdit(spinId: string) {
    const target = state.spins.find((spin) => spin.id === spinId);
    if (!target) return;
    setEditId(spinId);
    setEditNumber(target.number);
    setEditBetTaken(target.betTaken);
  }

  function saveEdit() {
    if (!editId) return;
    const reversed = [...state.spins].reverse();
    const nextDrafts = reversed.map((spin) =>
      spin.id === editId
        ? { number: editNumber, betTaken: editBetTaken, createdAt: spin.createdAt, notes: spin.notes, triggerLabel: spin.triggerLabel }
        : { number: spin.number, betTaken: spin.betTaken, createdAt: spin.createdAt, notes: spin.notes, triggerLabel: spin.triggerLabel }
    );
    setState((current) => recomputeStateFromDrafts({ ...current }, nextDrafts));
    setEditId(null);
  }

  const triggerReasons = lastSpin?.triggerReasons ?? [];

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-cyan-400/10 bg-gradient-to-br from-slate-900 via-slate-950 to-[#0d1528] p-6 shadow-2xl shadow-cyan-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Roulette Entry Assistant</div>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Live trigger tracker and James Bond staking console for European roulette.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Honest framing only. This is a rule-based session aid for tracking spins, trigger visibility, and bankroll-aware progression. It does not predict outcomes, remove the house edge, or guarantee a profit.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={cls("rounded-full border px-4 py-2 text-sm transition", view === item.view ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={seedDemo} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Load demo session</button>
          <button onClick={exportJson} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10">Export JSON</button>
          <button onClick={exportCsv} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10">Export CSV</button>
          <button onClick={() => fileRef.current?.click()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10">Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importJson} />
        </div>

        {view === "dashboard" && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div className="space-y-6">
              <Card title="Recent spins strip" right={<div className={cls("rounded-full border px-4 py-2 text-sm", statusTone(lastSpin?.status ?? "WAIT"))}>{lastSpin?.status ?? "WAIT"}</div>}>
                <div className="flex flex-wrap gap-2">
                  {state.spins.slice(0, 20).map((spin) => (
                    <div key={spin.id} className={cls("rounded-xl border px-3 py-2 text-sm font-semibold", numberTone(spin.number))}>{spin.number}</div>
                  ))}
                  {state.spins.length === 0 && <div className="text-sm text-slate-400">No spins logged yet.</div>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    <input type="checkbox" checked={manualBetTaken} onChange={(e) => setManualBetTaken(e.target.checked)} />
                    Bet taken on next spin
                  </label>
                  <button onClick={undoLastSpin} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10">Undo last</button>
                  <button onClick={clearSession} className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 hover:bg-rose-500/15">Clear session</button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-6">
                  {Array.from({ length: 37 }, (_, n) => (
                    <button key={n} onClick={() => commitSpin(n)} className={cls("rounded-xl border px-3 py-3 text-sm font-semibold transition hover:scale-[1.02]", numberTone(n))}>{n}</button>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
                  Keyboard: type 0–36, then <strong className="text-slate-200">Enter</strong> — or pause briefly to auto-submit. <strong className="text-slate-200">Backspace</strong> edits the buffer or undoes the last spin. <strong className="text-slate-200">B</strong> toggles bet taken. Current buffer: <span className="text-cyan-300">{keyboardBuffer || "—"}</span>
                </div>
              </Card>

              <Card title="Live signal cards">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <SmallMetric label="Colour streak" value={`R ${tracker.currentRedStreak} / B ${tracker.currentBlackStreak}`} />
                  <SmallMetric label="Odd / even streak" value={`O ${tracker.currentOddStreak} / E ${tracker.currentEvenStreak}`} />
                  <SmallMetric label="High / low streak" value={`H ${tracker.currentHighStreak} / L ${tracker.currentLowStreak}`} />
                  <SmallMetric label="Dozen absence" value={`D1 ${tracker.spinsSinceDozen1} • D2 ${tracker.spinsSinceDozen2} • D3 ${tracker.spinsSinceDozen3}`} />
                  <SmallMetric label="Column absence" value={`C1 ${tracker.spinsSinceColumn1} • C2 ${tracker.spinsSinceColumn2} • C3 ${tracker.spinsSinceColumn3}`} />
                  <SmallMetric label="Zero gap" value={`${tracker.spinsSinceZero} spins`} />
                </div>
              </Card>

              <Card title="Main entry decision card">
                <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                  <div className={cls("rounded-2xl border p-5", statusTone(lastSpin?.status ?? "WAIT"))}>
                    <div className="text-xs uppercase tracking-[0.2em]">Composite score</div>
                    <div className="mt-2 text-4xl font-semibold">{lastSpin?.triggerScore ?? 0}</div>
                    <div className="mt-2 text-sm">Watch at {state.settings.minimumWatchScore} • Enter at {state.settings.minimumEntryScore}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="text-sm font-medium text-white">Trigger breakdown</div>
                    {triggerReasons.length === 0 ? (
                      <div className="mt-2 text-sm text-slate-400">No active trigger reasons on the latest spin snapshot.</div>
                    ) : (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                        {triggerReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Card>

              <Card title="Mini charts">
                <div className="grid gap-6 xl:grid-cols-2">
                  <div>
                    <div className="mb-3 text-sm font-medium text-white">Recent zone distribution</div>
                    <MiniBarChart values={[zoneCounts.uncovered, zoneCounts.mid, zoneCounts.high, zoneCounts.zero]} labels={["1–12", "13–18", "19–36", "0"]} colorClass="bg-cyan-400/80" />
                  </div>
                  <div>
                    <div className="mb-3 text-sm font-medium text-white">Recent trigger scores</div>
                    <MiniBarChart values={triggerSeries.length ? triggerSeries : [0]} labels={triggerSeries.length ? triggerSeries.map((_, i) => String(i + 1)) : ["—"]} colorClass="bg-amber-400/80" />
                  </div>
                </div>
                <div className="mt-6">
                  <div className="mb-3 text-sm font-medium text-white">Running P/L over taken bets</div>
                  <MiniBarChart values={pnlSeries.length ? pnlSeries.map((v) => Math.abs(v)) : [0]} labels={pnlSeries.length ? pnlSeries.map((_, i) => `B${i + 1}`) : ["—"]} colorClass="bg-emerald-400/80" />
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card title="Progression card">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <SmallMetric label="Base scale" value={`${state.settings.baseScale}x`} />
                  <SmallMetric label="Minimum recovery scale" value={`${scaleResolution.minimumRecoveryScale}x`} tone="border-cyan-400/20 bg-cyan-500/10" />
                  <SmallMetric label="Active next scale" value={`${state.sequence.nextScale}x`} tone="border-amber-400/20 bg-amber-500/10" sub={state.settings.stakeSizingMode === "customTotalStake" ? `Custom stake target: ${state.settings.customTotalStake}u` : "Using minimum recovery sizing"} />
                  <SmallMetric label="Minimum total needed" value={`${20 * scaleResolution.minimumRecoveryScale}u`} sub={currency(20 * scaleResolution.minimumRecoveryScale * state.settings.chipValue)} />
                  <SmallMetric label="Next total stake" value={`${nextBreakdown.totalStake}u`} sub={currency(nextStakeCash)} tone={scaleResolution.customStakeTooLow ? "border-rose-400/20 bg-rose-500/10" : undefined} />
                  <SmallMetric label="Stake split" value={`0:${nextBreakdown.stakeZero} • 13–18:${nextBreakdown.stakeMid} • 19–36:${nextBreakdown.stakeHigh}`} />
                  <SmallMetric label="Open losses" value={`${state.sequence.openLosses}u`} />
                  <SmallMetric label="Target buffer" value={`${state.settings.targetProfitBuffer}u`} />
                </div>
                {scaleResolution.customStakeTooLow && (
                  <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                    Custom total stake is below the minimum recovery amount. The tool has raised the active next stake to the minimum needed to cover current open losses plus buffer.
                  </div>
                )}
              </Card>

              <Card title="Safety card">
                <div className="grid gap-3">
                  <SmallMetric label="Bankroll remaining after next stake" value={currency(bankrollRemaining)} tone={exceedsBankroll ? "border-rose-400/20 bg-rose-500/10" : undefined} />
                  <SmallMetric label="Next exposure" value={`${nextBreakdown.totalStake}u`} sub={currency(nextStakeCash)} tone={exceedsTable ? "border-rose-400/20 bg-rose-500/10" : undefined} />
                  <SmallMetric label="Max safe steps estimate" value={String(safeStepEstimate)} sub="Very rough stake-based estimate only" />
                </div>
              </Card>

              <Card title="Session P/L card">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <SmallMetric label="Bets taken" value={String(state.sequence.betsTaken)} />
                  <SmallMetric label="Wins / losses" value={`${state.sequence.wins} / ${state.sequence.losses}`} />
                  <SmallMetric label="Net session P/L" value={`${state.sequence.runningPL >= 0 ? "+" : ""}${state.sequence.runningPL}u`} sub={currency(state.sequence.runningPL * state.settings.chipValue)} tone={state.sequence.runningPL >= 0 ? "border-emerald-400/20 bg-emerald-500/10" : "border-rose-400/20 bg-rose-500/10"} />
                  <SmallMetric label="Current drawdown" value={`${state.sequence.currentDrawdown}u`} />
                  <SmallMetric label="Longest losing sequence" value={String(state.sequence.longestLosingSequence)} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {view === "log" && (
          <div className="mt-6 space-y-6">
            <Card title="Full spin log">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-400">
                    <tr className="border-b border-white/10">
                      {["#", "Result", "Colour", "Parity", "Range", "Dozen", "Column", "Bond zone", "Score", "Status", "Bet", "Scale", "Stake", "P/L", "Open losses", "Reasons", "Actions"].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {state.spins.map((spin) => (
                      <tr key={spin.id} className="border-b border-white/5 align-top">
                        <td className="px-3 py-3 text-slate-400">{spin.index}</td>
                        <td className="px-3 py-3 font-semibold text-white">{spin.number}</td>
                        <td className="px-3 py-3 capitalize">{spin.colour}</td>
                        <td className="px-3 py-3 capitalize">{spin.parity}</td>
                        <td className="px-3 py-3 capitalize">{spin.rangeBand}</td>
                        <td className="px-3 py-3">{spin.dozen}</td>
                        <td className="px-3 py-3">{spin.column}</td>
                        <td className="px-3 py-3 capitalize">{spin.jamesBondZone}</td>
                        <td className="px-3 py-3">{spin.triggerScore}</td>
                        <td className="px-3 py-3"><span className={cls("rounded-full border px-2 py-1 text-xs", statusTone(spin.status))}>{spin.status}</span></td>
                        <td className="px-3 py-3">{spin.betTaken ? "Yes" : "No"}</td>
                        <td className="px-3 py-3">{spin.scaleUsed ?? "—"}</td>
                        <td className="px-3 py-3">{spin.totalStake ?? "—"}</td>
                        <td className="px-3 py-3">{spin.spinPL ?? "—"}</td>
                        <td className="px-3 py-3">{spin.openLossesAfter ?? "—"}</td>
                        <td className="px-3 py-3 text-slate-400">{spin.triggerReasons.join("; ")}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-2">
                            <button onClick={() => toggleBetForSpin(spin.id)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">Toggle bet</button>
                            <button onClick={() => openEdit(spin.id)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">Edit / recalc</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {editId && (
              <Card title="Edit prior spin and recalculate forward">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Result number</span>
                    <input type="number" min={0} max={36} value={editNumber} onChange={(e) => setEditNumber(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">
                    <input type="checkbox" checked={editBetTaken} onChange={(e) => setEditBetTaken(e.target.checked)} />
                    Bet taken on this spin
                  </label>
                  <div className="flex items-end gap-2">
                    <button onClick={saveEdit} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Save + recalc</button>
                    <button onClick={() => setEditId(null)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10">Cancel</button>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-400">This recalculates trigger scores, bet sizing, open losses, and running P/L from that point onward.</div>
              </Card>
            )}
          </div>
        )}

        {view === "settings" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Session settings">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Bankroll", state.settings.bankroll, (v: number) => setState((c) => ({ ...c, settings: { ...c.settings, bankroll: v } }))],
                  ["Chip value", state.settings.chipValue, (v: number) => setState((c) => ({ ...c, settings: { ...c.settings, chipValue: v } }))],
                  ["Table max stake", state.settings.tableMaxStake, (v: number) => setState((c) => ({ ...c, settings: { ...c.settings, tableMaxStake: v } }))],
                  ["Base scale", state.settings.baseScale, (v: number) => setState((c) => ({ ...c, settings: { ...c.settings, baseScale: v } }))],
                  ["Target profit buffer", state.settings.targetProfitBuffer, (v: number) => setState((c) => ({ ...c, settings: { ...c.settings, targetProfitBuffer: v } }))],
                  ["Watch score", state.settings.minimumWatchScore, (v: number) => setState((c) => ({ ...c, settings: { ...c.settings, minimumWatchScore: v } }))],
                  ["Entry score", state.settings.minimumEntryScore, (v: number) => setState((c) => ({ ...c, settings: { ...c.settings, minimumEntryScore: v } }))],
                  ["Custom total stake", state.settings.customTotalStake, (v: number) => setState((c) => ({ ...c, settings: { ...c.settings, customTotalStake: v } }))],
                ].map(([label, value, setter]) => (
                  <label key={String(label)} className="space-y-2 text-sm text-slate-300">
                    <span>{String(label)}</span>
                    <input type="number" value={Number(value)} onChange={(e) => (setter as (v: number) => void)(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2" />
                  </label>
                ))}
                <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">
                  <input type="checkbox" checked={state.settings.autoResetAfterCoveredWin} onChange={(e) => setState((c) => ({ ...c, settings: { ...c.settings, autoResetAfterCoveredWin: e.target.checked } }))} />
                  Auto-reset after covered win
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Stake sizing mode</span>
                  <select value={state.settings.stakeSizingMode} onChange={(e) => setState((c) => ({ ...c, settings: { ...c.settings, stakeSizingMode: e.target.value as "scale" | "customTotalStake" } }))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2">
                    <option value="scale">Scale / minimum recovery mode</option>
                    <option value="customTotalStake">Custom total stake mode</option>
                  </select>
                </label>
              </div>
            </Card>

            <Card title="Trigger rules">
              <div className="space-y-3">
                {state.rules.map((rule) => (
                  <div key={rule.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 md:grid-cols-[1.6fr_120px_120px_120px] md:items-center">
                    <div>
                      <div className="font-medium text-white">{rule.label}</div>
                      <div className="text-xs text-slate-500">{rule.category}{rule.target ? ` • target ${rule.target}` : ""}</div>
                    </div>
                    <label className="text-sm text-slate-300">Threshold
                      <input type="number" value={rule.threshold} onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2" />
                    </label>
                    <label className="text-sm text-slate-300">Weight
                      <input type="number" value={rule.weight} onChange={(e) => updateRule(rule.id, { weight: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2" />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={rule.enabled} onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })} />
                      Enabled
                    </label>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setState((c) => ({ ...c, rules: defaultRules }))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10">Reset rules to defaults</button>
              </div>
            </Card>
          </div>
        )}

        {view === "calculator" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="James Bond calculator panel">
              <div className="grid gap-3 sm:grid-cols-2">
                <SmallMetric label="Base scale" value={`${state.settings.baseScale}x`} />
                <SmallMetric label="Current open losses" value={`${state.sequence.openLosses}u`} />
                <SmallMetric label="Target profit buffer" value={`${state.settings.targetProfitBuffer}u`} />
                <SmallMetric label="Sizing mode" value={state.settings.stakeSizingMode === "customTotalStake" ? "Custom total stake" : "Scale / minimum recovery"} />
                <SmallMetric label="Minimum scale needed" value={`${scaleResolution.minimumRecoveryScale}x`} tone="border-cyan-400/20 bg-cyan-500/10" />
                <SmallMetric label="Next scale actually used" value={`${state.sequence.nextScale}x`} tone="border-amber-400/20 bg-amber-500/10" />
                <SmallMetric label="Minimum total next stake" value={`${20 * scaleResolution.minimumRecoveryScale}u`} sub={currency(20 * scaleResolution.minimumRecoveryScale * state.settings.chipValue)} />
                <SmallMetric label="Total next stake" value={`${nextBreakdown.totalStake}u`} sub={currency(nextStakeCash)} />
                <SmallMetric label="Stake split" value={`0:${nextBreakdown.stakeZero} / 13–18:${nextBreakdown.stakeMid} / 19–36:${nextBreakdown.stakeHigh}`} />
                <SmallMetric label="Worst covered win" value={`+${nextBreakdown.worstCoveredWinProfit}u`} />
                <SmallMetric label="Best covered win" value={`+${nextBreakdown.bestCoveredWinProfit}u`} />
                <SmallMetric label="Uncovered loss" value={`-${nextBreakdown.uncoveredLossAmount}u`} />
                <SmallMetric label="Bankroll warning" value={exceedsBankroll ? "Yes" : "No"} tone={exceedsBankroll ? "border-rose-400/20 bg-rose-500/10" : undefined} />
                <SmallMetric label="Table limit warning" value={exceedsTable ? "Yes" : "No"} tone={exceedsTable ? "border-rose-400/20 bg-rose-500/10" : undefined} />
              </div>
              {scaleResolution.customStakeTooLow && (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                  The custom stake target is too small to cover the current open losses. Active stake has been lifted to the minimum recovery amount.
                </div>
              )}
            </Card>
            <Card title="Recovery ladder">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-400">
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-3">Step</th>
                      <th className="px-3 py-3">Open losses before</th>
                      <th className="px-3 py-3">Min scale</th>
                      <th className="px-3 py-3">Stake used</th>
                      <th className="px-3 py-3">Worst covered win</th>
                      <th className="px-3 py-3">Lose again</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recoveryLadder.map((row) => (
                      <tr key={row.lossStep} className="border-b border-white/5">
                        <td className="px-3 py-3 text-white">{row.lossStep}</td>
                        <td className="px-3 py-3">{row.openLossesBefore}u</td>
                        <td className="px-3 py-3">{row.minimumScaleNeeded}x</td>
                        <td className="px-3 py-3">{row.totalStake}u / {currency(row.totalStake * state.settings.chipValue)}</td>
                        <td className="px-3 py-3 text-emerald-300">+{row.worstCoveredWinProfit}u</td>
                        <td className="px-3 py-3 text-rose-300">{row.openLossesIfLostAgain}u open losses</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-50">
                <code>nextScale = max(baseScale, ceil((openLosses + targetProfitBuffer) / 8))</code>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <p>The divisor is 8 because the weakest covered James Bond win is only +8 × scale.</p>
                <p>This is a tracking and staking calculator only. It does not imply that roulette outcomes become due or predictable.</p>
              </div>
            </Card>
          </div>
        )}

        {view === "help" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Help / explanation">
              <div className="space-y-3 text-sm leading-7 text-slate-300">
                <p>European roulette only: single zero, 0–36, no American 00 mode.</p>
                <p>James Bond split: 14 units on 19–36, 5 units on 13–18, 1 unit on 0.</p>
                <p>The entry score is a rule-based trigger summary. It is not probability, AI prediction, or a claim of advantage.</p>
                <p>The recovery model uses the weakest covered win to size the next scale, because simple doubling is not enough for this layout.</p>
                <p>The house edge remains. You are still responsible for all betting decisions.</p>
              </div>
            </Card>
            <Card title="Limitations / v1 scope">
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                <li>No backend, no auth, no payments, no live casino integration.</li>
                <li>Client-side local storage only.</li>
                <li>No machine learning, OCR, auto-betting, or claims of predictive power.</li>
                <li>Charts are intentionally small and secondary in this prototype.</li>
              </ul>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
