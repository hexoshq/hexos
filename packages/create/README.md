# @hexos/create

A CLI tool for scaffolding a new Hexos AI chat application.

## Usage

Requires [Node.js](https://nodejs.org/en/) v20+ to be installed.

```sh
npx @hexos/create my-app
```

## Options

### `--log-level`

Control output verbosity. Valid options: `silent`, `info`, `verbose`. Default: `info`.

```sh
npx @hexos/create my-app --log-level verbose
```

### `--use-npm`

Use npm instead of the default pnpm.

```sh
npx @hexos/create my-app --use-npm
```

### `--ci`

Run without prompts for CI scenarios.

```sh
npx @hexos/create my-app --ci
```
