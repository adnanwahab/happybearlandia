import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rename, rm, stat } from 'node:fs/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const WIDTH = 1200;
export const HEIGHT = 630;
function run(command: string[]) {
  const result = Bun.spawnSync(command, { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(`${command[0]} failed (${result.exitCode}): ${result.stderr.toString().trim()}`);
  return result.stdout.toString();
}
function requireTool(name: string) {
  if (!Bun.which(name)) throw new Error(`${name} is required. Install FFmpeg (including FFprobe) and retry.`);
}
export async function checkPreview(directory = root) {
  requireTool('ffmpeg'); requireTool('ffprobe');
  let total = 0;
  for (const [name, codec] of [['preview.mp4', 'h264'], ['preview.jpg', 'mjpeg']]) {
    const path = join(directory, name);
    if (!(await Bun.file(path).exists())) throw new Error(`Missing ${name}; run bun run preview:generate.`);
    total += (await stat(path)).size;
    const probe = JSON.parse(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]));
    const streams = probe.streams;
    if (streams.length !== 1 || streams[0].codec_type !== 'video' || streams[0].codec_name !== codec || streams[0].width !== WIDTH || streams[0].height !== HEIGHT) throw new Error(`Invalid ${name}: expected one ${WIDTH}×${HEIGHT} ${codec} video stream, without audio.`);
    if (codec === 'h264' && (streams[0].pix_fmt !== 'yuv420p' || +probe.format.duration < 6 || +probe.format.duration > 8)) throw new Error('MP4 must be 6–8 seconds, H.264 yuv420p.');
    // Decode every frame: metadata alone cannot establish playable media.
    run(['ffmpeg', '-v', 'error', '-xerror', '-i', path, '-f', 'null', '-']);
  }
  if (total >= 5_000_000) throw new Error(`Preview assets exceed the 5 MB budget: ${total} bytes.`);
  console.log(`Preview validated: H.264 MP4 + JPEG, ${WIDTH}×${HEIGHT}, ${total} bytes total; full decode passed.`);
}
async function generate(input?: string) {
  requireTool('ffmpeg'); requireTool('ffprobe');
  const source = input ? resolve(input) : join(root, 'docs/evidence/she64/one-city-two-futures.mp4');
  if (!(await Bun.file(source).exists())) throw new Error(`Input video unavailable: ${source}`);
  const temp = await mkdtemp(join(root, '.preview-'));
  try {
    // Crop the existing demo to its paired city view; retain the synthetic-model disclosure.
    const filter = 'crop=iw:ih*0.72:0:0,scale=1200:630:force_original_aspect_ratio=decrease,pad=1200:630:(ow-iw)/2:(oh-ih)/2:color=0x102431,setsar=1';
    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', input ? '0' : '10', '-i', source, '-t', '7', '-an', '-vf', `${filter},fps=24`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-map_metadata', '-1', join(temp, 'preview.mp4')]);
    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '2', '-i', join(temp, 'preview.mp4'), '-frames:v', '1', '-q:v', '2', '-map_metadata', '-1', join(temp, 'preview.jpg')]);
    await checkPreview(temp);
    for (const name of ['preview.mp4', 'preview.jpg']) await rename(join(temp, name), join(root, name));
  } finally { await rm(temp, { recursive: true, force: true }); }
}
if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--check' && args.length === 1) await checkPreview();
    else if (args.length <= 1 && !args[0]?.startsWith('--')) await generate(args[0]);
    else throw new Error('Usage: bun run preview:generate [input-video] | bun run preview:check');
  } catch (error) { console.error(`Social preview: ${(error as Error).message}`); process.exitCode = 1; }
}
