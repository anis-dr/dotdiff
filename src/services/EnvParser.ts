/**
 * EnvParser service - parses .env files into structured data
 */
import { Context, Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import type { EnvFile } from "../types.js"
import * as path from "node:path"

export class EnvParser extends Context.Tag("EnvParser")<
  EnvParser,
  {
    readonly parseFile: (filePath: string) => Effect.Effect<EnvFile, Error>
    readonly parseFiles: (filePaths: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<EnvFile>, Error>
  }
>() {}

/**
 * Parse a single line of .env content
 * Handles: KEY=VALUE, KEY="VALUE", KEY='VALUE', comments, empty lines
 */
const parseLine = (line: string): readonly [string, string] | null => {
  const trimmed = line.trim()
  
  // Skip empty lines and comments
  if (trimmed === "" || trimmed.startsWith("#")) {
    return null
  }
  
  // Find the first = sign
  const eqIndex = trimmed.indexOf("=")
  if (eqIndex === -1) {
    return null
  }
  
  const key = trimmed.slice(0, eqIndex).trim()
  let value = trimmed.slice(eqIndex + 1).trim()
  
  // Handle quoted values
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  
  // Handle inline comments (only for unquoted values)
  if (!trimmed.slice(eqIndex + 1).trim().startsWith('"') &&
      !trimmed.slice(eqIndex + 1).trim().startsWith("'")) {
    const commentIndex = value.indexOf(" #")
    if (commentIndex !== -1) {
      value = value.slice(0, commentIndex).trim()
    }
  }
  
  return [key, value] as const
}

/**
 * Parse .env file content into a Map
 */
const parseContent = (content: string): ReadonlyMap<string, string> => {
  const variables = new Map<string, string>()
  const lines = content.split("\n")
  
  for (const line of lines) {
    const parsed = parseLine(line)
    if (parsed !== null) {
      const [key, value] = parsed
      variables.set(key, value)
    }
  }
  
  return variables
}

export const EnvParserLive = Layer.effect(
  EnvParser,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    
    const parseFile = (filePath: string): Effect.Effect<EnvFile, Error> =>
      Effect.gen(function* () {
        const content = yield* fs.readFileString(filePath).pipe(
          Effect.mapError((e) => new Error(`Failed to read file ${filePath}: ${e.message}`))
        )
        
        const variables = parseContent(content)
        const filename = path.basename(filePath)
        
        return {
          path: filePath,
          filename,
          variables,
        }
      })
    
    const parseFiles = (filePaths: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<EnvFile>, Error> =>
      Effect.all(filePaths.map(parseFile), { concurrency: "unbounded" })
    
    return {
      parseFile,
      parseFiles,
    }
  })
)

