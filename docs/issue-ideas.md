# Potential Issues for mdchat

## 1. Missing `main` Entry Point Breaks Imports (Blocking)
- `package.json` declares `"main": "src/index.js"`, but the `src` directory only contains `commands/` and `core/`; `src/index.js` is absent. Importing the package via Node resolves the `main` path and throws `ERR_MODULE_NOT_FOUND`. Consumers cannot use `import('mdchat')` until a real entry point is provided or the `main` field is removed.

### Tasks
- [ ] Audit how the package is meant to be consumed (programmatic API vs CLI only) and decide whether a `src/index.js` entry point is required or the `main` field should be dropped.
- [ ] Implement the chosen approach (create the missing entry module or remove/update the `main` export in `package.json`).
- [ ] Add a regression test (e.g., simple import script) to ensure the published entry point resolves correctly.

## 2. CLI Config Overrides Are Ignored (High)
- Commands collect overrides for `provider`, `model`, `apiKey`, and `baseUrl`, but `askLLM`/`askLLMStream` in `src/core/llm.js` ignore the supplied `cliOptions` and always instantiate `openai('gpt-4o')`. As a result `--api-key` or `--model` flags (and future provider support) never take effect, so the CLI still fails without `OPENAI_API_KEY` in the environment.

### Tasks
- [ ] Thread the CLI override options through `askLLM` and `askLLMStream`, ensuring they reach the AI SDK client factory.
- [ ] Extend provider/model selection logic so it respects CLI flags and stored config values.
- [ ] Verify via automated or manual tests that `mdchat ask --api-key <key>` works without `OPENAI_API_KEY` in the environment.

## 3. Persisted Config Is Never Loaded (High)
- `mdchat config set …` writes to `~/.mdchatrc`, yet `bin/mdchat.js` never loads that file before running commands. Every invocation only sees CLI flags and defaults, so saved credentials/configuration are silently ignored.

### Tasks
- [ ] Load the saved configuration via `loadConfig()` before executing command handlers.
- [ ] Define merge precedence between stored config, environment variables, and CLI overrides, and document it.
- [ ] Add coverage (unit or integration) confirming that previously saved keys/models are respected on subsequent runs.

## 4. CLI Version Output Is Stale (Medium)
- `package.json` publishes version `1.0.6`, while `bin/mdchat.js` hard-codes Commander to report `1.0.1`. Running `mdchat --version` shows the wrong version, leading to confusion when debugging or reporting bugs. The CLI should source the version from a single place.

### Tasks
- [ ] Source the CLI-reported version dynamically from `package.json` (or another single canonical location).
- [ ] Add a smoke test or CI check to ensure the CLI and `package.json` versions stay in sync.
- [ ] Update release documentation to mention the new versioning workflow, if necessary.
