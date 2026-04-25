const fs = require("fs");
const fetch = require("node-fetch");

// Fetch schedule
async function getSchedule(date) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`
  );
  const data = await res.json();
  return data.dates?.[0]?.games || [];
}

// Fetch boxscore
async function getBoxscore(gamePk) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`
  );
  return await res.json();
}

// Fetch linescore
async function getLinescore(gamePk) {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`
  );
  return await res.json();
}

// Format line score
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

// Main runner
async function run() {
  // 🔥 TEST DATE (change later back to getYesterday)
  const date = "2026-04-23";

  console.log(`Fetching games for ${date}...`);

  const games = await getSchedule(date);
  console.log("Games found:", games.length);

  const results = [];

  for (const game of games) {
    const status = game.status;

    // safer filter
    if (!status?.isFinal) continue;

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
      text: text.trim(),
    });
  }

  // Ensure data folder exists
  if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
  }

  // Write JSON
  fs.writeFileSync(
    `./data/boxscores-${date}.json`,
    JSON.stringify(results, null, 2)
  );

  // Write TXT
  fs.writeFileSync(
    `./data/boxscores-${date}.txt`,
    results.map((g) => g.text).join("\n\n====================\n\n")
  );

  // Update index
  const indexPath = "./data/index.json";

  const existing = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath))
    : [];

  if (!existing.includes(date)) {
    existing.push(date);
  }

  fs.writeFileSync(indexPath, JSON.stringify(existing.sort(), null, 2));

  console.log(`Saved ${results.length} games.`);
}

run();
