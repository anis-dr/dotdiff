/**
 * env-differ CLI entry point
 * Syncs .env files with a TUI diff viewer
 */
import { Args, Command, HelpDoc, Span, ValidationError } from "@effect/cli";
import { FileSystem } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Console, Effect, Layer } from "effect";
import { App } from "./components/index.js";
import {
  EnvDiffer,
  EnvDifferLive,
  EnvParser,
  EnvParserLive,
  EnvWriter,
  EnvWriterLive,
} from "./services/index.js";
import type { EnvFile, PendingChange } from "./types.js";

// CLI arguments: at least 2 .env file paths
const filesArg = Args.path({ name: "files", exists: "yes" }).pipe(
  Args.atLeast(2),
  Args.withDescription("Paths to .env files to compare (minimum 2)")
);

// Terminal escape sequences to restore normal terminal state
const TERMINAL_RESTORE =
  "\x1b[?1000l" + // Disable mouse click tracking
  "\x1b[?1002l" + // Disable mouse button tracking
  "\x1b[?1003l" + // Disable all mouse tracking
  "\x1b[?1006l" + // Disable SGR mouse mode
  "\x1b[?1015l" + // Disable urxvt mouse mode
  "\x1b[?25h" + // Show cursor
  "\x1b[?1049l" + // Exit alternate screen buffer
  "\x1b[0m"; // Reset all attributes

/**
 * Render the TUI application with proper cleanup handling
 */
const renderApp = (
  envFiles: ReadonlyArray<EnvFile>,
  diffRows: Awaited<
    ReturnType<
      typeof import("./services/index.js").EnvDiffer.Service["computeDiff"]
    >
  > extends Effect.Effect<infer A>
    ? A
    : never,
  saveEffect: (changes: ReadonlyArray<PendingChange>) => Promise<void>
) =>
  Effect.promise(async () => {
    const renderer = await createCliRenderer({ exitOnCtrlC: false });
    let isShuttingDown = false;

    const restoreTerminal = () => {
      try {
        process.stdout.write(TERMINAL_RESTORE);
      } catch {
        /* stdout may be closed */
      }
    };

    const shutdown = (exitCode = 0) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      // 1. Stop the renderer (stops render loop, keyboard handling)
      try {
        renderer.stop();
      } catch {
        /* ignore */
      }

      // 2. Restore terminal state (cursor, mouse, alt screen)
      restoreTerminal();

      // 3. Destroy renderer resources
      try {
        renderer.destroy();
      } catch {
        /* ignore */
      }

      // 4. Exit on next tick to allow stdout to flush
      setImmediate(() => process.exit(exitCode));
    };

    // Register cleanup handlers for all exit scenarios
    process.once("exit", restoreTerminal);
    process.once("SIGINT", () => shutdown(130)); // 128 + SIGINT(2)
    process.once("SIGTERM", () => shutdown(143)); // 128 + SIGTERM(15)
    process.once("uncaughtException", (err) => {
      restoreTerminal();
      console.error("Uncaught exception:", err);
      process.exit(1);
    });
    process.once("unhandledRejection", (err) => {
      restoreTerminal();
      console.error("Unhandled rejection:", err);
      process.exit(1);
    });

    const handleSave = (changes: ReadonlyArray<PendingChange>) => {
      saveEffect(changes).catch(console.error);
    };

    createRoot(renderer).render(
      <App
        initialFiles={envFiles}
        initialDiffRows={diffRows}
        onSave={handleSave}
        onQuit={() => shutdown(0)}
      />
    );
  });

// Main command
const envDiffer = Command.make("env-differ", { files: filesArg }, ({ files }) =>
  Effect.gen(function* () {
    const parser = yield* EnvParser;
    const differ = yield* EnvDiffer;
    const writer = yield* EnvWriter;
    const fs = yield* FileSystem.FileSystem;

    // Parse all env files
    yield* Console.log(`Loading ${files.length} env files...`);
    const envFiles = yield* parser.parseFiles(files);

    // Compute diff
    const diffRows = yield* differ.computeDiff(envFiles);
    yield* Console.log(`Found ${diffRows.length} variables\n`);

    // Create save function that uses the writer service
    const saveEffect = async (changes: ReadonlyArray<PendingChange>) => {
      await Effect.runPromise(
        writer
          .applyChanges(envFiles, changes)
          .pipe(Effect.provideService(FileSystem.FileSystem, fs))
      );
    };

    // Render the TUI
    yield* renderApp(envFiles, diffRows, saveEffect);

    // Keep the process alive
    return yield* Effect.never;
  })
).pipe(
  Command.withDescription("Compare and sync environment files side-by-side")
);

// Build the CLI
const cli = Command.run(envDiffer, {
  name: "env-differ",
  version: "1.0.0",
  summary: Span.text("A TUI tool to compare and sync .env files"),
  footer: HelpDoc.blocks([
    HelpDoc.h2("Examples"),
    HelpDoc.p("$ env-differ .env.local .env.prod"),
    HelpDoc.p("$ env-differ .env.dev .env.staging .env.prod"),
    HelpDoc.h2("Keybindings"),
    HelpDoc.p(
      "↑↓/jk Navigate | ←→/hl Column | c Copy | v Paste | s Save | q Quit"
    ),
  ]),
});

// Service layers
const ServicesLive = Layer.mergeAll(
  EnvParserLive,
  EnvDifferLive,
  EnvWriterLive
);

const MainLive = ServicesLive.pipe(Layer.provideMerge(BunContext.layer));

// Run with proper error handling
const program = cli(process.argv).pipe(
  Effect.provide(MainLive),
  Effect.catchIf(ValidationError.isValidationError, () =>
    Effect.gen(function* () {
      yield* Console.error("\nUsage: env-differ <file1> <file2> [file3...]");
      yield* Console.error("Run 'env-differ --help' for more information.");
      process.exit(1);
    })
  )
);

BunRuntime.runMain(program);
