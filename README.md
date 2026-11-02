# 🏏 Armchair Captain — Aap hote toh?

**Every fan has a captain inside.**

Armchair Captain is an AI-powered cricket captaincy simulator built around a fictional four-over T20 chase. Choose your bowler, select ATTACK or DEFEND, lock your decision, and compare your captaincy against a rule-based benchmark.

Make four decisions and discover your **Captaincy IQ**.

## 🎮 Key Features

- **Interactive T20 Simulation:** Captain the bowling side in a four-over chase.
- **Bowler & Strategy Selection:** Choose from available bowlers and ATTACK or DEFEND.
- **Ball-by-Ball Simulation:** Watch seeded match outcomes unfold.
- **Benchmark Captain:** Compare your decisions against a deterministic captaincy heuristic.
- **Three-Part Scoring:** Separate tactical judgement, execution outcome and captain comparison.
- **AI Tactical Explanations:** Get explanations in English, Hinglish or Beginner English.
- **Captaincy IQ & Achievements:** Track your performance and unlock achievements.
- **Persistent Sessions:** Resume matches using deterministic replay and browser storage.

## 🧠 Scoring System

Each over is scored out of 100:

| Category | Score | Measures |
|---|---:|---|
| Tactical Judgement | 50 | Quality of your decision based on pre-over information |
| Execution Outcome | 30 | How your selected option performed in the simulation |
| Captain Comparison | 20 | Your tactical utility compared with the benchmark |
| **Total** | **100** | **Overall over performance** |

Your final **Captaincy IQ** is the average of your four over scores.

Separating these scores helps distinguish a good decision from a lucky or unlucky outcome.

## 🏗️ Tech Stack

- **Frontend:** Next.js 14, React, TypeScript
- **Styling:** Tailwind CSS
- **Validation:** Zod
- **Simulation:** TypeScript, seeded random number generation
- **AI:** OpenRouter API
- **Persistence:** Browser localStorage
- **Testing:** Project test suite
- **Deployment:** Vercel

## ⚙️ Engineering Highlights

**Deterministic Simulation:** Both the fan and benchmark branches start from the same pre-over state and use the same seed. Each ball consumes exactly two random draws, keeping branch outcomes aligned.

**Independent Scoring:** Tactical judgement uses expected runs, execution scoring uses simulated outcomes, and captain comparison uses tactical utility incorporating expected runs and wicket probability.

**Rule-Based Benchmark:** The benchmark captain follows a deterministic heuristic based on bowling options, batter matchups and required run rate. It is not an optimiser, so the player can outperform it.

**AI Explainer:** The server-side API sends validated simulation data to OpenRouter. AI explains decisions but never calculates scores or match outcomes.

**Deterministic Fallback:** If the API key is missing or an AI request fails, a built-in fallback generates explanations and gameplay continues.

**Persistent Replay:** Only the seed, decisions and game progress are stored. Match state is reconstructed through deterministic replay and validated before resuming.

## 🚀 Getting Started

### Prerequisites
- Node.js
- npm

### Installation

```bash
git clone https://github.com/sauravy0110/Armchair-Captain.git
cd Armchair-Captain
npm install
```

Create your environment file:

```bash
cp .env.example .env.local
```

Add your OpenRouter API key:

```env
OPENROUTER_API_KEY=your_api_key
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
AI_TIMEOUT_MS=45000
```

AI configuration is optional. The game remains fully playable without an API key.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

### Calibration

```bash
npm run calibrate
```

Evaluates four simulated player personas using fixed seeds to check the intended Captaincy IQ distributions.

## 🌐 Deployment

The application can be deployed on [Vercel](https://vercel.com).

1. Import the GitHub repository into Vercel.
2. Configure the required environment variables.
3. Deploy the Next.js application.

The application remains playable without OpenRouter credentials.

## ⚠️ Limitations

- Uses fictional players, teams and simulation coefficients, not validated cricket data.
- The benchmark captain is a heuristic, not an optimal or real-world captain.
- Captaincy IQ is a prototype metric, not a measure of actual cricket expertise.
- Match progress is stored locally and is not tamper-proof.
- AI availability depends on OpenRouter and its model providers.
- Sharing currently supports text, not image export.

---

**Aap hote toh?**

*Every over is a captaincy test.*
