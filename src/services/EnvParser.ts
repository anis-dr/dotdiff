/**
 * EnvParser service - parses .env files into structured data
 */
import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import * as path from "node:path";
import { FileReadError } from "../errors.js";
import { EnvFile, FilePath } from "../types.js";
import { parseEnvToMap } from "./envFormat.js";

export class EnvParser extends Context.Tag("@dotdiff/EnvParser")<
  EnvParser,
  {
    readonly parseFile: (filePath: string) => Effect.Effect<EnvFile, FileReadError>;
    readonly parseFiles: (filePaths: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<EnvFile>, FileReadError>;
  }
>() {}

export const EnvParserLive = Layer.effect(
  EnvParser,
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem;

    const parseFile = Effect.fn("EnvParser.parseFile")(
      function*(filePath: string) {
        const content = yield* fs.readFileString(filePath).pipe(
          Effect.mapError((e) => FileReadError.make({ path: filePath, cause: e })),
        );

        const variables = parseEnvToMap(content);
        const filename = path.basename(filePath);

        return EnvFile.make({
          path: FilePath.make(filePath),
          filename,
          variables,
        });
      },
    );

    const parseFiles = Effect.fn("EnvParser.parseFiles")(
      function*(filePaths: ReadonlyArray<string>) {
        return yield* Effect.all(filePaths.map(parseFile), { concurrency: "unbounded" });
      },
    );

    return EnvParser.of({
      parseFile,
      parseFiles,
    });
  }),
);
