// Compiles the Foundry test + deploy script with solc 0.8.28 to catch errors without Foundry.
const fs = require("fs");
const path = require("path");
const solc = require("solc");
const root = path.join(__dirname, "..", "contracts");
const entry = ["test/QeepAccount.t.sol", "script/Deploy.s.sol"];
const input = {
  language: "Solidity",
  sources: Object.fromEntries(entry.map((f) => [f, { content: fs.readFileSync(path.join(root, f), "utf8") }])),
  settings: { evmVersion: "london", optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": [] } } },
};
function findImports(p) {
  const real = p.startsWith("forge-std/") ? path.join(root, "lib/forge-std/src", p.slice(10)) : path.join(root, p);
  try {
    return { contents: fs.readFileSync(real, "utf8") };
  } catch {
    return { error: "not found: " + p };
  }
}
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errs = (out.errors || []).filter((e) => e.severity === "error");
for (const e of out.errors || []) if (e.severity === "error") console.error(e.formattedMessage);
if (errs.length) process.exit(1);
console.log("Foundry test and deploy script compile with solc 0.8.28 (london).");
