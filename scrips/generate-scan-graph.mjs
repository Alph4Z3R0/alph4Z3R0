#!/usr/bin/env node
// Generates a custom-colored "security scan" animated SVG from a GitHub
// user's contribution calendar. No third-party rendering service is
// involved, so the colors below are the actual, final colors — nothing
// gets overridden by a theme preset.

import { writeFileSync, mkdirSync } from "fs";

const username = process.env.GITHUB_LOGIN;
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  console.error("Missing GITHUB_LOGIN or GITHUB_TOKEN environment variable");
  process.exit(1);
}

// ---- edit these hex values to change the palette ----
const COLORS = {
  empty: "#2d333b",    // no contributions that day
  level1: "#7ee8a8",   // soft mint green (low activity)
  level2: "#4ade80",   // medium green
  level3: "#16a34a",   // deep green
  level4: "#9333ea",   // purple — your most active days
  scanner: "#22d3ee",  // cyan scanner bar
};
// -------------------------------------------------------

const query = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query, variables: { login: username } }),
});

const json = await res.json();

if (!json.data || !json.data.user) {
  console.error("GraphQL request failed:", JSON.stringify(json, null, 2));
  process.exit(1);
}

const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
const counts = weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount));
const max = Math.max(...counts, 1);

function levelColor(count) {
  if (count === 0) return COLORS.empty;
  const ratio = count / max;
  if (ratio > 0.75) return COLORS.level4;
  if (ratio > 0.5) return COLORS.level3;
  if (ratio > 0.25) return COLORS.level2;
  return COLORS.level1;
}

const cell = 11;
const gap = 3;
const cols = weeks.length;
const rows = 7;
const width = cols * (cell + gap);
const height = rows * (cell + gap);
const scanDuration = 6; // seconds for the reveal sweep, then it loops

let cellsSvg = "";
weeks.forEach((week, col) => {
  week.contributionDays.forEach((day, row) => {
    const x = col * (cell + gap);
    const y = row * (cell + gap);
    const color = levelColor(day.contributionCount);
    const delay = ((col / cols) * scanDuration).toFixed(2);
    cellsSvg += `
      <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${color}" opacity="0">
        <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.4s" fill="freeze" />
      </rect>`;
  });
});

const scanner = `
  <rect x="-20" y="-4" width="6" height="${height + 8}" fill="${COLORS.scanner}" opacity="0.6">
    <animate attributeName="x" values="-20;${width + 20}" dur="${scanDuration}s"
      begin="0s" repeatCount="indefinite" />
  </rect>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${cellsSvg}
  ${scanner}
</svg>`;

mkdirSync("profile", { recursive: true });
writeFileSync("profile/scan-graph.svg", svg);
console.log("Wrote profile/scan-graph.svg");
