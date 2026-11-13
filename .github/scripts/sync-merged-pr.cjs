'use strict';

// Branch identity is authoritative; PR titles/bodies are untrusted narrative.
function mergedIssue(event, repository) {
  const pr = event.pull_request;
  if (event.action !== 'closed' || pr?.merged !== true ||
      event.repository?.full_name !== repository ||
      pr.base?.repo?.full_name !== repository ||
      pr.head?.repo?.full_name !== repository) return null;
  const match = /^mini\/(SHE-[1-9]\d*)(?:-r[1-9]\d*)?$/.exec(pr.head.ref);
  if (!match || !Number.isSafeInteger(pr.number) || pr.number < 1) return null;
  return { identifier: match[1], url: `https://github.com/${repository}/pull/${pr.number}` };
}

async function syncMergedPR({ event, repository, token, fetchImpl = fetch }) {
  const target = mergedIssue(event, repository);
  if (!target) return { status: 'skipped' };
  if (!token) throw new Error('LINEAR_API_KEY repository secret is required; synchronization held');
  async function linear(query, variables) {
    // Never log remote errors: they can echo credentials or private input.
    let response;
    try {
      response = await fetchImpl('https://api.linear.app/graphql', {
        method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(30000),
      });
    } catch { throw new Error('Linear transport failed; rerun the job to reconcile'); }
    if (!response.ok) throw new Error('Linear HTTP request rejected; synchronization held');
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Invalid Linear response'); }
    if (payload.errors?.length || !payload.data) throw new Error('Linear query rejected; synchronization held');
    return payload.data;
  }
  const { issue } = await linear('query($id: String!) { issue(id: $id) { id identifier } }', { id: target.identifier });
  if (!issue?.id || issue.identifier !== target.identifier) throw new Error('Linear issue identity mismatch');
  // Linear upserts attachments by issue + URL, so reruns recover uncertain writes.
  const result = await linear('mutation($input: AttachmentCreateInput!) { attachmentCreate(input: $input) { success } }', {
    input: { issueId: issue.id, url: target.url, title: `Merged PR for ${target.identifier}`,
      subtitle: 'Merged source evidence; acceptance requires review' },
  });
  if (result.attachmentCreate?.success !== true) throw new Error('Linear attachment not confirmed; rerun to reconcile');
  return { status: 'linked', identifier: target.identifier };
}

module.exports = { mergedIssue, syncMergedPR };
