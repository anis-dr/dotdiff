/**
 * Effect-atom runtime for service integration
 *
 * This creates an Atom.runtime that provides Effect services to atoms.
 * Enables atoms to use Effects with proper service access and lifecycle management.
 */
import { Atom } from "@effect-atom/atom-react";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import {
  EnvDifferLive,
  EnvParserLive,
  EnvWriter,
  EnvWriterLive,
  FileWatcherLive,
} from "../services/index.js";
import type { EnvFile, PendingChange } from "../types.js";

/**
 * Combined layer providing all application services.
 */
const AppServicesLive = Layer.mergeAll(
  EnvParserLive,
  EnvDifferLive,
  EnvWriterLive,
  FileWatcherLive
).pipe(Layer.provideMerge(BunContext.layer));

/**
 * Atom runtime with all application services.
 */
export const appRuntime = Atom.runtime(AppServicesLive);

/**
 * Argument type for the save changes atom
 */
export interface SaveChangesArgs {
  readonly files: ReadonlyArray<EnvFile>;
  readonly changes: ReadonlyArray<PendingChange>;
}

/**
 * Effectful atom for saving changes to disk.
 * Uses EnvWriter service directly from the runtime.
 *
 * Usage:
 *   const saveChanges = useAtomSet(saveChangesAtom)
 *   saveChanges({ files, changes: pendingList })
 */
export const saveChangesAtom = appRuntime.fn(
  Effect.fnUntraced(function* (args: SaveChangesArgs) {
    const writer = yield* EnvWriter;
    const updatedFiles = yield* writer.applyChanges(args.files, args.changes);
    return updatedFiles;
  })
);

/**
 * Type helper to extract the services available in appRuntime.
 */
export type AppServices = Layer.Layer.Success<typeof AppServicesLive>;
