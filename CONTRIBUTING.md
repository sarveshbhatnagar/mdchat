# Contributing to mdchat

Thank you for your interest in contributing to mdchat! 🎉

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/sarveshbhatnagar/mdchat.git
cd mdchat

# Install dependencies
npm install

# Test the CLI
node bin/mdchat.js --help
```

### Testing

Run the test suite to ensure everything is working:

```bash
npm test
```

This includes a version sync check that ensures the CLI reports the correct version from `package.json`.

## Releasing

### Version Management

The CLI version is automatically read from `package.json`. To release a new version:

1. Update the version in `package.json`:
   ```bash
   npm version patch  # or minor, or major
   ```

2. Verify the CLI reports the correct version:
   ```bash
   node bin/mdchat.js --version
   npm run check-version
   ```

3. Commit and push the changes:
   ```bash
   git push && git push --tags
   ```

4. Publish to npm:
   ```bash
   npm publish
   ```

**Important**: Do not manually edit the version string in `bin/mdchat.js`. The CLI dynamically reads the version from `package.json` to ensure consistency.

### CI Checks

The version sync check runs automatically in CI to ensure the CLI and `package.json` versions stay in sync. If this check fails, it means the CLI is not correctly reading the version from `package.json`.

## Questions?

If you have any questions or need help, feel free to open an issue!
