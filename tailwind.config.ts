import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.tsx", "./components/**/*.tsx"],
  theme: { extend: { colors: { char: "#121513", panel: "#1a1f1b", edge: "#2a322c", turf: "#1f4d2e", lime: "#b6ff3b", mute: "#8f9a92" } } },
  plugins: [] } satisfies Config;
