const fs = require("fs");
const fetch = require("node-fetch");

function getYesterday() {
  const now = new Date();
  const ptString = now.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = ptString.split("/");
  const month = parts[0];
  const day = parts[1];
  const year = parts[2];
  const pt = new Date(year + "-" + month + "-" + day + "T00:00:00");
  pt.setDate(pt.getDate() - 1);
  return [
    pt.getFullYear(),
    String(pt.getMonth() + 1).padStart(2, "0"),
    String(pt.getDate()).padStart(2, "0")
  ].join("-");
}

async function getSchedule(date) {
  const res = await fetch(
    "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + date
  );
  const data = await res.json();
  return data.dates && data.dates[0] ? data.dates[0].games : [];
}

async function getLinescore(gamePk) {
  const res = await fetch(
    "https://statsapi.mlb.com/api/v1/game/" + gamePk + "/linescore"
  );
  return await res.json();
}

function formatLineScore(linescore, awayName, homeName) {
  const innings = linescore.innings || [];
  let header = "Team     ";
  for (let i = 0; i < innings.length; i++) {
    header += (i + 1) + " ";
  }
  header += " R  H  E";

  function teamLine(team, name) {
    let line = name.padEnd(9);
    for (let i = 0; i < innings.length; i++) {
      var inning = innings[i];
      var runs;
      if (team === "away") {
        runs = inning.away && inning.away.runs !== undefined ? inning.away.runs : "-";
      } else {
        runs = inning.home && inning.home.runs !== undefined ? inning.home.runs : "-";
      }
      line += runs + " ";
    }
    var totals = team === "away" ? linescore.teams.away : linescore.teams.home;
    var r = totals && totals.runs !== undefined ? totals.runs : 0;
    var h = totals && totals.hits !== undefined ? totals.hits : 0;
    var e = totals && totals.errors !== undefined ? totals.errors : 0;
    line += " " + r + "  " + h + "  " + e;
    return line;
  }

  return header + "\n" + teamLine("away", awayName) + "\n" + teamLine("home", homeName);
}

async function run() {
  const date = getYesterday();
  console.log("RUNNING FOR DATE: " + date);

  const games = await getSchedule(date);
  console.log("GAMES FOUND: " + games.length);

  const results = [];

  for (let i = 0; i < games.length; i++) {
    var game = games[i];
    var status = game.status || {};
    var state = status.abstractGameState || "";

    if (state === "Preview") continue;

    var gamePk = game.gamePk;
    var awayName = game.teams.away.team.name;
    var homeName = game.teams.home.team.name;

    var linescore = null;
    try {
      linescore = await getLinescore(gamePk);
    } catch (err) {
      console.log("No linescore for gamePk: " + gamePk);
    }

    var awayScore = 0;
    var homeScore = 0;
    if (linescore && linescore.teams) {
      if (linescore.teams.away && linescore.teams.away.runs !== undefined) {
        awayScore = linescore.teams.away.runs;
      }
      if (linescore.teams.home && linescore.teams.home.runs !== undefined) {
        homeScore = linescore.teams.home.runs;
      }
    }

    var lineText = "No line score available";
    if (linescore) {
      try {
        lineText = formatLineScore(linescore, awayName, homeName);
      } catch (err) {
        console.log("Error formatting linescore for gamePk: " + gamePk);
      }
    }

    var text = awayName + " @ " + homeName + "\n--------------------------------\n" + lineText;

    results.push({
      gamePk: gamePk,
      away: awayName,
      home: homeName,
      awayScore: awayScore,
      homeScore: homeScore,
      state: state,
      text: text
    });
  }

  if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
  }

  fs.writeFileSync(
    "./data/boxscores-" + date + ".json",
    JSON.stringify(results, null, 2)
  );

  var indexPath = "./data/index.json";
  var existing = [];
  if (fs.existsSync(indexPath)) {
    existing = JSON.parse(fs.readFileSync(indexPath));
  }
  if (!existing.includes(date)) {
    existing.push(date);
  }
  fs.writeFileSync(indexPath, JSON.stringify(existing.sort(), null, 2));

  console.log("DONE: " + results.length + " games saved for " + date);
}

run();
