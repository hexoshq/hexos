# hexos

CLI for installing and upgrading Hexos in an existing Next.js App Router project.

## Usage

```bash
npx hexos           # interactive menu
npx hexos install
npx hexos upgrade
```

### Install

```bash
npx hexos install [project-path]
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

The installer injects CSS at the route level (for example `app/chat/layout.tsx`) by importing:

- `@hexos/react-ui/styles.css`
- `./hexos.css` when `--mcp-dashboard` is enabled

### Upgrade

```bash
npx hexos upgrade [project-path]
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

Upgrade also backfills missing route-level style files from legacy installations when they are absent.
