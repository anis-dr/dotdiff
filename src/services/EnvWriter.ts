/**
 * EnvWriter service - writes changes back to .env files
 *
 * Uses patch-based approach to preserve comments, blank lines, and ordering.
 * Only lines with changed keys are modified; everything else is preserved byte-for-byte.
 */
import { Context, Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import type { EnvFile, PendingChange } from "../types.js"
import { groupChangesByFile } from "../utils/index.js"
import { parseEnvLines, patchEnvContent } from "./envFormat.js"
import { FileReadError, FileWriteError } from "../errors.js"

/** Union of errors that can occur during file write operations */
export type EnvWriterError = FileReadError | FileWriteError

export class EnvWriter extends Context.Tag("EnvWriter")<
  EnvWriter,
  {
    readonly applyChanges: (
      files: ReadonlyArray<EnvFile>,
      changes: ReadonlyArray<PendingChange>
    ) => Effect.Effect<ReadonlyArray<EnvFile>, EnvWriterError>
  }
>() {}

export const EnvWriterLive = Layer.effect(
  EnvWriter,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    
    const applyChanges = (
      files: ReadonlyArray<EnvFile>,
      changes: ReadonlyArray<PendingChange>
    ): Effect.Effect<ReadonlyArray<EnvFile>, EnvWriterError> =>
      Effect.gen(function* () {
        const changesByFile = groupChangesByFile(changes)
        
        // Apply changes to each file using patch-based approach
        const updatedFiles: EnvFile[] = []
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i]!
          const fileChanges = changesByFile.get(i)
          
          if (fileChanges && fileChanges.length > 0) {
            // Read original file content
            const originalContent = yield* fs.readFileString(file.path).pipe(
              Effect.mapError((e) => new FileReadError({ path: file.path, cause: e }))
            )

            // Determine which keys already exist in this file based on actual content
            const existingKeys = new Set<string>()
            for (const line of parseEnvLines(originalContent)) {
              if (line.type === "assignment" && line.key) {
                existingKeys.add(line.key)
              }
            }
            
            // Separate changes into modifications/deletions and additions
            const modifications = new Map<string, string | null>()
            const additions = new Map<string, string>()
            
            for (const change of fileChanges) {
              if (change.newValue === null) {
                // Deletion
                modifications.set(change.key, null)
              } else if (!existingKeys.has(change.key)) {
                // Key doesn't exist in this file yet: add at end (even if empty string)
                additions.set(change.key, change.newValue)
              } else {
                // Modification
                modifications.set(change.key, change.newValue)
              }
            }
            
            // Apply changes using patch-based approach (preserves comments/order)
            const newContent = patchEnvContent(originalContent, modifications, additions)
            
            // Write patched content back to disk
            yield* fs.writeFileString(file.path, newContent).pipe(
              Effect.mapError((e) => new FileWriteError({ path: file.path, cause: e }))
            )
            
            // Update in-memory variables map
            const newVariables = new Map(file.variables)
            for (const change of fileChanges) {
              if (change.newValue === null) {
                newVariables.delete(change.key)
              } else {
                newVariables.set(change.key, change.newValue)
              }
            }
            
            updatedFiles.push({
              ...file,
              variables: newVariables,
            })
          } else {
            updatedFiles.push(file)
          }
        }
        
        return updatedFiles
      })
    
    return {
      applyChanges,
    }
  })
)
