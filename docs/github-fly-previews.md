# Isolated Fly preview provider — activation pending

Implemented controller code: `FlyProvider`, `FileFlyBuilder`, trusted
`fly-entry.sh`/`fly-launch.js`/`fly-proxy.js`, and `FlyBase.Dockerfile`.
No Fly infrastructure was created or deployed during implementation.

The provider uses real Apps/Machines/GraphQL APIs. Each job has one deterministic
app name, durable ownership/image journal and exact SHA. Ambiguous Machine-create
responses reconcile that same resource before another request; an unresolved
creation stays held. Unknown apps/Machines, wrong organization/image/init/env,
volumes, duplicate Machines or a nonempty/unreadable secret inventory fail closed.
Stop/delete targets only the verified owned resources, including cleanup after
activation expiry. The runner globally bounds preparation and active Machines.

The actual builder downloads only the requested commit and locked integrity-checked
packages through the same bounded data transport as local previews. It generates
its own Dockerfile, adds the validated bundle as data, and builds with networknone.
It never runs a selected Dockerfile/package script on the host. The configured base
must be the reviewed digest of `FlyBase.Dockerfile` with Bun,iptables/ip6tables and
setpriv. Its root entrypoint denies outbound IPv4 and IPv6 except loopback and
established inbound replies before selected code starts. A trusted different-UID
proxy binds first, strips cookies/auth/replay headers and applies browser CSP; the
selected backend runs UID1000 on3001 with no capabilities or privilege escalation.
The supervisor stops when either process exits. No production volumes or secrets
are copied. Dedicated organization plus segmented network is required in addition
to the enforced guest firewall, not as a substitute for it.

A trusted external controller (separate always-on host/VM, persistent state) owns
Docker build/push and Fly credentials. Never install the runner in the production
Machine. Main Fly application only proxies authenticated requests to its reviewed
HTTPS endpoint. Controller secrets are not build arguments or guest environment.
Local image tags/source caches are removed only by verified owned cleanup; registry
retention still requires operator management and is part of activation review.

## Operator activation checklist and commands

These are instructions for a later explicit infrastructure/budget approval, not
commands run during this repair. Do not substitute the production organization.

1. Create/review a dedicated preview organization and a distinct preview network.
   Approve the budget: at most2Machines of1sharedCPU/2GiBRAM,1build at a time,
  15minute startup,20minute idle and1hour lifetime, bounded pending queue8.
   Registry retention must be set and monitored; no claim of zero storage cost.
2. On the isolated trusted build controller, build/review the infrastructure base:

   ```sh
   docker build -f ops/previews/FlyBase.Dockerfile -t hbl-preview-base .
   ```

   Create a dedicated `hbl-preview-builder-<slug>` registry app in the preview
   organization (Apps API POST `/v1/apps` accepts app_name,org_slug,network),
   authenticate the controller's Docker registry using host `fly auth docker`,
   tag/push the trusted base there, inspect its RepoDigest and configure that full
   digest. No production credentials or source scripts belong in this build.
3. Review a mode0600 `fly-config.json` in the runner's mode0700 state directory:

   ```json
   {
     "activated": false,
     "organization": "DEDICATED_PREVIEW_ORG",
     "productionOrganization": "ACTUAL_PRODUCTION_ORG",
     "network": "hbl-preview-isolated",
     "region": "dfw",
     "maxMachines": 2,
     "token": "HOST_ONLY_SCOPED_FLY_CAPABILITY",
     "isolationReview": {
       "reviewedBy": "ACTUAL_OPERATOR_AND_EVIDENCE",
       "expiresAt": 0,
       "recipe": "hbl-secretless-bun-v1"
     },
     "builder": {
       "baseImage": "registry.fly.io/hbl-preview-builder-SLUG@sha256:ACTUAL_REVIEWED_DIGEST",
       "registryApp": "hbl-preview-builder-SLUG"
     }
   }
   ```

   Placeholders deliberately fail validation. expiresAt is epoch milliseconds.
   Keep activated false until review/approval; do not infer it from PR labels.
4. Verify firewall behavior in a disposable VM: outgoing public/production/control
   TCP,UDP,DNS and private-network connections fail, inbound HTTP/WS replies work,
   guest UID/capabilities/mounts/environment are correct, no secrets exist, guest
   cannot terminate/replace ingress. Verify trusted proxy CSP blocks browser-side
   production/control calls and cookies do not cross preview/primary origins.
5. After explicit activation, set HBL_PREVIEW_PROVIDER=fly and start the separate
   controller through `python3 ops/previews/run-host.py`. API provisioning allocates
   an app IPv6 address for HTTPS routing if none exists. TLS readiness must actually
   succeed; app creation alone is never ready. Provide the primary web process its
   controller HTTPS URL/token and configure HBL_PUBLIC_ORIGIN to its actual HTTPS
   origin, retaining same-origin checks behind Fly's TLS termination.
6. Click one approved open PR. Record exactSHA,source/build digest,Machine/app IDs,
   empty secrets and network evidence, readiness buildId and browser-rendered
   application/worker/API/WebSocket journey. Verify securecontext and actual
   WebGPU/fallback behavior; HTTP readiness alone proves no graphical capability.
   Stop via authenticated owned-job operation, then verify app/Machine/localcache
   cleanup and registry retention. Do not deploy the primary app automatically.

## Actual verification

Five Fly contract tests exercise inactive/invalid requests, trusted build input,
ambiguous successful create with one Machine after restart, exact image/init/env,
secret/volume rejection and owned deletion. These use fake provider responses.
The guest firewall/supervisor/proxy, actual Fly schema compatibility, image build,
public IPv6/TLS routing, denied network reachability, cleanup billing and browser
rendering are **not live verified**. Do not treat this adapter as an activated,
production-ready or completed Fly preview milestone until that evidence exists.

References: [Fly Apps API](https://docs.fly.io/machines/api/apps-resource),
[Fly Machines API](https://docs.fly.io/machines/api/machines-resource),
[Docker execution isolation](https://docs.docker.com/engine/containers/run/).
