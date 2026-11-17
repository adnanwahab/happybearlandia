// Follow-up branches preserve the original Linear identifier.
export function miniIssueIdentifier(branch) {
  return /^mini\/(SHE-\d+)(?:-r[1-9]\d*)?$/.exec(branch)?.[1] ?? null;
}
