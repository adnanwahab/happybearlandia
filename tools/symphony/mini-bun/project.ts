import path from 'node:path';
import type {PublicationOptions} from './publication';
import {validateScreenshotConfig,type ScreenshotConfig} from './screenshots';
import { readFileSync } from 'node:fs';
export type Project = { schemaVersion: 1; name: string; repository: string; githubRepository: string; linearProjectId: string; linearProjectUrl: string; baseBranch: string; dataDirectory: string; workspaceDirectory?: string; syncIntervalMs?: number; screenshots?: ScreenshotConfig; cleanupMergedWorkspaces?: boolean; requiredLabels?: string[]; heldIssues?: Record<string,string>; prerequisiteIssueIds?: string[]; draftIssueIds?: string[] };
export function githubIdentity(remote: string) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return match?.[1].toLowerCase() ?? null;
}
export function readProject(file: string): Project {
  const source = path.resolve(file), config = JSON.parse(readFileSync(source, 'utf8'));
  if (config.schemaVersion !== 1 || typeof config.name !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(config.githubRepository ?? '') || !/^[0-9a-f-]{36}$/.test(config.linearProjectId ?? '') || !/^https:\/\/linear\.app\//.test(config.linearProjectUrl ?? '') || typeof config.repository !== 'string' || !config.repository || typeof config.dataDirectory !== 'string' || !config.dataDirectory || (config.workspaceDirectory !== undefined && (typeof config.workspaceDirectory !== 'string' || !config.workspaceDirectory.trim())) || !/^[\w][\w./-]*$/.test(config.baseBranch ?? '') || config.baseBranch.includes('..')) throw Error('Invalid Mini Symphony project profile');
  if(config.cleanupMergedWorkspaces!==undefined&&typeof config.cleanupMergedWorkspaces!=='boolean')throw Error('Invalid cleanupMergedWorkspaces');
  if(config.screenshots!==undefined)validateScreenshotConfig(config.screenshots);
  if (config.syncIntervalMs !== undefined && (!Number.isInteger(config.syncIntervalMs) || config.syncIntervalMs < 10000)) throw Error('syncIntervalMs must be at least 10000');
  if(config.requiredLabels!==undefined&&(!Array.isArray(config.requiredLabels)||config.requiredLabels.some(x=>typeof x!=='string'||!x.trim())))throw Error('Invalid requiredLabels');
  if (config.heldIssues !== undefined && (typeof config.heldIssues !== 'object' || config.heldIssues === null || Array.isArray(config.heldIssues) || Object.values(config.heldIssues).some(v => typeof v !== 'string'))) throw Error('Invalid heldIssues');
  if(config.prerequisiteIssueIds!==undefined&&(!Array.isArray(config.prerequisiteIssueIds)||config.prerequisiteIssueIds.some(id=>typeof id!=='string'||!/^\w+-\d+$/.test(id))))throw Error('Invalid project prerequisites');
  validateDraftIssueIds(config.draftIssueIds);
  const repository = path.resolve(path.dirname(source), config.repository);
  const workspaceDirectory = config.workspaceDirectory === undefined
    ? path.join(path.dirname(repository), `.${path.basename(repository)}-mini-symphony-workspaces`)
    : path.resolve(path.dirname(source), config.workspaceDirectory);
  const relativeWorkspacePath = path.relative(repository, workspaceDirectory);
  if (!relativeWorkspacePath || (!relativeWorkspacePath.startsWith(`..${path.sep}`) && relativeWorkspacePath !== '..' && !path.isAbsolute(relativeWorkspacePath))) throw Error('workspaceDirectory must be outside the source repository');
  return { ...config, repository, dataDirectory: path.resolve(path.dirname(source), config.dataDirectory), workspaceDirectory };
}
export function validateProjectTasks(tasks: any[], project?: Project) {
  if (!Array.isArray(tasks) || tasks.some(t => !t || typeof t.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(t.id) || typeof t.prompt !== 'string' || !t.prompt.trim() || (t.enabled !== undefined && typeof t.enabled !== 'boolean') || (t.retry !== undefined && typeof t.retry !== 'boolean')) || new Set(tasks.map(t => t.id)).size !== tasks.length) throw Error('Invalid tasks.json: expected unique safe IDs, prompts, and boolean flags');
  for (const task of tasks) publicationOptionsForTask(project,task);
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
  const names = ['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','TMP','TEMP','LANG','LC_ALL','TERM','COLORTERM','CODEX_HOME','OPENAI_API_KEY','OPENAI_BASE_URL','HTTP_PROXY','HTTPS_PROXY','NO_PROXY','SSL_CERT_FILE','NODE_EXTRA_CA_CERTS','HBL_BROWSER_JOB_LIMIT','HBL_BROWSER_MIN_FREE_BYTES','HBL_BROWSER_JOB_DIRECTORY'];
  return Object.fromEntries(names.filter(name => env[name] !== undefined).map(name => [name,env[name]!])) as NodeJS.ProcessEnv;
}

const canonicalIssueId = /^[A-Z][A-Z0-9]*-[1-9]\d*$/;
export function validateDraftIssueIds(ids: unknown): asserts ids is string[] | undefined {
  if (ids !== undefined && (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !canonicalIssueId.test(id)) || new Set(ids).size !== ids.length)) throw Error('Invalid draftIssueIds: expected unique canonical issue IDs');
}
/** Trusted profile policy; issue revisions inherit their original issue's mode. */
export function publicationOptionsForTask(project: Pick<Project,'draftIssueIds'> | undefined, task: {id:string; issueId?:string}): PublicationOptions {
  validateDraftIssueIds(project?.draftIssueIds);
  const derived = /^([A-Z][A-Z0-9]*-[1-9]\d*)(?:-r[1-9]\d*)?$/.exec(task.id)?.[1];
  if (task.issueId !== undefined && (!canonicalIssueId.test(task.issueId) || (derived && derived !== task.issueId))) throw Error('Invalid publication issue identity');
  return {draft: (project?.draftIssueIds ?? []).includes(task.issueId ?? derived ?? '')};
}
