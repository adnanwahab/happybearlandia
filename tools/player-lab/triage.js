import { readFile, writeFile } from 'node:fs/promises';
import { triageDraft } from './lab.js';
export async function submitFinding(run, teamId, request) {
  const draft = triageDraft(run);
  const data = await request('query($id:String!){team(id:$id){states{nodes{id type}}}}', { id: teamId });
  const state = data.team?.states.nodes.find(item => item.type === 'triage');
  if (!state) throw new Error('Team has no Triage state; refusing fallback to executable backlog');
  const result = await request('mutation($input:IssueCreateInput!){issueCreate(input:$input){success issue{id identifier url}}}',
    { input: { teamId, stateId: state.id, ...draft } });
  if (!result.issueCreate?.success || !result.issueCreate.issue) throw new Error('Linear did not confirm issue creation');
  return result.issueCreate.issue;
}
if (import.meta.main) {
  const [file, teamId, flag] = process.argv.slice(2);
  const run = JSON.parse(await readFile(file, 'utf8'));
  if (flag !== '--submit') console.log(JSON.stringify(triageDraft(run), null, 2));
  else {
    if (!teamId || !process.env.LINEAR_API_KEY) throw new Error('Submission requires team ID and LINEAR_API_KEY');
    // Exclusive receipt prevents accidental repeated submission, including ambiguous timeouts.
    const receiptPath = file + '.triage.json';
    await writeFile(receiptPath, JSON.stringify({ status: 'pending' }), { flag: 'wx', mode: 0o600 });
    const issue = await submitFinding(run, teamId, async (query, variables) => {
      const response = await fetch('https://api.linear.app/graphql', { method: 'POST',
        headers: { Authorization: process.env.LINEAR_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Linear HTTP ${response.status}`);
      const body = await response.json();
      if (body.errors?.length) throw new Error('Linear rejected request; inspect pending receipt before retrying');
      return body.data;
    });
    await writeFile(receiptPath, JSON.stringify({ status: 'created', issue }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(issue));
  }
}
