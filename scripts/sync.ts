const bucket = process.env.S3_BUCKET;

if (!bucket) {
  throw new Error("S3_BUCKET is not defined");
}

const command = process.argv[2];

const localDirectory =
  process.argv[3] ??
  "/Users/wahabma/happybearlandia/data";

const remoteDirectory = `s3://${bucket}/data`;

if (!["push", "pull"].includes(command)) {
  console.log(`
Usage:

  bun sync.ts push [directory]
  bun sync.ts pull [directory]

Examples:

  bun sync.ts push
  bun sync.ts pull

  bun sync.ts push /path/to/data
`);
  process.exit(1);
}

const source =
  command === "push"
    ? localDirectory
    : remoteDirectory;

const destination =
  command === "push"
    ? remoteDirectory
    : localDirectory;

console.log(`${command.toUpperCase()}`);
console.log(source);
console.log("    ↓");
console.log(destination);

const child = Bun.spawn(
  [
    "aws",
    "s3",
    "sync",
    source,
    destination,
  ],
  {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  },
);

const exitCode = await child.exited;

if (exitCode !== 0) {
  throw new Error(
    `S3 sync failed with exit code ${exitCode}`,
  );
}

console.log("Done.");
