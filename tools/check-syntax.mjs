import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!match) throw new Error("Module script not found");

new vm.SourceTextModule(match[1]);
console.log("module syntax ok");
