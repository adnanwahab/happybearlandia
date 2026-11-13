#!/usr/bin/env node
// GitHub Actions helper: close only the SHE issue named by a merged mini/<ID> branch.
import { miniIssueIdentifier } from './mini-issue-identifier.mjs';

const token = process.env.LINEAR_API_KEY;
const headRef = process.env.PR_HEAD_REF ?? '';
const merged = process.env.PR_MERGED === 'true';
if (!merged) process.exit(0);
if (!token) throw new Error('LINEAR_API_KEY is required');
const identifier = miniIssueIdentifier(headRef);
if (!identifier) {
  console.log(`Ignoring non-Mini-Symphony branch: ${headRef}`);
  process.exit(0);
}

async function graphql(query, variables) {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length) {
    throw new Error(`Linear GraphQL request failed: ${JSON.stringify(result.errors ?? result)}`);
  }
  return result.data;
}

const issueData = await graphql(
  'query($id:String!){issue(id:$id){id identifier state{id name type} team{id}}}',
  { id: identifier },
);
const issue = issueData.issue;
if (!issue) throw new Error(`Linear issue ${identifier} was not found`);
if (issue.state?.type === 'completed') {
  console.log(`${identifier} is already complete`);
  process.exit(0);
}

const stateData = await graphql(
  'query{workflowStates{nodes{id name type team{id}}}}',
  {},
);
const completed = stateData.workflowStates.nodes
  .filter(state => state.team?.id === issue.team.id && state.type === 'completed')
  .sort((a, b) => Number(b.name.toLowerCase() === 'done') - Number(a.name.toLowerCase() === 'done'))[0];
if (!completed) throw new Error(`No completed workflow state found for Linear team ${issue.team.id}`);

const result = await graphql(
  'mutation($id:String!,$stateId:String!){issueUpdate(id:$id,input:{stateId:$stateId}){success issue{identifier state{name type}}}}',
  { id: issue.id, stateId: completed.id },
);
if (!result.issueUpdate.success) throw new Error(`Linear did not close ${identifier}`);
console.log(`Closed ${identifier} as ${result.issueUpdate.issue.state.name}`);
