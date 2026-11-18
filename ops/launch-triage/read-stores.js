import { Database } from 'bun:sqlite';
import { buildQueue } from './queue.js';

// Read existing files only: no migrations, initialization, cookies or voter keys.
export function readStores({ countsPath, patchPath, backlog }) {
  const countsDB = new Database(countsPath, { readonly: true });
  try {
    const patchDB = new Database(patchPath, { readonly: true });
    try {
      return buildQueue({ backlog,
        counts: countsDB.query('SELECT kind,moment,count FROM feedback_counts ORDER BY kind,moment').all(),
        suggestions: patchDB.query('SELECT id,title,details,created_at,status,kind,replay_seed,merged_into,world_context FROM suggestion ORDER BY id').all(),
        votes: patchDB.query(`SELECT b.id,b.title,b.closes_at AS closesAt,
          COUNT(v.value) AS votes, COALESCE(SUM(v.value),0) AS score,
          COALESCE(SUM(CASE WHEN v.value=1 THEN 1 ELSE 0 END),0) AS upvotes,
          g.pr_number,g.head_sha,g.status
          FROM ballot b LEFT JOIN vote v ON v.candidate_id=b.id
          LEFT JOIN github_patch g ON g.candidate_id=b.id GROUP BY b.id ORDER BY b.id`).all()
          .map(({pr_number, head_sha, status, ...row}) => ({ ...row,
            github: pr_number ? { prNumber: pr_number, headSha: head_sha, status } : null }))
      });
    } finally { patchDB.close(); }
  } finally { countsDB.close(); }
}
