/**
 * EnvParser service - parses .env files into structured data
 */
import { Context, Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import type { EnvFile } from "../types.js"
import { parseEnvToMap } from "./envFormat.js"
import { FileReadError } from "../errors.js"
import * as path from "node:path"

export class EnvParser extends Context.Tag("EnvParser")<
  EnvParser,
  {
    readonly parseFile: (filePath: string) => Effect.Effect<EnvFile, FileReadError>
    readonly parseFiles: (filePaths: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<EnvFile>, FileReadError>
  }
>() {}

export const EnvParserLive = Layer.effect(
  EnvParser,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    
    const parseFile = (filePath: string): Effect.Effect<EnvFile, FileReadError> =>
      Effect.gen(function* () {
        const content = yield* fs.readFileString(filePath).pipe(
          Effect.mapError((e) => new FileReadError({ path: filePath, cause: e }))
        )
        
        const variables = parseEnvToMap(content)
        const filename = path.basename(filePath)
        
        return {
          path: filePath,
          filename,
          variables,
        }
      })
    
    const parseFiles = (filePaths: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<EnvFile>, FileReadError> =>
      Effect.all(filePaths.map(parseFile), { concurrency: "unbounded" })
    
    return {
      parseFile,
      parseFiles,
    }
  })
)
