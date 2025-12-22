/**
 * envy CLI entry point
 * Syncs .env files with a TUI diff viewer
 */
import { Args, Command, HelpDoc, Span, ValidationError } from "@effect/cli";
import { FileSystem } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Console, Effect, Layer, Stream } from "effect";
import { RegistryProvider } from "@effect-atom/atom-react";
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
import { readFileFromDisk, findFileIndex } from "./state/fileSync.js";
import type { EnvFile } from "./types.js";

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

/** Callback type for file change notifications */
type FileChangeCallback = (fileIndex: number, newVars: ReadonlyMap<string, string>) => void;

/**
 * Render the TUI application with proper cleanup handling
 */
const renderApp = (
  envFiles: ReadonlyArray<EnvFile>,
  registerFileChangeCallback: (cb: FileChangeCallback) => void
) =>
  Effect.promise(async () => {
    const renderer = await createCliRenderer({ exitOnCtrlC: false });
    let isShuttingDown = false;
    let onFileChange: FileChangeCallback | null = null;

    // Register callback to receive file change events from the watcher
    registerFileChangeCallback((fileIndex, newVars) => {
      if (onFileChange) {
        onFileChange(fileIndex, newVars);
      }
    });

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

    // The App will register its callback via onRegisterFileChange
    const handleRegisterFileChange = (cb: FileChangeCallback) => {
      onFileChange = cb;
    };

    createRoot(renderer).render(
      <RegistryProvider>
        <App
          initialFiles={envFiles}
          onQuit={() => shutdown(0)}
          onRegisterFileChange={handleRegisterFileChange}
        />
      </RegistryProvider>
    );
  });

// Main command
const envy = Command.make("envy", { files: filesArg }, ({ files }) =>
  Effect.gen(function* () {
    const parser = yield* EnvParser;
    const differ = yield* EnvDiffer;
    const watcher = yield* FileWatcher;

    // Parse all env files
    yield* Console.log(`Loading ${files.length} env files...`);
    const envFiles = yield* parser.parseFiles(files);

    // Compute initial stats
    const diffRows = yield* differ.computeDiff(envFiles);
    yield* Console.log(`Found ${diffRows.length} variables\n`);

    // Callback that will be set by the App component
    let fileChangeCallback: FileChangeCallback | null = null;

    const registerFileChangeCallback = (cb: FileChangeCallback) => {
      fileChangeCallback = cb;
    };

    // Render the TUI - saving is now handled by saveChangesAtom in the runtime
    yield* renderApp(envFiles, registerFileChangeCallback);

    // Start file watcher in background
    const filePaths = envFiles.map((f) => f.path);
    const watchStream = watcher.watchFiles(filePaths);

    // Fork the watcher to run in background
    yield* Stream.runForEach(watchStream, (event) =>
      Effect.gen(function* () {
        // Find which file changed
        const fileIndex = findFileIndex(envFiles, event.path);
        if (fileIndex === -1) return;

        // Re-read the file from disk
        const file = envFiles[fileIndex];
        if (!file) return;

        const newVars = yield* readFileFromDisk(file.path).pipe(
          Effect.catchAll((error) =>
            Console.error(`Failed to read ${file.path}: ${error.message}`).pipe(
              Effect.as(null)
            )
          )
        );

        if (newVars && fileChangeCallback) {
          // Notify the App component
          fileChangeCallback(fileIndex, newVars);
        }
      })
    ).pipe(
      Effect.catchAll((error) =>
        Console.error(`File watcher error: ${String(error)}`)
      ),
      Effect.fork
    );

    // Effect.never keeps the fiber alive so the file watcher and TUI continue running
    return yield* Effect.never;
  })
).pipe(
  Command.withDescription("Compare and sync environment files side-by-side")
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
      "↑↓/jk Navigate | ←→/hl Column | c Copy | v Paste | s Save | q Quit"
    ),
  ]),
});

// Service layers
const ServicesLive = Layer.mergeAll(
  EnvParserLive,
  EnvDifferLive,
  EnvWriterLive,
  FileWatcherLive
);

const MainLive = ServicesLive.pipe(Layer.provideMerge(BunContext.layer));

// Run with proper error handling
const program = cli(process.argv).pipe(
  Effect.provide(MainLive),
  Effect.catchIf(ValidationError.isValidationError, () =>
    Effect.gen(function* () {
      yield* Console.error("\nUsage: envy <file1> <file2> [file3...]");
      yield* Console.error("Run 'envy --help' for more information.");
      process.exit(1);
    })
  )
);

BunRuntime.runMain(program);
