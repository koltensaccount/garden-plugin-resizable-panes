const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "garden-plugin.json")));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
const screenshot = fs.readFileSync(path.join(root, 'screenshot.png'));
if (screenshot.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' || screenshot.readUInt32BE(16) < 320 || screenshot.readUInt32BE(20) < 240) throw new Error('Missing or invalid screenshot');
for (const file of ['LICENSE','README.md','VALIDATION.md']) if (!fs.existsSync(path.join(root,file))) throw new Error('Missing ' + file);
for (const key of ["id", "name", "description", "author", "version"]) if (typeof manifest[key] !== "string" || !manifest[key]) throw new Error("Missing " + key);
if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.id) || manifest.id.startsWith("dg-")) throw new Error("Invalid ID");
if (manifest.version !== pkg.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error("Version mismatch");
if (manifest.author !== "Kolten Bendickson") throw new Error("Unexpected author");
const slots = new Set(["common.head","common.header","common.beforeContent","common.afterContent","common.footer","notes.head","notes.header","notes.beforeContent","notes.afterContent","notes.footer","index.head","index.header","index.beforeContent","index.afterContent","index.footer","filetree.beforeTitle","filetree.afterTitle","filetree.actions","sidebar.top","sidebar.bottom","navbar.actions","floating.bottomRight"]);
for (const slot of Object.keys(manifest.slots || {})) if (!slots.has(slot)) throw new Error("Unknown slot: " + slot);
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const files = [...array(manifest.hooks), ...array(manifest.styles), ...array(manifest.scripts), ...array(manifest.assets), ...Object.values(manifest.slots || {}).flatMap(array)];
for (const file of files) if (file.startsWith("/") || file.includes("\\") || file.split("/").includes("..") || !fs.existsSync(path.join(root, file))) throw new Error("Invalid declared path: " + file);
const keys = new Set();
for (const setting of manifest.settings || []) {
  if (keys.has(setting.key)) throw new Error("Duplicate setting");
  keys.add(setting.key);
  if (!["text","number","boolean","select"].includes(setting.type)) throw new Error("Invalid setting type");
  if (setting.type === "boolean" && typeof setting.default !== "boolean") throw new Error("Invalid boolean default");
  if (setting.type === "number" && !Number.isFinite(setting.default)) throw new Error("Invalid number default");
  if (setting.type === "select" && !setting.options.includes(setting.default)) throw new Error("Invalid select default");
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|cjs)$/.test(entry.name)) execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
  }
}
walk(root);
console.log("Manifest, settings, declared paths and JavaScript syntax verified: " + manifest.id);
