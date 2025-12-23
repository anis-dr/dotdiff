/**
 * Effect-atom runtime for service integration
 *
 * This creates an Atom.runtime that provides Effect services to atoms.
 * Enables atoms to use Effects with proper service access and lifecycle management.
 */
import { Atom } from "@effect-atom/atom-react";
import { BunContext } from "@effect/platform-bun";
import { Data, Effect, Layer } from "effect";
import { EnvDifferLive, EnvParserLive, EnvWriter, EnvWriterLive, FileWatcherLive } from "../services/index.js";
import type { EnvFile, PendingChange } from "../types.js";

/**
 * Combined layer providing all application services.
 */
const AppServicesLive = Layer.mergeAll(
  EnvParserLive,
  EnvDifferLive,
  EnvWriterLive,
  FileWatcherLive,
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
 * Result type for save operations using Data.TaggedEnum.
 * Enables typed error handling with pattern matching via SaveResult.$match.
 */
export type SaveResult = Data.TaggedEnum<{
  Success: { readonly files: ReadonlyArray<EnvFile>; };
  Failure: { readonly message: string; };
}>;

export const SaveResult = Data.taggedEnum<SaveResult>();

/**
 * Effectful atom for saving changes to disk.
 * Uses EnvWriter service directly from the runtime.
 * Returns a typed SaveResult for pattern matching instead of throwing.
 *
 * Usage:
 *   const saveChanges = useAtomSet(saveChangesAtom, { mode: "promise" })
 *   const result = await saveChanges({ files, changes: pendingList })
 *   SaveResult.$match(result, { Success: ..., Failure: ... })
 */
export const saveChangesAtom = appRuntime.fn(
  Effect.fnUntraced(function*(args: SaveChangesArgs) {
    const writer = yield* EnvWriter;
    const result = yield* writer.applyChanges(args.files, args.changes).pipe(
      Effect.map((files) => SaveResult.Success({ files })),
      Effect.catchAll((err) =>
        Effect.succeed(SaveResult.Failure({
          message: err instanceof Error ? err.message : String(err),
        }))
      ),
    );
    return result;
  }),
);

/**
 * Type helper to extract the services available in appRuntime.
 */
export type AppServices = Layer.Layer.Success<typeof AppServicesLive>;
