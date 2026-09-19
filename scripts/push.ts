const bucket = process.env.S3_BUCKET;

if (!bucket) {
  throw new Error("S3_BUCKET is not defined");
}

const localDirectory =
  process.argv[2] ??
  "/Users/wahabma/happybearlandia/data";

const remoteDirectory = `s3://${bucket}/data`;

console.log("Syncing:");
console.log(`  ${localDirectory}`);
console.log("       ↓");
console.log(`  ${remoteDirectory}`);

const child = Bun.spawn(
  [
    "aws",
    "s3",
    "sync",
    localDirectory,
    remoteDirectory,
  ],
  {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  },
);

const exitCode = await child.exited;

if (exitCode !== 0) {
  throw new Error(`AWS sync failed with exit code ${exitCode}`);
}

console.log("Sync complete.");
