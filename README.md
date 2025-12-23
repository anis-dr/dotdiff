# dotdiff

A TUI tool to compare and sync .env files side-by-side.

## Install

```bash
bun install
```

## Usage

```bash
bun run dev .env.local .env.prod
```

## Keybindings

| Key | Action |
|-----|--------|
| ↑↓/jk | Navigate rows |
| ←→/hl | Navigate columns |
| e/Enter | Edit value |
| a | Add variable |
| d | Delete from file |
| D | Delete from all files |
| c | Copy |
| v | Paste |
| V | Paste to all files |
| r | Revert change |
| u | Undo |
| U | Undo all |
| s | Save |
| q | Quit |
