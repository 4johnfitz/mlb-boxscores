const fs = require("fs");
const fetch = require("node-fetch");

// -------------------------
// GET YESTERDAY (SOURCE OF TRUTH)
// -------------------------
function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
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

    // skip only unplayed
    if (state === "Preview") continue;

    const gamePk = game.gamePk;
    const awayName = game.teams.away.team.name;
    const homeName = game.teams.home.team.name;

    // -------------------------
    // SAFE SCORE FETCH (FIXED)
    // -------------------------
    let awayScore = 0;
    let homeScore = 0;

    try {
      const line = await getLinescore(gamePk);
      awayScore = line?.teams?.away?.runs ?? 0;
      homeScore = line?.teams?.home?.runs ?? 0;
    } catch (e) {
      console.log("No linescore:", gamePk);
    }

    let lineText = "";

    try {
      const line = await getLinescore(gamePk);
      lineText = formatLineScore(line, awayName, homeName);
    } catch {
      lineText = "No line score available";
    }

    const text = `
${awayName} @ ${homeName}
--------------------------------
${lineText}
`;

    results.push({
      gamePk,
      away: awayName,
      home: homeName,
      awayScore,
      homeScore,
      state,
      text: text.trim()
    });
  }

  // -------------------------
  // SAVE FILES
  // -------------------------
  if (!fs.existsSync("./data")) fs.mkdirSync("./data");

  fs.writeFileSync(
    `./data/boxscores-${date}.json`,
    JSON.stringify(results, null, 2)
  );

  // index update
  const indexPath = "./data/index.json";

  const existing = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath))
    : [];

  if (!existing.includes(date)) {
    existing.push(date);
  }

  fs.writeFileSync(indexPath, JSON.stringify(existing.sort(), null, 2));

  console.log("DONE:", results.length, "games saved");
}

run();
