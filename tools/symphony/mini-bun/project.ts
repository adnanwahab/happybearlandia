import path from 'node:path';
import { readFileSync } from 'node:fs';
export type Project = { schemaVersion: 1; name: string; repository: string; githubRepository: string; linearProjectId: string; linearProjectUrl: string; baseBranch: string; dataDirectory: string; syncIntervalMs?: number; heldIssues?: Record<string,string>; prerequisiteIssueIds?: string[] };
export function githubIdentity(remote: string) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return match?.[1].toLowerCase() ?? null;
}
export function readProject(file: string): Project {
  const source = path.resolve(file), config = JSON.parse(readFileSync(source, 'utf8'));
  if (config.schemaVersion !== 1 || typeof config.name !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(config.githubRepository ?? '') || !/^[0-9a-f-]{36}$/.test(config.linearProjectId ?? '') || !/^https:\/\/linear\.app\//.test(config.linearProjectUrl ?? '') || typeof config.repository !== 'string' || !config.repository || typeof config.dataDirectory !== 'string' || !config.dataDirectory || !/^[\w][\w./-]*$/.test(config.baseBranch ?? '') || config.baseBranch.includes('..')) throw Error('Invalid Mini Symphony project profile');
  if (config.syncIntervalMs !== undefined && (!Number.isInteger(config.syncIntervalMs) || config.syncIntervalMs < 10000)) throw Error('syncIntervalMs must be at least 10000');
  if (config.heldIssues !== undefined && (typeof config.heldIssues !== 'object' || config.heldIssues === null || Array.isArray(config.heldIssues) || Object.values(config.heldIssues).some(v => typeof v !== 'string'))) throw Error('Invalid heldIssues');
  if(config.prerequisiteIssueIds!==undefined&&(!Array.isArray(config.prerequisiteIssueIds)||config.prerequisiteIssueIds.some(id=>typeof id!=='string'||!/^\w+-\d+$/.test(id))))throw Error('Invalid project prerequisites');
  return { ...config, repository: path.resolve(path.dirname(source), config.repository), dataDirectory: path.resolve(path.dirname(source), config.dataDirectory) };
}
export function validateProjectTasks(tasks: any[], project?: Project) {
  if (!Array.isArray(tasks) || tasks.some(t => !t || typeof t.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(t.id) || typeof t.prompt !== 'string' || !t.prompt.trim() || (t.enabled !== undefined && typeof t.enabled !== 'boolean') || (t.retry !== undefined && typeof t.retry !== 'boolean')) || new Set(tasks.map(t => t.id)).size !== tasks.length) throw Error('Invalid tasks.json: expected unique safe IDs, prompts, and boolean flags');
  if (project && tasks.some(t => t.githubRepository !== project.githubRepository || t.linearProjectId !== project.linearProjectId)) throw Error('Task belongs to a different repository or Linear project');
}
export function projectBinding(project: Project) {
  return { githubRepository: project.githubRepository, linearProjectId: project.linearProjectId, repository: project.repository };
}
export function validateBinding(binding: any, project: Project) {
  const expected = projectBinding(project);
  if (Object.entries(expected).some(([key,value]) => binding[key] !== value)) throw Error('State directory is already bound to a different project');
}

// Project workers need CLI/runtime authentication, not the app's database/bot keys.
export function workerEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const names = ['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','TMP','TEMP','LANG','LC_ALL','TERM','COLORTERM','CODEX_HOME','OPENAI_API_KEY','OPENAI_BASE_URL','HTTP_PROXY','HTTPS_PROXY','NO_PROXY','SSL_CERT_FILE','NODE_EXTRA_CA_CERTS'];
  return Object.fromEntries(names.filter(name => env[name] !== undefined).map(name => [name,env[name]!])) as NodeJS.ProcessEnv;
}
