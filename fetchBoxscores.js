const fs = require("fs");
fs.writeFileSync(
  `./data/boxscores-${date}.json`,
  JSON.stringify(results, null, 2)
);

fs.writeFileSync(
  `./data/boxscores-${date}.txt`,
  results.map(g => g.text).join("\n\n====================\n\n")
);
