import { distribution } from "../lib/scoring/calibration";
for (const p of ["random", "average", "strong", "greedy"] as const) console.log(distribution(p));
