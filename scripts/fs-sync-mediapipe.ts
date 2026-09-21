import { resolve } from "node:path";
import { watch } from "node:fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;
if (!bucket) throw new Error("S3_BUCKET is not defined");

const region = process.env.AWS_REGION ?? "us-east-1";
const s3Key = process.env.S3_KEY ?? "data/mediapipe/hand_rotation.json";

const projectRoot = resolve(import.meta.dir, "..");
const localPath = resolve(projectRoot, "data/mediapipe/hand_rotation.json");

const s3 = new S3Client({ region });

let uploading = false;
let queued = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function uploadOnce() {
  const file = Bun.file(localPath);

  if (!(await file.exists())) {
    console.warn(`[warn] File not found, skipping upload: ${localPath}`);
    return;
  }

  const body = new Uint8Array(await file.arrayBuffer());

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: body,
      ContentType: "application/json",
    }),
  );

  console.log(
    `[sync] ${new Date().toISOString()} ${localPath} -> s3://${bucket}/${s3Key}`,
  );
}

async function syncWithLock() {
  if (uploading) {
    queued = true;
    return;
  }

  uploading = true;
  try {
    await uploadOnce();
  } catch (err) {
    console.error("[error] Upload failed:", err);
  } finally {
    uploading = false;
    if (queued) {
      queued = false;
      // run one more time for any events that happened during upload
      await syncWithLock();
    }
  }
}

function scheduleSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void syncWithLock();
  }, 300); // debounce rapid file events
}

console.log(`[watch] Watching: ${localPath}`);
console.log(`[watch] Target: s3://${bucket}/${s3Key}`);

// Initial sync on startup
await syncWithLock();

// Watch for future changes
watch(localPath, (eventType) => {
  // eventType is usually "change" or "rename"
  console.log(`[event] ${eventType} detected`);
  scheduleSync();
});

setInterval(() => {
  console.log(`[interval]  detected`);
  scheduleSync();
}, 1000);

// Keep process alive
await new Promise(() => {});
