const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const argument = process.argv[2];
if (!argument) throw new Error("Usage: npm run install:garden -- /path/to/garden");
const garden = path.resolve(argument);
if (!fs.existsSync(path.join(garden, "src/helpers/pluginLoader.js"))) {
  throw new Error("Target must be a Digital Garden repository with garden plugin support.");
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, "garden-plugin.json"), "utf8"));
const target = path.join(garden, "src/plugins", manifest.id);
fs.mkdirSync(target, { recursive: true });
for (const entry of ["garden-plugin.json", "assets", "styles", "templates"]) {
  fs.cpSync(path.join(root, entry), path.join(target, entry), { recursive: true });
}
console.log(`Installed ${manifest.name} into ${target}. Existing settings were preserved.`);
