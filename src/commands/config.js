// src/commands/config.js
import { setConfig, loadConfig } from "../core/config.js";

export default function config(cmd, key, value) {
  if (cmd === "set") {
    if (!key || !value) {
      console.error("❌ Usage: mdchat config set <key> <value>");
      process.exit(1);
    }
    const updated = setConfig(key, value);
    console.log(`✔ Set ${key} = ${value}`);
    return updated;
  }

  if (cmd === "get") {
    if (!key) {
      console.error("❌ Usage: mdchat config get <key>");
      process.exit(1);
    }
    const config = loadConfig();
    if (config[key]) {
      console.log(`${key} = ${config[key]}`);
    } else {
      console.log(`⚠️ No value set for "${key}"`);
    }
    return config[key];
  }

  if (cmd === "list") {
    const config = loadConfig();
    console.log("Current config:");
    for (const [k, v] of Object.entries(config)) {
      console.log(`  ${k} = ${v}`);
    }
    return config;
  }

  console.error("❌ Unknown config command. Use: set | get | list");
  process.exit(1);
}
