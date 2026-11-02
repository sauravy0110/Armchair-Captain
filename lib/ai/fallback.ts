
import type { Lang, Payload, Sections } from "./prompt";

export function fallbackSections(p: Payload): Sections {
  const good = p.tacticalScore >= 38;

  const same =
    p.fanBowler === p.captainBowler &&
    p.fanStrategy === p.captainStrategy;

  const diff =
    Math.round((p.fanExpectedRuns - p.bestExpectedRuns) * 10) / 10;

  const w = p.fanWickets;
  const r = p.actualFanRuns;
  const expected = p.fanExpectedRuns;

  const beat =
    r < p.actualCaptainRuns
      ? "beat"
      : r > p.actualCaptainRuns
        ? "trailed"
        : "matched";

  const finished = p.matchOver || p.ballsLeftNow === 0;

  // NEXT OVER
  const nextEnglish = finished
    ? "The chase is settled. The final report is ready."
    : `At ${p.postOverScore}, the batting side needs ${p.runsNeededNow} runs from ${p.ballsLeftNow} balls, with a required rate of ${p.postOverRequiredRate}. Balance restricting runs with creating wicket opportunities.`;

  const nextHinglish = finished
    ? "Chase ka faisla ho gaya hai. Ab final report dekhiye."
    : `${p.postOverScore} par batting team ko ${p.ballsLeftNow} balls mein ${p.runsNeededNow} runs chahiye. Required rate ${p.postOverRequiredRate} hai. Runs rokne aur wicket lene ke beech balance rakhiye.`;

  const nextBeginner = finished
    ? "The chase is finished. You can now see your final report."
    : `The batting team needs ${p.runsNeededNow} runs from ${p.ballsLeftNow} balls. The score is ${p.postOverScore}, and the required rate is ${p.postOverRequiredRate}. Try to limit runs while creating chances to take wickets.`;

  // YOUR CALL
  const callEnglish =
    `${p.fanBowler} (${p.fanStrategy}) against ${p.striker}, ${p.batterHandedness}, was ${good ? "a sound" : "a questionable"} pre-over decision. ` +
    `It had ${expected} expected runs conceded, compared with the best available option of ${p.bestExpectedRuns}` +
    (diff > 0 ? ` (${diff} more than the best option).` : ".");

  const callHinglish =
    `${p.fanBowler} (${p.fanStrategy}) ko ${p.striker} ke against choose karna ${good ? "achha" : "questionable"} pre-over decision tha. ` +
    `Expected runs ${expected} the, jabki best available option ${p.bestExpectedRuns} tha.`;

  const callBeginner =
    `You selected ${p.fanBowler} with ${p.fanStrategy} against ${p.striker}. ` +
    `This was ${good ? "a sound" : "a questionable"} decision based on the information before the over. Expected runs were ${expected}, compared with ${p.bestExpectedRuns} for the best option.`;

  // THE TRADE-OFF
  const tradeoffEnglish = same
    ? `You selected the same bowler and strategy as the benchmark captain (${p.captainBowler}, ${p.captainStrategy}). You matched its tactical choice.`
    : `You selected ${p.fanBowler} (${p.fanStrategy}), while the benchmark selected ${p.captainBowler} (${p.captainStrategy}). The bowler matchup and expected runs are the key differences between these choices.`;

  const tradeoffHinglish = same
    ? `Aapka bowler aur strategy benchmark captain ke same the: ${p.captainBowler} (${p.captainStrategy}). Aapne uski tactical choice match ki.`
    : `Aapne ${p.fanBowler} (${p.fanStrategy}) choose kiya, jabki benchmark ne ${p.captainBowler} (${p.captainStrategy}) choose kiya. Dono choices mein bowler matchup aur expected runs ka difference tha.`;

  const tradeoffBeginner = same
    ? `You made the same choice as the benchmark captain: ${p.captainBowler} with ${p.captainStrategy}.`
    : `You selected ${p.fanBowler} with ${p.fanStrategy}, while the benchmark selected ${p.captainBowler} with ${p.captainStrategy}. The bowler selection and expected runs were different.`;

  // WHAT HAPPENED
  const happenedEnglish =
    `Your simulated over conceded ${r} runs and took ${w} wicket${w === 1 ? "" : "s"}. ` +
    `The benchmark conceded ${p.actualCaptainRuns} runs, so your result ${beat} its result.`;

  const happenedHinglish =
    `Aapke simulated over mein ${r} runs concede hue aur ${w} wicket${w === 1 ? "" : "s"} mile. ` +
    `Benchmark ne ${p.actualCaptainRuns} runs concede kiye; aapka result usse ${beat === "beat" ? "better" : beat === "trailed" ? "worse" : "match"} raha.`;

  const happenedBeginner =
    `Your simulated over gave away ${r} runs and took ${w} wicket${w === 1 ? "" : "s"}. ` +
    `The benchmark gave away ${p.actualCaptainRuns} runs.`;

  const T: Record<Lang, Sections> = {
    english: {
      call: callEnglish,
      tradeoff: tradeoffEnglish,
      happened: happenedEnglish,
      next: nextEnglish,
    },

    hinglish: {
      call: callHinglish,
      tradeoff: tradeoffHinglish,
      happened: happenedHinglish,
      next: nextHinglish,
    },

    beginner: {
      call: callBeginner,
      tradeoff: tradeoffBeginner,
      happened: happenedBeginner,
      next: nextBeginner,
    },
  };

  return T[p.lang];
}
