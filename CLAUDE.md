# dotdiff

A TUI tool to compare and sync .env files. Built with Effect, @effect/cli, and OpenTUI.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Effect TypeScript
- **CLI**: @effect/cli
- **TUI**: OpenTUI with React renderer

## Commands

```bash
bun run dev        # Run the application
bun run build      # Compile TypeScript
bun run typecheck  # Type check without emitting
```

## Code Rules

**No arbitrary colors.** All colors must be defined in the `Colors` object in `src/types.ts`. Never use hardcoded hex values like `#FFFFFF` directly in components.

<!-- effect-solutions:start -->
## Effect Best Practices

**Before implementing Effect features**, run `effect-solutions list` and read the relevant guide.

Topics include: services and layers, data modeling, error handling, configuration, testing, HTTP clients, CLIs, observability, and project structure.

**Effect Source Reference:** `~/.local/share/effect-solutions/effect`
Search here for real implementations when docs aren't enough.

**Effect Atom Source Reference:** `~/.local/share/effect-solutions/effect-atom`
Search here for real implementations when docs aren't enough.

**OpenTUI Source Reference:** `~/.local/share/effect-solutions/opentui`
Search here for OpenTUI components, renderers, and TUI patterns. Key paths:
- `packages/core/` - Core library with renderables, renderer, and primitives
- `packages/react/` - React reconciler and hooks (useKeyboard, useRenderer, etc.)
- `packages/core/src/examples/` - Working examples
<!-- effect-solutions:end -->

