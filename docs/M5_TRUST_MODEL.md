# M5 trusted source materialization

M5 plans are previews and retry descriptors, never authorization credentials.
`executePlan()` resolves the candidate again from trusted M4 records before its
first mutation. The resolver reads the canonical M4 candidate and every
append-only decision, rejects malformed or identity-mismatched history, checks
the configured numeric reviewer allowlist, derives the M4 effective state, and
accepts only an effective latest `APPROVED` decision.

The production execution source is first resolved and then downloaded from the
configured GitHub API with the approved SHA (never a branch). Plan paths, source SHA, M4 candidate ID, M4 decision ID,
storage repository, branch, identity, action sequence, and digests must all
equal values regenerated from that trusted state. A modified plan therefore
cannot redirect a write, change the source, or turn a non-approved candidate
into an approved one. An unkeyed plan hash is intentionally not used.

## Exact-SHA and source-integrity semantics

The invariant is:

```
M4 approved SHA == acquired SHA == materialized source SHA == provenance upstream SHA
```

`archiveSha256` is SHA-256 of the raw exact archive bytes. `treeSha256` is
SHA-256 of a canonical byte stream after the single archive root directory (if
present) is removed. Files are sorted by normalized POSIX path (UTF-8 byte
order), and each contributes:

```
UTF-8(path) || NUL || ASCII(decimal byte length) || NUL || raw file bytes || NUL
```

Unsafe, empty, duplicate-normalized, absolute, or traversal paths fail closed.
The raw archive digest identifies transport bytes; the tree digest identifies
the materialized content independently of archive ordering and metadata.

## Preservation, provenance, and recovery

`materializationId = SHA-256("m5-materialization-v2\\0" + M4 candidate
identity)`. It is deterministic for a reviewed candidate. Sources are committed
under `materialized/<materializationId>/source/`; distinct approved SHAs have
distinct immutable paths. M5 never overwrites that path.

After the source commit, M5 commits the canonical provenance JSON in the
Axolotl-controlled storage repository at
`.axolotl/materializations/<materializationId>.json`. That record—not a local
runner file—is the canonical provenance source and therefore survives runner
destruction. Local provenance helpers are an optional non-authoritative cache.

`ALREADY_MATERIALIZED` requires both a matching canonical record and the full
matching immutable source tree at its expected path. A malformed or inconsistent
canonical record, missing source, an existing source path with different bytes,
an archived/wrong-owner storage repository, or any M4 mismatch fails closed.
If a runner dies after the source commit but before provenance, retry verifies
the source bytes and writes only the canonical record. Recovery never writes
inside the immutable source path, so repeated provenance failures remain
retriable without changing `treeSha256`.

## Resource and concurrency bounds

M5 applies the M3 bounds before archive extraction: 100 MiB compressed archive,
200 MiB extracted bytes, 10,000 files, 10 MiB per file, and depth 20. It also
caps normalized entry paths at 4,096 characters, rejects absolute/traversal/NUL
paths and symbolic links, and validates ZIP header sizes before loading file
contents. The download transport must eventually stream/enforce the compressed
limit before buffering; the current read-only client contract returns a buffer.

Every storage commit is conditional on the branch head read during the trusted
sequence. The GitHub client contract supplies `expectedParent`; a stale head is
a `CONCURRENCY_CONFLICT`, after which callers re-read and reconcile. The future
RealGitHubClient transport must implement this atomically; it remains a stub.

Write authority is a service-issued trusted execution context, supplied
separately from a plan. A plan's `dryRun` flag can only suppress mutation; it
can never grant write capability.

Storage owner and target branch come only from deployment configuration. The
archive-directory source provider is test-only; it is not a production
exact-SHA boundary. There
is no production storage-owner default in M5, and the CLI intentionally has no
live-write mode until a separately reviewed GitHub write implementation exists.
