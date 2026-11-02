
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Lock,
  Shield,
  Swords,
  Share2,
  RotateCcw,
  Trophy,
  Info,
  ChevronRight,
} from "lucide-react";

import { BOWLERS, TEAMS, bowlerById } from "../lib/simulation/players";
import { legalBowlers, MAX_OVERS_PER_BOWLER } from "../lib/simulation/engine";
import { requiredRate } from "../lib/simulation/model";
import type { Strategy } from "../lib/simulation/types";
import {
  optionsFor,
  replay,
  sessionSummary,
  type Resolution,
} from "../lib/scoring";
import { overSeed } from "../lib/simulation/random";
import { buildPayload, LANGS, sectionsSchema, type Lang } from "../lib/ai/prompt";
import { fallbackSections } from "../lib/ai/fallback";
import { loadSession, newSession, saveSession, type Session } from "../lib/storage";

const LANG_LABEL: Record<Lang, string> = {
  english: "English",
  hinglish: "Hinglish",
  beginner: "Beginner",
};

const btn =
  "rounded-xl px-5 py-3 font-bold transition focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed";

const primary = `${btn} bg-lime text-black hover:brightness-110`;
const ghost = `${btn} border border-edge text-white hover:bg-panel`;

function Bar({
  label,
  v,
  max,
}: {
  label: string;
  v: number;
  max: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-mute">{label}</span>
        <b>
          {v.toFixed(1)} / {max}
        </b>
      </div>

      <div
        className="mt-1 h-2 rounded bg-edge"
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemax={max}
      >
        <div
          className="h-2 rounded bg-lime"
          style={{ width: `${(v / max) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function Game() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [strat, setStrat] = useState<Strategy>("DEFEND");
  const [confirming, setConfirming] = useState(false);
  const [shown, setShown] = useState(0);
  const [msg, setMsg] = useState("");
  const [shareText, setShareText] = useState("");
  const [about, setAbout] = useState(false);

  const fetching = useRef<number | null>(null);

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
  }, []);

  const update = useCallback(
    (fn: (s: Session) => Session) =>
      setSession((p) => {
        if (!p) return p;
        const n = fn(p);
        saveSession(n);
        return n;
      }),
    []
  );

  const { state, resolutions } = useMemo(
    () =>
      session
        ? replay(session.seed, session.decisions)
        : { state: null, resolutions: [] as Resolution[] },
    [session]
  );

  const last = resolutions[resolutions.length - 1];
  const step = session?.step;

  // Ball-by-ball reveal
  useEffect(() => {
    if (step !== "sim" || !last) return;

    setShown(0);

    const id = setInterval(
      () =>
        setShown((n) => {
          if (n >= last.fan.result.balls.length) {
            clearInterval(id);
            return n;
          }
          return n + 1;
        }),
      650
    );

    return () => clearInterval(id);
  }, [step, last]);

  // AI explanation (falls back deterministically)
  useEffect(() => {
    if (step !== "analysis" || !last || !session || session.ai[last.over]) {
      return;
    }

    if (fetching.current === last.over) return;

    fetching.current = last.over;
    const payload = buildPayload(last, session.lang);

    (async () => {
      let out: {
        sections: ReturnType<typeof fallbackSections>;
        source: "ai" | "fallback";
      };

      try {
        const res = await fetch("/api/analyze-decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const j = await res.json();

        out = {
          sections: sectionsSchema.parse(j.sections),
          source: j.source === "ai" ? "ai" : "fallback",
        };
      } catch {
        out = {
          sections: fallbackSections(payload),
          source: "fallback",
        };
      }

      update((s) => ({
        ...s,
        ai: { ...s.ai, [last.over]: out },
      }));

      fetching.current = null;
    })();
  }, [step, last, session, update]);

  if (!ready) {
    return <main className="p-10 text-mute">Loading…</main>;
  }

  const start = () => {
    const s = newSession(session?.lang ?? "english");
    saveSession(s);
    setSession(s);
    setPick(null);
    setConfirming(false);
    setMsg("");
    setShareText("");
  };

  const restart = () => {
    saveSession(null);
    setSession(null);
    setPick(null);
    setConfirming(false);
    setMsg("");
    setShareText("");
  };

  const lock = () => {
    if (
      !session ||
      !state ||
      !pick ||
      session.step !== "decide" ||
      session.decisions.length !== state.overIndex
    ) {
      return;
    }

    const receipt = {
      id: `AC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      over: state.overIndex + 1,
      bowler: bowlerById(pick).name,
      strategy: strat,
      score: `${state.runs}/${state.wickets}`,
      seed: overSeed(session.seed, state.overIndex),
      at: new Date().toISOString(),
    };

    update((s) => ({
      ...s,
      step: "reveal",
      decisions: [
        ...s.decisions,
        { bowlerId: pick, strategy: strat, receipt },
      ],
    }));

    setConfirming(false);
    setPick(null);
  };

  const next = () =>
    update((s) => ({
      ...s,
      step: replay(s.seed, s.decisions).state.done ? "final" : "decide",
    }));

  const summary =
    resolutions.length && step === "final"
      ? sessionSummary(resolutions)
      : null;

  // Share Captaincy IQ
  const share = async () => {
    if (!summary || !state) return;

    const text = `🏏 ARMCHAIR CAPTAIN

My Captaincy IQ: ${Math.round(summary.iq)}/100
Rank: ${summary.label}

Tactical Judgement: ${summary.tactical.toFixed(1)}/50
Execution Outcome: ${summary.outcome.toFixed(1)}/30
Captain Comparison: ${summary.comparison.toFixed(1)}/20

${TEAMS.batting} ${state.runs}/${state.wickets} vs target ${state.target}
Overs played: ${resolutions.length}
Outperformed benchmark tactically: ${summary.beatCaptain}/${resolutions.length}

Can you captain better than me?
Aap hote toh?`;

    setShareText(text);
    setMsg("");

    // 1. Try native sharing
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title: "Armchair Captain",
          text,
        });

        setMsg("Result shared successfully!");
        return;
      } catch (error) {
        // User cancelled the share menu
        if (error instanceof Error && error.name === "AbortError") {
          setMsg("Sharing cancelled.");
          return;
        }

        // For other errors, continue to clipboard fallback
      }
    }

    // 2. Try clipboard
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(text);
        setMsg("Result copied to clipboard!");
        return;
      }
    } catch {
      // Continue to manual copy fallback
    }

    // 3. Manual copy fallback
    setMsg(
      "Automatic sharing unavailable. Select and copy your result below."
    );
  };

  const Header = (
    <header className="flex items-center justify-between gap-3 py-4">
      <button
        onClick={() => (session ? null : null)}
        className="display text-xl font-extrabold tracking-wide"
        aria-label="Armchair Captain"
      >
        ARMCHAIR <span className="text-lime">CAPTAIN</span>
      </button>

      <div className="flex items-center gap-2">
        {session && (
          <select
            aria-label="Explanation language"
            value={session.lang}
            onChange={(e) =>
              update((s) => ({
                ...s,
                lang: e.target.value as Lang,
                ai: {},
              }))
            }
            className="rounded-lg border border-edge bg-panel px-2 py-1 text-sm"
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_LABEL[l]}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => setAbout((a) => !a)}
          className="rounded-lg border border-edge p-2"
          aria-label="How it works"
          aria-expanded={about}
        >
          <Info size={16} />
        </button>
      </div>
    </header>
  );

  const About = about && (
    <section className="mb-4 rounded-2xl border border-edge bg-panel p-4 text-sm text-mute pop">
      <b className="text-white">About this simulation.</b> All players and teams
      are fictional. The match is simulated with a seeded model, so the same
      seed and calls give the same result. The captain is a rule-based benchmark
      policy, not a real captain. Captaincy IQ is a prototype metric, not a
      measure of cricket expertise. AI only explains facts produced by the
      engine; it never sets scores. A production version could use licensed live
      data and server-side decision records. Not connected to Dream11 or any
      live match.
    </section>
  );

  // Landing page
  if (!session || !state) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-16">
        {Header}
        {About}

        <section className="pt-10 sm:pt-20">
          <p className="text-mute">Aap hote toh?</p>

          <h1 className="display mt-2 text-5xl font-extrabold leading-[0.95] sm:text-7xl">
            Every fan has a captain inside.
          </h1>

          <p className="mt-5 max-w-xl text-lg text-mute">
            Four overs. Four decisions. Can you outthink the captain?
          </p>

          <button
            onClick={start}
            className={`${primary} mt-8 text-lg`}
          >
            TAKE THE CAPTAIN&apos;S SEAT
          </button>

          <ol className="mt-12 grid gap-3 text-sm text-mute sm:grid-cols-3">
            <li className="rounded-2xl border border-edge p-4">
              <b className="text-white">Pick</b> a bowler and a strategy for
              each over of a 27-run chase.
            </li>

            <li className="rounded-2xl border border-edge p-4">
              <b className="text-white">Lock</b> your call before the benchmark
              captain is revealed.
            </li>

            <li className="rounded-2xl border border-edge p-4">
              <b className="text-white">Learn</b> from three separate scores
              and a plain-language breakdown.
            </li>
          </ol>
        </section>
      </main>
    );
  }

  const rr = requiredRate(state);
  const opts = optionsFor(state);
  const legalIds = new Set(legalBowlers(state).map((b) => b.id));

  const Scoreboard = (s = state) => (
    <section className="rounded-2xl border border-edge bg-panel p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-mute">
          {TEAMS.batting} chasing {s.target}
        </span>
        <span className="text-sm text-mute">vs {TEAMS.bowling}</span>
      </div>

      <div className="display mt-1 text-5xl font-extrabold">
        {s.runs}/{s.wickets}{" "}
        <span className="text-xl font-semibold text-mute">
          ({Math.floor(s.balls / 6)}.{s.balls % 6} of 4 ov)
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ["Need", `${Math.max(0, s.target - s.runs)} off ${s.totalBalls - s.balls}`],
          ["Req. rate", rr > 50 ? "-" : requiredRate(s).toFixed(2)],
          ["Wkts left", String(10 - s.wickets)],
          [
            "At crease",
            `${s.striker.name.split(" ")[0]}* / ${s.nonStriker.name.split(" ")[0]}`,
          ],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-char p-2">
            <dt className="text-mute">{k}</dt>
            <dd className="font-bold">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  const Stage = () => {
    if (step === "decide") {
      return (
        <>
          <section className="mt-3 rounded-2xl border border-edge p-4 text-sm">
            <b>{state.striker.name}</b>{" "}
            <span className="text-mute">
              ({state.striker.style}) faces over {state.overIndex + 1}.
              Non-striker: {state.nonStriker.name} ({state.nonStriker.style}).
            </span>
          </section>

          <h2 className="display mt-6 text-2xl font-bold">
            Over {state.overIndex + 1}: choose your bowler
          </h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {BOWLERS.map((b) => {
              const ok = legalIds.has(b.id);
              const mine = opts.filter((o) => o.bowlerId === b.id);
              const left = MAX_OVERS_PER_BOWLER - state.quota[b.id];

              return (
                <button
                  key={b.id}
                  disabled={!ok}
                  aria-pressed={pick === b.id}
                  onClick={() => {
                    setPick(b.id);
                    setConfirming(false);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    pick === b.id
                      ? "border-lime bg-turf/40"
                      : "border-edge bg-panel"
                  } ${ok ? "hover:border-lime/60" : "opacity-40"}`}
                >
                  <div className="font-bold">{b.name}</div>
                  <div className="text-sm text-mute">{b.type}</div>

                  <div className="mt-2 text-sm">
                    <span className="text-lime">+</span> {b.strength}
                  </div>

                  <div className="text-sm">
                    <span className="text-red-400">-</span> {b.weakness}
                  </div>

                  <div className="mt-3 text-sm text-mute">
                    {ok
                      ? mine
                          .map(
                            (o) =>
                              `${o.strategy === "ATTACK" ? "Atk" : "Def"} ${o.e.toFixed(1)}`
                          )
                          .join(" · ") + " exp. runs"
                      : state.lastBowler === b.id
                        ? "Bowled last over"
                        : "Quota used"}
                  </div>

                  <div className="text-sm text-mute">
                    {left} over{left === 1 ? "" : "s"} left
                  </div>
                </button>
              );
            })}
          </div>

          <h2 className="display mt-6 text-2xl font-bold">Strategy</h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                [
                  "ATTACK",
                  Swords,
                  "More wicket chances and more variance. Can leak boundaries.",
                ],
                [
                  "DEFEND",
                  Shield,
                  "Fewer runs on average, fewer breakthroughs, steadier results.",
                ],
              ] as const
            ).map(([k, Icon, d]) => (
              <button
                key={k}
                aria-pressed={strat === k}
                onClick={() => setStrat(k)}
                className={`rounded-2xl border p-4 text-left ${
                  strat === k
                    ? "border-lime bg-turf/40"
                    : "border-edge bg-panel"
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Icon size={18} />
                  {k}
                </div>
                <div className="mt-1 text-sm text-mute">{d}</div>
              </button>
            ))}
          </div>

          <div className="mt-6">
            {!confirming ? (
              <button
                className={primary}
                disabled={!pick}
                onClick={() => setConfirming(true)}
              >
                <Lock className="mr-2 inline" size={16} />
                LOCK MY DECISION
              </button>
            ) : (
              <div
                role="alertdialog"
                aria-label="Confirm decision"
                className="rounded-2xl border border-lime p-4 pop"
              >
                <p>
                  Lock <b>{bowlerById(pick!).name}</b> with <b>{strat}</b>? You
                  can&apos;t change it after this.
                </p>

                <div className="mt-3 flex gap-2">
                  <button className={primary} onClick={lock}>
                    Yes, lock it
                  </button>

                  <button
                    className={ghost}
                    onClick={() => setConfirming(false)}
                  >
                    Go back
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      );
    }

    if (!last) return null;

    const d = session.decisions[last.over - 1].receipt;

    if (step === "reveal") {
      return (
        <>
          <section className="mt-4 rounded-2xl border border-dashed border-lime p-4 pop">
            <p className="text-xs tracking-widest text-lime">
              DEMO DECISION RECEIPT
            </p>

            <p className="display mt-1 text-2xl font-bold">
              Your call is locked.
            </p>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-mute">
              <div>
                ID
                <br />
                <b className="text-white">{d.id}</b>
              </div>

              <div>
                Over
                <br />
                <b className="text-white">{d.over}</b>
              </div>

              <div>
                Bowler
                <br />
                <b className="text-white">
                  {d.bowler} · {d.strategy}
                </b>
              </div>

              <div>
                Score then
                <br />
                <b className="text-white">{d.score}</b>
              </div>

              <div>
                Seed
                <br />
                <b className="text-white">{d.seed}</b>
              </div>

              <div>
                Client time
                <br />
                <b className="text-white">
                  {new Date(d.at).toLocaleTimeString()}
                </b>
              </div>
            </dl>

            <p className="mt-3 text-xs text-mute">
              This prototype records decisions locally. A production version
              would use server-side timestamps and tamper-resistant storage.
            </p>
          </section>

          <section className="mt-4 rounded-2xl border border-edge bg-panel p-4 pop">
            <p className="text-sm text-mute">
              Simulated benchmark captain (rule-based policy, not a real
              captain)
            </p>

            <p className="display mt-1 text-2xl font-bold">
              {bowlerById(last.captain.bowlerId).name} · {last.captain.strategy}
            </p>

            <p className="mt-1 text-sm text-mute">
              {last.captain.reason}
            </p>
          </section>

          <button
            className={`${primary} mt-5`}
            onClick={() =>
              update((s) => ({
                ...s,
                step: "sim",
              }))
            }
          >
            BOWL THE OVER
          </button>
        </>
      );
    }

    const balls = last.fan.result.balls;

    if (step === "sim") {
      return (
        <>
          <h2 className="display mt-6 text-2xl font-bold">
            Over {last.over}: {bowlerById(last.fan.bowlerId).name} ·{" "}
            {last.fan.strategy}
          </h2>

          <ol
            className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6"
            aria-live="polite"
          >
            {balls.slice(0, shown).map((b) => (
              <li
                key={b.ball}
                className={`pop rounded-xl border p-3 text-center ${
                  b.wicket
                    ? "border-red-400 bg-red-950/40"
                    : b.runs >= 4
                      ? "border-lime bg-turf/40"
                      : "border-edge bg-panel"
                }`}
              >
                <div className="text-xs text-mute">Ball {b.ball}</div>
                <div className="display text-2xl font-extrabold">
                  {b.wicket ? "W" : b.runs}
                </div>
                <div className="text-xs text-mute">{b.score}</div>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex gap-2">
            {shown < balls.length ? (
              <button
                className={ghost}
                onClick={() => setShown(balls.length)}
              >
                Skip to end
              </button>
            ) : (
              <button
                className={primary}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    step: "analysis",
                  }))
                }
              >
                CONTINUE
              </button>
            )}
          </div>
        </>
      );
    }

    if (step === "analysis") {
      const ai = session.ai[last.over];

      return (
        <>
          <h2 className="display mt-6 text-2xl font-bold">
            Over {last.over} verdict: {Math.round(last.total)} / 100
          </h2>

          <div className="mt-3 space-y-3 rounded-2xl border border-edge bg-panel p-4">
            <Bar
              label="Tactical Judgement (pre-over info only)"
              v={last.tactical}
              max={50}
            />

            <Bar
              label="Execution Outcome (uses simulated result)"
              v={last.outcome}
              max={30}
            />

            <Bar
              label="Captain Comparison (pre-over tactical utility)"
              v={last.comparison}
              max={20}
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-lime p-4">
              <p className="text-sm text-lime">
                Your branch (carries forward)
              </p>

              <p className="font-bold">
                {bowlerById(last.fan.bowlerId).name} · {last.fan.strategy}
              </p>

              <p className="text-sm text-mute">
                {last.fan.result.runs} runs, {last.fan.result.wickets} wkt ·
                exp. {last.fan.e.toFixed(1)}
              </p>
            </div>

            <div className="rounded-2xl border border-edge p-4">
              <p className="text-sm text-mute">
                Simulated benchmark (comparison only)
              </p>

              <p className="font-bold">
                {bowlerById(last.captain.bowlerId).name} ·{" "}
                {last.captain.strategy}
              </p>

              <p className="text-sm text-mute">
                {last.captain.result.runs} runs, {last.captain.result.wickets}{" "}
                wkt · exp. {last.captain.e.toFixed(1)}
              </p>
            </div>
          </div>

          <section className="mt-3 rounded-2xl border border-edge bg-panel p-4">
            {!ai ? (
              <p className="text-mute">Analyst is reading the over…</p>
            ) : (
              <>
                {(
                  [
                    ["YOUR CALL", ai.sections.call],
                    ["THE TRADE-OFF", ai.sections.tradeoff],
                    ["WHAT HAPPENED", ai.sections.happened],
                    ["NEXT OVER", ai.sections.next],
                  ] as const
                ).map(([h, t]) => (
                  <div key={h} className="mb-3">
                    <h3 className="text-xs font-bold tracking-widest text-lime">
                      {h}
                    </h3>
                    <p className="text-sm">{t}</p>
                  </div>
                ))}

                <p className="text-xs text-mute">
                  {ai.source === "ai"
                    ? "Explained by AI from engine data"
                    : "Explained by built-in fallback engine"}
                  . Scores are always calculated by code.
                </p>
              </>
            )}
          </section>

          <button className={`${primary} mt-5`} onClick={next}>
            {state.done ? "SEE FINAL REPORT" : "NEXT OVER"}{" "}
            <ChevronRight className="inline" size={16} />
          </button>
        </>
      );
    }

    if (step === "final" && summary) {
      const won = state.runs >= state.target;

      return (
        <>
          <section
            className="mt-4 rounded-3xl border border-lime bg-gradient-to-br from-turf to-char p-6 pop"
            aria-label="Result card"
          >
            <p className="text-sm tracking-widest text-lime">
              ARMCHAIR CAPTAIN
            </p>

            <p className="display text-7xl font-extrabold">
              {Math.round(summary.iq)}
            </p>

            <p className="display text-2xl">{summary.label}</p>

            <p className="mt-1 text-sm text-mute">
              Captaincy IQ: a prototype rating from this simulation, not a
              measure of real cricket expertise.
            </p>

            <div className="mt-4 space-y-3">
              <Bar
                label="Tactical Judgement avg"
                v={summary.tactical}
                max={50}
              />

              <Bar
                label="Execution Outcome avg"
                v={summary.outcome}
                max={30}
              />

              <Bar
                label="Captain Comparison avg"
                v={summary.comparison}
                max={20}
              />
            </div>

            <p className="mt-4 text-sm">
              {won
                ? `${TEAMS.batting} chased it down`
                : `${TEAMS.bowling} defended it`}
              : {state.runs}/{state.wickets} vs {state.target}.{" "}
              {resolutions.length} over
              {resolutions.length === 1 ? "" : "s"}. {resolutions.length} call
              {resolutions.length === 1 ? "" : "s"}.
            </p>
          </section>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ["Runs conceded", summary.conceded],
              ["Wickets", summary.wickets],
              [
                "Outperformed benchmark tactically",
                `${summary.beatCaptain}/${resolutions.length}`,
              ],
              ["Overs played", resolutions.length],
            ].map(([k, v]) => (
              <div
                key={k as string}
                className="rounded-xl border border-edge p-3"
              >
                <dt className="text-mute">{k}</dt>
                <dd className="text-xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 text-sm text-mute">
            Best overall over: Over {summary.best.over} (
            {Math.round(summary.best.total)}). Lowest overall over: Over{" "}
            {summary.worst.over} ({Math.round(summary.worst.total)}).
          </p>

          <h3 className="display mt-5 text-xl font-bold">
            <Trophy className="mr-2 inline" size={18} />
            Achievements
          </h3>

          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {summary.achievements.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border p-3 ${
                  a.earned
                    ? "border-lime bg-turf/40"
                    : "border-edge opacity-50"
                }`}
              >
                <b>{a.name}</b>
                {a.earned ? " ✓" : " (locked)"}
                <div className="text-sm text-mute">{a.desc}</div>
              </li>
            ))}
          </ul>

          {/* Share and Play Again */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button className={primary} onClick={share}>
              <Share2 className="mr-2 inline" size={16} />
              SHARE MY CAPTAINCY IQ
            </button>

            <button className={ghost} onClick={start}>
              <RotateCcw className="mr-2 inline" size={16} />
              PLAY AGAIN
            </button>
          </div>

          {/* Share status */}
          {msg && (
            <p role="status" className="mt-2 text-sm text-lime">
              {msg}
            </p>
          )}

          {/* Manual copy fallback */}
          {msg.includes("Select and copy") && (
            <div className="mt-3">
              <label
                htmlFor="share-result"
                className="mb-2 block text-sm text-mute"
              >
                Your shareable result
              </label>

              <textarea
                id="share-result"
                readOnly
                value={shareText}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                rows={10}
                className="w-full rounded-xl border border-edge bg-panel p-3 text-sm text-white"
              />

              <button
                className={`${ghost} mt-2`}
                onClick={() => {
                  const field = document.getElementById(
                    "share-result"
                  ) as HTMLTextAreaElement | null;

                  field?.select();
                }}
              >
                SELECT RESULT TO COPY
              </button>
            </div>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20">
      {Header}
      {About}
      {step !== "final" && Scoreboard()}
      {Stage()}

      {step !== "final" && (
        <button
          onClick={restart}
          className="mt-10 text-sm text-mute underline"
        >
          Restart match
        </button>
      )}
    </main>
  );
}
