# @hexos/cli

CLI for installing and upgrading Hexos in an existing Next.js App Router project.

## Usage

```bash
npx @hexos/cli install
npx @hexos/cli upgrade
```

### Install

```bash
npx @hexos/cli install [project-path]
```

Key options:

- `--provider <anthropic|openai|ollama>`
- `--api-key <key>`
- `--ollama-host <url>`
- `--mcp-dashboard`
- `--agents <single|multi>`
- `--chat-route <segment>`
- `--yes`
- `--force`
- `--dry-run`
- `--package-manager <pnpm|npm|yarn>`

### Upgrade

```bash
npx @hexos/cli upgrade [project-path]
```

Key options:

- `--to <version>`
- `--adopt`
- `--yes`
- `--force`
- `--dry-run`
- `--package-manager <pnpm|npm|yarn>`

## Manifest

The CLI stores managed file metadata in:

- `.hexos/manifest.json`

Upgrade uses this manifest to safely detect modified files and avoid overwriting user changes without confirmation.
