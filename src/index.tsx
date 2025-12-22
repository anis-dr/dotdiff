/**
 * envy CLI entry point
 * Syncs .env files with a TUI diff viewer
 *
 * Uses Effect.acquireRelease for proper renderer lifecycle management
 * and PubSub for bridging file watcher events to React.
 */
import { Registry, RegistryContext } from "@effect-atom/atom-react";
import { Args, Command, HelpDoc, Span, ValidationError } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Console, Deferred, Effect, Layer, Stream } from "effect";
import { App } from "./components/index.js";
import {
  EnvDiffer,
  EnvDifferLive,
  EnvParser,
  EnvParserLive,
  EnvWriterLive,
  FileWatcher,
  FileWatcherLive,
} from "./services/index.js";
import { fileChangeEventAtom } from "./state/runtime.js";
import type { EnvFile } from "./types.js";

// CLI arguments: at least 2 .env file paths
const filesArg = Args.path({ name: "files", exists: "yes" }).pipe(
  Args.atLeast(2),
  Args.withDescription("Paths to .env files to compare (minimum 2)"),
);

// Terminal escape sequences to restore normal terminal state
const TERMINAL_RESTORE = "\x1b[?1000l" + // Disable mouse click tracking
  "\x1b[?1002l" + // Disable mouse button tracking
  "\x1b[?1003l" + // Disable all mouse tracking
  "\x1b[?1006l" + // Disable SGR mouse mode
  "\x1b[?1015l" + // Disable urxvt mouse mode
  "\x1b[?25h" + // Show cursor
  "\x1b[?1049l" + // Exit alternate screen buffer
  "\x1b[0m"; // Reset all attributes

/**
 * Restore terminal to normal state.
 * Safe to call multiple times.
 */
const restoreTerminal = Effect.sync(() => {
  try {
    process.stdout.write(TERMINAL_RESTORE);
  } catch {
    /* stdout may be closed */
  }
});

/**
 * Managed resource for the TUI renderer.
 * Uses Effect.acquireRelease for proper lifecycle management.
 */
const RendererResource = Effect.acquireRelease(
  Effect.promise(() => createCliRenderer({ exitOnCtrlC: false })),
  (renderer) =>
    Effect.sync(() => {
      try {
        renderer.stop();
      } catch {
        /* ignore */
      }
      try {
        process.stdout.write(TERMINAL_RESTORE);
      } catch {
        /* ignore */
      }
      try {
        renderer.destroy();
      } catch {
        /* ignore */
      }
    }),
);

/**
 * Render the TUI application.
 * Returns an Effect that resolves when the app signals quit.
 */
const renderApp = (
  envFiles: ReadonlyArray<EnvFile>,
  shutdownSignal: Deferred.Deferred<void>,
  registry: Registry.Registry,
) =>
  Effect.scoped(
    Effect.gen(function*() {
      const renderer = yield* RendererResource;

      // Register process signal handlers for clean shutdown
      const handleSigInt = () => {
        Effect.runSync(Deferred.succeed(shutdownSignal, undefined));
      };
      const handleSigTerm = () => {
        Effect.runSync(Deferred.succeed(shutdownSignal, undefined));
      };
      const handleUncaughtException = (err: Error) => {
        Effect.runSync(restoreTerminal);
        // eslint-disable-next-line no-console
        console.error("Uncaught exception:", err);
        process.exit(1);
      };
      const handleUnhandledRejection = (err: unknown) => {
        Effect.runSync(restoreTerminal);
        // eslint-disable-next-line no-console
        console.error("Unhandled rejection:", err);
        process.exit(1);
      };

      process.once("SIGINT", handleSigInt);
      process.once("SIGTERM", handleSigTerm);
      process.once("uncaughtException", handleUncaughtException);
      process.once("unhandledRejection", handleUnhandledRejection);

      // Clean up signal handlers when scope closes
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          process.removeListener("SIGINT", handleSigInt);
          process.removeListener("SIGTERM", handleSigTerm);
          process.removeListener("uncaughtException", handleUncaughtException);
          process.removeListener(
            "unhandledRejection",
            handleUnhandledRejection,
          );
        })
      );

      // Render the React app with shared registry
      createRoot(renderer).render(
        <RegistryContext.Provider value={registry}>
          <App
            initialFiles={envFiles}
            onQuit={() => {
              Effect.runSync(Deferred.succeed(shutdownSignal, undefined));
            }}
          />
        </RegistryContext.Provider>,
      );

      // Wait for shutdown signal
      yield* Deferred.await(shutdownSignal);
    }),
  );

/**
 * Start the file watcher and push events directly to the atom.
 * Runs as a background fiber.
 */
const startFileWatcher = (
  filePaths: ReadonlyArray<string>,
  registry: Registry.Registry,
) =>
  Effect.gen(function*() {
    const watcher = yield* FileWatcher;
    const watchStream = watcher.watchFiles(filePaths);

    // Push each file change event directly to the atom
    yield* Stream.runForEach(watchStream, (event) =>
      Effect.sync(() => {
        registry.set(fileChangeEventAtom, event);
      })).pipe(
        Effect.catchAll((error) => Console.error(`File watcher error: ${String(error)}`)),
      );
  });

// Main command
const envy = Command.make("envy", { files: filesArg }, ({ files }) =>
  Effect.gen(function*() {
    const parser = yield* EnvParser;
    const differ = yield* EnvDiffer;

    // Parse all env files
    yield* Console.log(`Loading ${files.length} env files...`);
    const envFiles = yield* parser.parseFiles(files);

    // Compute initial stats
    const diffRows = yield* differ.computeDiff(envFiles);
    yield* Console.log(`Found ${diffRows.length} variables\n`);

    // Create shared registry for CLI ↔ React communication
    const registry = Registry.make();

    // Create shutdown signal
    const shutdownSignal = yield* Deferred.make<void>();

    // Start file watcher in background (pushes to shared registry)
    const filePaths = envFiles.map((f) => f.path);
    yield* startFileWatcher(filePaths, registry).pipe(Effect.fork);

    // Render the TUI and wait for quit
    yield* renderApp(envFiles, shutdownSignal, registry);
  })).pipe(
    Command.withDescription("Compare and sync environment files side-by-side"),
  );

// Build the CLI
const cli = Command.run(envy, {
  name: "envy",
  version: "1.0.0",
  summary: Span.text("A TUI tool to compare and sync .env files"),
  footer: HelpDoc.blocks([
    HelpDoc.h2("Examples"),
    HelpDoc.p("$ envy .env.local .env.prod"),
    HelpDoc.p("$ envy .env.dev .env.staging .env.prod"),
    HelpDoc.h2("Keybindings"),
    HelpDoc.p(
      "↑↓/jk Navigate | ←→/hl Column | c Copy | v Paste | s Save | q Quit",
    ),
  ]),
});

// Service layers
const ServicesLive = Layer.mergeAll(
  EnvParserLive,
  EnvDifferLive,
  EnvWriterLive,
  FileWatcherLive,
);

const MainLive = ServicesLive.pipe(Layer.provideMerge(BunContext.layer));

// Run with proper error handling
const program = cli(process.argv).pipe(
  Effect.scoped,
  Effect.provide(MainLive),
  Effect.catchIf(ValidationError.isValidationError, () =>
    Effect.gen(function*() {
      yield* Console.error("\nUsage: envy <file1> <file2> [file3...]");
      yield* Console.error("Run 'envy --help' for more information.");
      process.exit(1);
    })),
);

BunRuntime.runMain(program);
