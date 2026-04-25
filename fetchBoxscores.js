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
  const [month, day, year] = ptString.split("/");
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
      const inning = innings[i];
      const runs = team === "away"
        ? (inning.away && inning.away.runs !== undefined ? inning.away.runs : "-")
        : (inning.home && inning.home.
