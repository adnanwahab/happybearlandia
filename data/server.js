import { mkdir } from "node:fs/promises";

const now = new Date();

const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");

const hour = String(now.getHours()).padStart(2, "0");
const minute = String(now.getMinutes()).padStart(2, "0");

const date = `${year}-${month}-${day}`;
const filename = `${hour}-${minute}.mp4`;

const baseDirectory = "/home/adnan/happybearlandia/data/webcam";
const directory = `${baseDirectory}/${date}`;
const outputPath = `${directory}/${filename}`;

await mkdir(directory, { recursive: true });

console.log(`Recording to: ${outputPath}`);

const ffmpeg = Bun.spawn([
  "ffmpeg",

  "-f",
  "v4l2",

  "-framerate",
  "30",

  "-video_size",
  "1920x1080",

  "-i",
  "/dev/video0",

  "-t",
  "900",

  "-c:v",
  "libx264",

  "-preset",
  "veryfast",

  outputPath,
], {
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

const exitCode = await ffmpeg.exited;

if (exitCode === 0) {
  console.log(`Finished recording: ${outputPath}`);
} else {
  console.error(`ffmpeg exited with code ${exitCode}`);
}
