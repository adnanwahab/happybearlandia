# Server logs

`GET /api/server-logs` is a public, read-only view of the server's recent logs, so people
and agents (such as the daily improvement run) can see what fails or runs slowly in
production without access to Fly.

## What is recorded

- Page views, API calls and WebSocket upgrades: method, normalized path, status and duration.
- Every failed (4xx/5xx) or slow (1.5 s or more) request, including static assets.
- Exceptions thrown by route handlers: name, message and the top six stack frames.
- `console.error` and `console.warn` output. Output still prints to stdout and stderr as before.
- A `server started` entry with the build ID each time the process starts, which covers deploys and cold starts.

Not recorded: successful static-asset requests, successful health checks, requests to
`/api/server-logs`, and Fly's own platform logs.

## Privacy

Everything is redacted before it is written, so the files and the endpoint hold the same data.

- Never stored: IP addresses, query strings, fragments, headers, cookies, user agents or request bodies.
- Paths keep their route shape, but record IDs, share codes, room codes, house and date names become `:id`.
- Messages and stack frames lose emails, bearer tokens, `key=value` secrets, URL query strings,
  IPv4 and IPv6 addresses, coordinates, UUIDs, long hex or mixed tokens and long numbers.
  Messages are capped at 500 characters.

The endpoint is public on purpose. If a log line ever carries personal data, fix the
redaction or the code that logged it. Set `HBL_SERVER_LOGS=off` to stop recording and
return 404 from the endpoint.

## Query parameters

| Parameter | Default | Meaning |
| --- | --- | --- |
| `since` | `24h` | A duration (`30m`, `6h`, `2d`) or an ISO timestamp, within the retention window |
| `until` | now | ISO timestamp |
| `level` | `info` | Minimum level: `info`, `warn` or `error` |
| `type` | all | `request`, `exception`, `console`, `lifecycle` or `notice` |
| `path` | all | Path prefix, for example `/api/area` |
| `limit` | `200` | Entries returned, 0 to 1000. The summary always covers the whole matching window. |

For example, `/api/server-logs?since=24h&level=warn` returns the last day's problems. The
response has a `summary` (status classes, busiest paths, top 404s, 5xx routes, slowest
routes by p95, repeated errors, process starts and builds) and `entries`, newest first.
Responses are cached for 10 seconds.

## Storage

JSON lines, one file per UTC day (`server-YYYY-MM-DD.jsonl`), in `HBL_SERVER_LOG_DIR`. In
production this is `/data/server-logs` on the Fly volume, so history survives machine stops
and deploys. Locally it defaults to `.hbl-private/server-logs`. The directory must be
outside the public static roots. Files older than `HBL_SERVER_LOG_RETENTION_DAYS` (default
14) are deleted, and each day stops at 20 MB with a single `notice` entry.
