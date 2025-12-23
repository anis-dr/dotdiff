/**
 * EnvDiffer service - computes differences between env files
 */
import { Context, Effect, Layer } from "effect";
import type { DiffRow, EnvFile, VariableStatus } from "../types.js";
import { getVariableStatus } from "../types.js";
import { sortKeys } from "../utils/index.js";

export class EnvDiffer extends Context.Tag("@dotdiff/EnvDiffer")<
  EnvDiffer,
  {
    readonly computeDiff: (files: ReadonlyArray<EnvFile>) => Effect.Effect<ReadonlyArray<DiffRow>>;
  }
>() {}

export const EnvDifferLive = Layer.succeed(
  EnvDiffer,
  {
    computeDiff: (files: ReadonlyArray<EnvFile>): Effect.Effect<ReadonlyArray<DiffRow>> =>
      Effect.sync(() => {
        // Collect all unique keys across all files
        const allKeys = new Set<string>();
        for (const file of files) {
          for (const key of file.variables.keys()) {
            allKeys.add(key);
          }
        }

        // Sort keys alphabetically
        const sortedKeys = sortKeys(allKeys);

        // Build diff rows
        const rows: Array<DiffRow> = [];
        for (const key of sortedKeys) {
          const values: Array<string | null> = [];

          for (const file of files) {
            const value = file.variables.get(key);
            values.push(value ?? null);
          }

          const status = getVariableStatus(values);

          rows.push({
            key,
            values,
            status,
          });
        }

        // Sort: missing first, then different, then identical
        const statusOrder: Record<VariableStatus, number> = {
          missing: 0,
          different: 1,
          identical: 2,
        };

        rows.sort((a, b) => {
          const orderDiff = statusOrder[a.status] - statusOrder[b.status];
          if (orderDiff !== 0) return orderDiff;
          return a.key.toLowerCase().localeCompare(b.key.toLowerCase());
        });

        return rows;
      }),
  },
);
