/**
 * EnvWriter service - writes changes back to .env files
 */
import { Context, Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import type { EnvFile, PendingChange } from "../types.js"

export class EnvWriter extends Context.Tag("EnvWriter")<
  EnvWriter,
  {
    readonly applyChanges: (
      files: ReadonlyArray<EnvFile>,
      changes: ReadonlyArray<PendingChange>
    ) => Effect.Effect<ReadonlyArray<EnvFile>, Error>
  }
>() {}

/**
 * Serialize a Map of variables back to .env format
 */
const serializeEnv = (variables: ReadonlyMap<string, string>): string => {
  const lines: string[] = []
  
  // Sort keys for consistent output
  const sortedKeys = Array.from(variables.keys()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )
  
  for (const key of sortedKeys) {
    const value = variables.get(key)
    if (value !== undefined) {
      // Quote values that contain spaces, #, or special characters
      const needsQuotes = /[\s#"'\\]/.test(value) || value === ""
      const escapedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value
      lines.push(`${key}=${escapedValue}`)
    }
  }
  
  return lines.join("\n") + "\n"
}

export const EnvWriterLive = Layer.effect(
  EnvWriter,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    
    const applyChanges = (
      files: ReadonlyArray<EnvFile>,
      changes: ReadonlyArray<PendingChange>
    ): Effect.Effect<ReadonlyArray<EnvFile>, Error> =>
      Effect.gen(function* () {
        // Group changes by file index
        const changesByFile = new Map<number, PendingChange[]>()
        for (const change of changes) {
          const existing = changesByFile.get(change.fileIndex) ?? []
          existing.push(change)
          changesByFile.set(change.fileIndex, existing)
        }
        
        // Apply changes to each file
        const updatedFiles: EnvFile[] = []
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i]!
          const fileChanges = changesByFile.get(i)
          
          if (fileChanges && fileChanges.length > 0) {
            // Create mutable copy of variables
            const newVariables = new Map(file.variables)
            
            for (const change of fileChanges) {
              if (change.newValue === null) {
                // Deletion: remove the key
                newVariables.delete(change.key)
              } else {
                // Addition or modification: set the value
                newVariables.set(change.key, change.newValue)
              }
            }
            
            // Write to disk
            const content = serializeEnv(newVariables)
            yield* fs.writeFileString(file.path, content).pipe(
              Effect.mapError((e) => new Error(`Failed to write file ${file.path}: ${e.message}`))
            )
            
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

