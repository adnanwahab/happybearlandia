import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const projectRoot = process.cwd();
const baseUrl = 'http://localhost:3000';
const sceneDir = join(projectRoot, 'game', 'scene');
const outputDir = join(projectRoot, 'data', 'screenshots');
const tempRoot = join(outputDir, '.tmp-frames');

const fps = 10;
const durationSeconds = 5;
const frameCount = fps * durationSeconds;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function canReachServer() {
  try {
    const response = await fetch(`${baseUrl}/game/1`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canReachServer()) {
      return true;
    }

    await delay(500);
  }

  return false;
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}\n${stderr}`));
      }
    });
  });
}

async function ensureFfmpeg() {
  try {
    await runCommand('ffmpeg', ['-version'], projectRoot);
  } catch {
    throw new Error('ffmpeg is required to build GIF files. Please install ffmpeg and rerun this script.');
  }
}

async function getSceneIds() {
  const entries = await readdir(sceneDir, { withFileTypes: true });

  return entries
    .filter(entry => entry.isFile() && /^\d+\.json$/i.test(entry.name))
    .map(entry => entry.name.replace(/\.json$/i, ''))
    .sort((a, b) => Number(a) - Number(b));
}

async function createGifForScene(browser, sceneId) {
  const frameDir = join(tempRoot, `scene-${sceneId}`);
  const sceneOutputPath = join(outputDir, `${sceneId}.gif`);

  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  await page.goto(`${baseUrl}/game/${sceneId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const framePath = join(frameDir, `frame-${String(frame).padStart(3, '0')}.png`);
    await page.screenshot({ path: framePath });
    await page.waitForTimeout(1000 / fps);
  }

  await context.close();

  await runCommand(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      'frame-%03d.png',
      '-vf',
      'fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
      sceneOutputPath,
    ],
    frameDir,
  );

  await rm(frameDir, { recursive: true, force: true });

  console.log(`Created ${sceneOutputPath}`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await mkdir(tempRoot, { recursive: true });

  await ensureFfmpeg();

  let serverProcess = null;

  if (!(await canReachServer())) {
    console.log('Starting local game server...');
    serverProcess = spawn('bun', ['server.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    const ready = await waitForServer();

    if (!ready) {
      serverProcess.kill('SIGTERM');
      throw new Error('Server did not become ready at http://localhost:3000 in time.');
    }
  }

  const sceneIds = await getSceneIds();

  if (sceneIds.length === 0) {
    throw new Error('No numeric scene files found in game/scene.');
  }

  console.log(`Generating 5-second GIFs for scenes: ${sceneIds.join(', ')}`);

  const browser = await chromium.launch({ headless: true });

  try {
    for (const sceneId of sceneIds) {
      await createGifForScene(browser, sceneId);
    }
  } finally {
    await browser.close();
    await rm(tempRoot, { recursive: true, force: true });

    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }

  console.log('Done. GIFs are in data/screenshots');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
