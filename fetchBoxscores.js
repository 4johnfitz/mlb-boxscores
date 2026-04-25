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

async function getBoxscore(gamePk) {
  const res = await fetch(
    "https://statsapi.mlb.com/api/v1/game/" + gamePk + "/boxscore"
  );
  return await res.json();
}

function formatLineScore(linescore, awayName, homeName) {
  const innings = linescore.innings || [];
  let header = "Team      ";
  for (let i = 0; i < innings.length; i++) {
    header += " " + (i + 1);
  }
  header += "  R  H  E";

  function teamLine(team, name) {
    let line = name.substring(0, 9).padEnd(10);
    for (let i = 0; i < innings.length; i++) {
      var inning = innings[i];
      var runs;
      if (team === "away") {
        runs = inning.away && inning.away.runs !== undefined ? inning.away.runs : "-";
      } else {
        runs = inning.home && inning.home.runs !== undefined ? inning.home.runs : "-";
      }
      line += " " + runs;
    }
    var totals = team === "away" ? linescore.teams.away : linescore.teams.home;
    var r = totals && totals.runs !== undefined ? totals.runs : 0;
    var h = totals && totals.hits !== undefined ? totals.hits : 0;
    var e = totals && totals.errors !== undefined ? totals.errors : 0;
    line += "  " + r + "  " + h + "  " + e;
    return line;
  }

  return header + "\n" + teamLine("away", awayName) + "\n" + teamLine("home", homeName);
}

function formatBatters(teamBoxscore, label) {
  if (!teamBoxscore || !teamBoxscore.batters || !teamBoxscore.players) return "";

  var lines = [];
  lines.push(label + " BATTING");
  lines.push("Player                AB   R   H  RBI  BB  SO");
  lines.push("----------------------------------------------");

  var batters = teamBoxscore.batters;
  for (var i = 0; i < batters.length; i++) {
    var id = "ID" + batters[i];
    var player = teamBoxscore.players[id];
    if (!player) continue;
    var name = player.person ? player.person.fullName : "Unknown";
    var pos = player.position ? player.position.abbreviation : "  ";
    var s = player.stats && player.stats.batting ? player.stats.batting : {};
    var ab  = s.atBats !== undefined ? s.atBats : 0;
    var r   = s.runs !== undefined ? s.runs : 0;
    var h   = s.hits !== undefined ? s.hits : 0;
    var rbi = s.rbi !== undefined ? s.rbi : 0;
    var bb  = s.baseOnBalls !== undefined ? s.baseOnBalls : 0;
    var so  = s.strikeOuts !== undefined ? s.strikeOuts : 0;
    var namePosStr = (name + " " + pos).substring(0, 22).padEnd(22);
    lines.push(
      namePosStr +
      String(ab).padStart(2) + "  " +
      String(r).padStart(2) + "  " +
      String(h).padStart(2) + "  " +
      String(rbi).padStart(3) + "  " +
      String(bb).padStart(2) + "  " +
      String(so).padStart(2)
    );
  }

  var team = teamBoxscore.teamStats && teamBoxscore.teamStats.batting ? teamBoxscore.teamStats.batting : {};
  lines.push("----------------------------------------------");
  lines.push(
    "TOTALS                " +
    String(team.atBats !== undefined ? team.atBats : 0).padStart(2) + "  " +
    String(team.runs !== undefined ? team.runs : 0).padStart(2) + "  " +
    String(team.hits !== undefined ? team.hits : 0).padStart(2) + "  " +
    String(team.rbi !== undefined ? team.rbi : 0).padStart(3) + "  " +
    String(team.baseOnBalls !== undefined ? team.baseOnBalls : 0).padStart(2) + "  " +
    String(team.strikeOuts !== undefined ? team.strikeOuts : 0).padStart(2)
  );

  return lines.join("\n");
}

function formatPitchers(teamBoxscore, label) {
  if (!teamBoxscore || !teamBoxscore.pitchers || !teamBoxscore.players) return "";

  var lines = [];
  lines.push(label + " PITCHING");
  lines.push("Player                IP   H   R  ER  BB  SO");
  lines.push("----------------------------------------------");

  var pitchers = teamBoxscore.pitchers;
  for (var i = 0; i < pitchers.length; i++) {
    var id = "ID" + pitchers[i];
    var player = teamBoxscore.players[id];
    if (!player) continue;
    var name = player.person ? player.person.fullName : "Unknown";
    var s = player.stats && player.stats.pitching ? player.stats.pitching : {};
    var ip = s.inningsPitched !== undefined ? s.inningsPitched : "0.0";
    var h  = s.hits !== undefined ? s.hits : 0;
    var r  = s.runs !== undefined ? s.runs : 0;
    var er = s.earnedRuns !== undefined ? s.earnedRuns : 0;
    var bb = s.baseOnBalls !== undefined ? s.baseOnBalls : 0;
    var so = s.strikeOuts !== undefined ? s.strikeOuts : 0;
    var nameStr = name.substring(0, 22).padEnd(22);
    lines.push(
      nameStr +
      String(ip).padStart(4) + "  " +
      String(h).padStart(2) + "  " +
      String(r).padStart(2) + "  " +
      String(er).padStart(2) + "  " +
      String(bb).padStart(2) + "  " +
      String(so).padStart(2)
    );
  }

  return lines.join("\n");
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
    var awayId = game.teams.away.team.id;
    var homeId = game.teams.home.team.id;

    var linescore = null;
    try {
      linescore = await getLinescore(gamePk);
    } catch (err) {
      console.log("No linescore for gamePk: " + gamePk);
    }

    var boxscore = null;
    try {
      boxscore = await getBoxscore(gamePk);
    } catch (err) {
      console.log("No boxscore for gamePk: " + gamePk);
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

    var awayBatting = "";
    var homeBatting = "";
    var awayPitching = "";
    var homePitching = "";

    if (boxscore && boxscore.teams) {
      try { awayBatting = formatBatters(boxscore.teams.away, awayName); } catch(err) {}
      try { homeBatting = formatBatters(boxscore.teams.home, homeName); } catch(err) {}
      try { awayPitching = formatPitchers(boxscore.teams.away, awayName); } catch(err) {}
      try { homePitching = formatPitchers(boxscore.teams.home, homeName); } catch(err) {}
    }

    results.push({
      gamePk: gamePk,
      away: awayName,
      home: homeName,
      awayId: awayId,
      homeId: homeId,
      awayScore: awayScore,
      homeScore: homeScore,
      state: state,
      lineText: lineText,
      awayBatting: awayBatting,
      homeBatting: homeBatting,
      awayPitching: awayPitching,
      homePitching: homePitching
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
