import { mkdir } from "node:fs/promises";

const now = new Date();

const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");

const hour = String(now.getHours()).padStart(2, "0");
const minute = String(now.getMinutes()).padStart(2, "0");

const date = `${year}-${month}-${day}`;
const filename = `${hour}-${minute}`;


// --------------------------------------------------
// Directories
// --------------------------------------------------

const webcamBaseDirectory =
  "/home/adnan/happybearlandia/data/webcam";

const microphoneBaseDirectory =
  "/home/adnan/happybearlandia/data/microphone";


const webcamDirectory =
  `${webcamBaseDirectory}/${date}`;

const microphoneDirectory =
  `${microphoneBaseDirectory}/${date}`;


// --------------------------------------------------
// Output files
// --------------------------------------------------

const videoOutputPath =
  `${webcamDirectory}/${filename}.mp4`;

const audioOutputPath =
  `${microphoneDirectory}/${filename}.m4a`;


// --------------------------------------------------
// Create directories
// --------------------------------------------------

await mkdir(webcamDirectory, {
  recursive: true,
});

await mkdir(microphoneDirectory, {
  recursive: true,
});


console.log(`Recording video to: ${videoOutputPath}`);
console.log(`Recording audio to: ${audioOutputPath}`);


// --------------------------------------------------
// Webcam
// --------------------------------------------------

const videoFFmpeg = Bun.spawn([
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

  videoOutputPath,
], {
  stdout: "inherit",
  stderr: "inherit",
});


// --------------------------------------------------
// USB Microphone
// --------------------------------------------------

const audioFFmpeg = Bun.spawn([
  "ffmpeg",

  "-f",
  "alsa",

  "-i",
  "hw:1,0",

  "-t",
  "900",

  "-c:a",
  "aac",

  "-b:a",
  "128k",

  audioOutputPath,
], {
  stdout: "inherit",
  stderr: "inherit",
});


// --------------------------------------------------
// Wait for both recordings
// --------------------------------------------------

const [videoExitCode, audioExitCode] = await Promise.all([
  videoFFmpeg.exited,
  audioFFmpeg.exited,
]);


// --------------------------------------------------
// Results
// --------------------------------------------------

if (videoExitCode === 0) {
  console.log(`Finished video: ${videoOutputPath}`);
} else {
  console.error(`Video ffmpeg exited with code ${videoExitCode}`);
}

if (audioExitCode === 0) {
  console.log(`Finished audio: ${audioOutputPath}`);
} else {
  console.error(`Audio ffmpeg exited with code ${audioExitCode}`);
}
