// src/core/config.js
import fs from "fs";
import os from "os";
import path from "path";

const CONFIG_PATH = path.join(os.homedir(), ".mdchatrc");

/**
 * Load config from file
 */
export function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  }
  return {};
}

/**
 * Save config to file
 */
export function saveConfig(newConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), "utf8");
}

/**
 * Update a single key/value in config
 */
export function setConfig(key, value) {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
  return config;
}
