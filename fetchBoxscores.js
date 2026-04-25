const fs = require("fs");
const fetch = require("node-fetch");

// -------------------------
// YESTERDAY (ONLY SOURCE OF TRUTH)
// -------------------------
function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
// BOX / LINE SCORES
// -------------------------
async function getBoxscore(gamePk) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`
  );
  return await res.json();
}

async function getLinescore(gamePk) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`
  );
  return await res.json();
}

// -------------------------
// FORMAT LINE SCORE
// -------------------------
function formatLineScore(linescore, awayName, homeName) {
  const innings = linescore.innings || [];

  let header = "Team     ";
  innings.forEach((_, i) => {
    header += `${i + 1} `;
  });
  header += " R  H  E";

  function teamLine(team, name) {
    let line = name.padEnd(9);

    innings.forEach((inning) => {
      const runs =
        team === "away"
          ? inning.away?.runs ?? "-"
          : inning.home?.runs ?? "-";
      line += `${runs} `;
    });

    const totals =
      team === "away" ? linescore.teams.away : linescore.teams.home;

    line += ` ${totals.runs}  ${totals.hits}  ${totals.errors}`;
    return line;
  }

  return [
    header,
    teamLine("away", awayName),
    teamLine("home", homeName),
  ].join("\n");
}

// -------------------------
// MAIN RUNNER (YESTERDAY ONLY)
// -------------------------
async function run() {
  const date = getYesterday();

  console.log("Generating YESTERDAY:", date);

  const games = await getSchedule(date);

  console.log("Games found:", games.length);

  const results = [];

  for (const game of games) {
    const state = game.status?.abstractGameState;

    // -------------------------
    // SAFE FILTER (DO NOT OVER-FILTER)
    // -------------------------
    if (state === "Preview") continue;

    const gamePk = game.gamePk;
    const awayName = game.teams.away.team.name;
    const homeName = game.teams.home.team.name;

    const [, line] = await Promise.all([
      getBoxscore(gamePk),
      getLinescore(gamePk),
    ]);

    const lineScoreText = formatLineScore(line, awayName, homeName);

    const text = `
${awayName} @ ${homeName}
--------------------------------
${lineScoreText}
`;

    results.push({
      gamePk,
      away: awayName,
      home: homeName,
      state: state,
      text: text.trim()
    });
  }

  // -------------------------
  // OUTPUT FILES
  // -------------------------
  if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
  }

  fs.writeFileSync(
    `./data/boxscores-${date}.json`,
    JSON.stringify(results, null, 2)
  );

  fs.writeFileSync(
    `./data/boxscores-${date}.txt`,
    results.map(g => g.text).join("\n\n====================\n\n")
  );

  // -------------------------
  // INDEX UPDATE
  // -------------------------
  const indexPath = "./data/index.json";

  const existing = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath))
    : [];

  if (!existing.includes(date)) {
    existing.push(date);
  }

  fs.writeFileSync(
    indexPath,
    JSON.stringify(existing.sort(), null, 2)
  );

  console.log(`Saved ${results.length} games for ${date}`);
}

run();
