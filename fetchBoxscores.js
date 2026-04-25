const fs = require("fs");
const fetch = require("node-fetch");

// -------------------------
// GET TARGET DATE (Pacific Time)
// GitHub Actions runs in UTC — this ensures we always use PT "yesterday"
// -------------------------
function getYesterday() {
  // Get current time in Pacific (handles PST/PDT automatically)
  const now = new Date();
  const ptString = now.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  // ptString is "MM/DD/YYYY"
  const [month, day, year] = ptString.split("/");
  // Subtract 1 day
  const pt = new Date(`${year}-${month}-${day}T00:00:00`);
  pt.setDate(pt.getDate() - 1);
  return [
    pt.getFullYear(),
    String(pt.getMonth() + 1).padStart(2, "0"),
    String(pt.getDate()).padStart(2, "0")
  ].join("-");
}

// -------------------------
// MLB SCHEDULE
// -------------------------
async function getSchedule(date) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`
  );
  const data = await res.json();
  return data.dates?.[0]?.games || [];
}

// -------------------------
// LINE SCORE
// -------------------------
async function getLinescore(gamePk) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`
  );
  return await res.json();
}

// -------------------------
// FORMAT LINESCORE
// -------------------------
function formatLineScore(linescore, awayName, homeName) {
  const innings = linescore.innings || [];
  let header = "Team     ";
  innings.forEach((_, i) => header += `${i + 1} `);
  header += " R  H  E";

  function teamLine(team, name) {
    let line = name.padEnd(9);
    innings.forEach(inning => {
      const runs =
        team === "away"
          ? inning.away?.runs ?? "-"
          : inning.home?.runs ?? "-";
      line += `${runs} `;
    });
    const totals =
      team === "away" ? linescore.teams.away : linescore.teams.home;
    line += ` ${totals?.runs ?? 0}  ${totals?.hits ?? 0}  ${totals?.errors ?? 0}`;
    return line;
  }

  return [
    header,
    teamLine("away", awayName),
    teamLine("home", homeName)
  ].join("\n");
}

// -------------------------
// RUN
// -------------------------
async function run() {
  const date = getYesterday();
  console.log("RUNNING FOR DATE:", date);

  const games = await getSchedule(date);
  console.log("GAMES FOUND:", games.length);

  const results = [];

  for (const game of games) {
    const status = game.status || {};
    const state = status.abstractGameState || "";

    // Skip only unplayed games
