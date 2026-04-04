# @hax/ai

`@hax/ai` is the publishable AI package in this workspace.

## Local checks

```bash
bun install
bun --cwd packages/ai run lint
bun --cwd packages/ai run typecheck
bun --cwd packages/ai run build
```

## Pack and publish

```bash
bun --cwd packages/ai publish --dry-run
bun --cwd packages/ai publish
```

The package is configured to publish to the npm registry as a **public** scoped package (`publishConfig.access` is `public`).
