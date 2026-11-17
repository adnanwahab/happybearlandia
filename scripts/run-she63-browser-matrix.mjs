#!/usr/bin/env node
// SHE-63 browser tests need a real loopback server, not a fixed shared port.
// Run on a host with permission to bind sockets and launch Playwright engines.
import { createServer } from 'node:net';
import { spawn,execFileSync } from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

function freeLoopbackPort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      const address = probe.address();
      probe.close((error) => {
        if (error) reject(error);
        else if (!address || typeof address === 'string') reject(new Error('Expected TCP port'));
        else resolve(address.port);
      });
    });
  });
}

async function main() {
  const artifacts=process.env.HBL_SHE63_ARTIFACT_DIR||join(tmpdir(),'hbl-she63-matrix');
  await mkdir(artifacts,{recursive:true});
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
  const event=process.env.GITHUB_EVENT_PATH?JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8')):null;
  await writeFile(join(artifacts,'source.json'),JSON.stringify({schemaVersion:'hbl.she63-source.v1',commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),trackedChanges:git('status','--porcelain','--untracked-files=no'),pullRequestHead:event?.pull_request?.head?.sha??null,pullRequestBase:event?.pull_request?.base?.sha??null,workflowRun:process.env.GITHUB_RUN_ID??null,workflowAttempt:process.env.GITHUB_RUN_ATTEMPT??null,physicalDevicesTested:false},null,2));
  let port = process.env.HBL_SHE63_PORT;
  if (port) {
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      console.error('[SHE-63] HBL_SHE63_PORT must be a TCP port from 1 to 65535.');
      process.exitCode = 2;
      return;
    }
  } else {
    try {
      // The probe releases its listener before Playwright starts the app.
      // This minimizes collision risk; the exact same port goes to server and baseURL.
      port = String(await freeLoopbackPort());
    } catch (error) {
      console.error(`[SHE-63] Cannot allocate a loopback port: ${error.code || error.message}`);
      console.error('Changing port numbers cannot bypass an EPERM sandbox. Use a trusted local or CI browser runner.');
      process.exitCode = 2;
      return;
    }
  }

  console.log(`[SHE-63] Running real browser matrix on 127.0.0.1:${port}`);
  const executable = process.platform === 'win32' ? 'bunx.cmd' : 'bunx';
  const args = ['playwright', 'test', '--config', 'test/she63-release-matrix.config.js', ...process.argv.slice(2)];
  const exitCode = await new Promise((resolve) => {
    const child = spawn(executable, args, {
      stdio: 'inherit',
      env: { ...process.env, HBL_SHE63_PORT: port, HBL_BIND_HOST: '127.0.0.1' },
    });
    child.once('error', (error) => {
      console.error(`[SHE-63] Browser runner did not start: ${error.message}`);
      resolve(2);
    });
    child.once('close', (code, signal) => resolve(code ?? (signal ? 128 : 1)));
  });
  process.exitCode = exitCode;
}

await main();
