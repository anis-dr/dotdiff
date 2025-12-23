/**
 * dotdiff CLI entry point
 * Syncs .env files with a TUI diff viewer
 *
 * Uses Effect.acquireRelease for proper renderer lifecycle management.
 * File watcher reads and updates state directly in Effect-land.
 */
import { Registry, RegistryContext } from "@effect-atom/atom-react";
import { Args, Command, HelpDoc, Span, ValidationError } from "@effect/cli";
import { DevTools } from "@effect/experimental";
import { FileSystem } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Console, Deferred, Effect, Fiber, Layer, Stream } from "effect";
import { App } from "./components/index.js";
import { parseEnvToMap } from "./services/envFormat.js";
import {
  EnvDiffer,
  EnvDifferLive,
  EnvParser,
  EnvParserLive,
  EnvWriterLive,
  FileWatcher,
  FileWatcherLive,
} from "./services/index.js";
import { findFileIndex } from "./state/fileSync.js";
import { filesAtom, setMessageOp, updateFileFromDiskOp } from "./state/index.js";
import type { EnvFile } from "./types.js";
import { FileIndex } from "./types.js";

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
      // Use 'on' instead of 'once' to ensure we catch repeated signals
      let shuttingDown = false;
      const handleShutdown = () => {
        if (shuttingDown) {
          // Second signal = force exit
          process.stdout.write(TERMINAL_RESTORE);
          process.exit(130);
        }
        shuttingDown = true;
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

      process.on("SIGINT", handleShutdown);
      process.on("SIGTERM", handleShutdown);
      process.once("uncaughtException", handleUncaughtException);
      process.once("unhandledRejection", handleUnhandledRejection);

      // Clean up signal handlers when scope closes
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          process.removeListener("SIGINT", handleShutdown);
          process.removeListener("SIGTERM", handleShutdown);
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
 * Start the file watcher and handle file changes directly in Effect-land.
 * Runs as a background fiber.
 *
 * This reads changed files and updates state directly, eliminating the need
 * for a React hook to bridge file events.
 *
 * Uses Effect.race with shutdown signal to ensure immediate termination,
 * bypassing any pending debounce timers in the stream.
 */
const startFileWatcher = (
  filePaths: ReadonlyArray<string>,
  registry: Registry.Registry,
  shutdownSignal: Deferred.Deferred<void>,
) =>
  Effect.gen(function*() {
    const watcher = yield* FileWatcher;
    const fs = yield* FileSystem.FileSystem;
    const watchStream = watcher.watchFiles(filePaths);

    // Race the stream processing against the shutdown signal
    // This ensures we exit immediately when shutdown is signaled,
    // even if debounce timers are pending
    yield* Effect.race(
      watchStream.pipe(
        Stream.runForEach((event) =>
          Effect.gen(function*() {
            // Find which file changed using current state from registry
            const files = registry.get(filesAtom);
            const fileIndex = findFileIndex(files, event.path);
            if (fileIndex === -1) return;

            const file = files[fileIndex];
            if (!file) return;

            // Re-read file from disk and update state
            const content = yield* fs.readFileString(file.path);
            const newVariables = parseEnvToMap(content);

            registry.set(updateFileFromDiskOp, { fileIndex: FileIndex.make(fileIndex), newVariables });
            registry.set(setMessageOp, `↻ ${file.filename} updated`);
          }).pipe(
            Effect.catchAll((err) =>
              Effect.sync(() => {
                registry.set(setMessageOp, `⚠ File read failed: ${String(err)}`);
              })
            ),
          )
        ),
      ),
      Deferred.await(shutdownSignal),
    ).pipe(
      Effect.catchAll((error) => Console.error(`File watcher error: ${String(error)}`)),
    );
  });

// Main command
const dotdiff = Command.make("dotdiff", { files: filesArg }, ({ files }) =>
  Effect.gen(function*() {
    const parser = yield* EnvParser;
    const differ = yield* EnvDiffer;

    // Parse all env files
    yield* Console.log(`Loading ${files.length} env files...`);
    const envFiles = yield* parser.parseFiles(files).pipe(
      Effect.withSpan("parseFiles", { attributes: { fileCount: files.length } }),
    );

    // Compute initial stats
    const diffRows = yield* differ.computeDiff(envFiles).pipe(
      Effect.withSpan("computeDiff"),
    );
    yield* Console.log(`Found ${diffRows.length} variables\n`);

    // Create shared registry for CLI ↔ React communication
    const registry = Registry.make();

    // Create shutdown signal
    const shutdownSignal = yield* Deferred.make<void>();

    // Start file watcher in background (pushes to shared registry)
    // Pass shutdownSignal so watcher can terminate cleanly even with debounce timers
    const filePaths = envFiles.map((f) => f.path);
    const watcherFiber = yield* startFileWatcher(filePaths, registry, shutdownSignal).pipe(
      Effect.withSpan("fileWatcher"),
      Effect.interruptible,
      Effect.fork,
    );

    // Render the TUI and wait for quit
    yield* renderApp(envFiles, shutdownSignal, registry).pipe(
      Effect.withSpan("renderApp"),
    );

    // Interrupt file watcher - should be fast since we used Effect.race
    yield* Fiber.interrupt(watcherFiber);

    // Natural completion - event loop is empty after proper cleanup
  }).pipe(Effect.withSpan("dotdiff.main"))).pipe(
    Command.withDescription("Compare and sync environment files side-by-side"),
  );

// Build the CLI
const cli = Command.run(dotdiff, {
  name: "dotdiff",
  version: "1.0.0",
  summary: Span.text("A TUI tool to compare and sync .env files"),
  footer: HelpDoc.blocks([
    HelpDoc.h2("Examples"),
    HelpDoc.p("$ dotdiff .env.local .env.prod"),
    HelpDoc.p("$ dotdiff .env.dev .env.staging .env.prod"),
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

// DevTools only in dev - tree-shaken via bun build --define process.env.NODE_ENV="production"
const DevToolsLayer = process.env.NODE_ENV === "production"
  ? Layer.empty
  : DevTools.layer();

const MainLive = ServicesLive.pipe(
  Layer.provideMerge(BunContext.layer),
  Layer.provideMerge(DevToolsLayer),
);

// Run with proper error handling
const program = cli(process.argv).pipe(
  Effect.scoped,
  Effect.provide(MainLive),
  Effect.catchIf(ValidationError.isValidationError, () =>
    Effect.gen(function*() {
      yield* Console.error("\nUsage: dotdiff <file1> <file2> [file3...]");
      yield* Console.error("Run 'dotdiff --help' for more information.");
      process.exit(1);
    })),
);

BunRuntime.runMain(program);
