const result = await Bun.build({
  entrypoints: ["./src/index.tsx"],
  compile: {
    outfile: "./bin/dotdiff",
  },
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("Build successful:", result.outputs[0]?.path);

export {};
