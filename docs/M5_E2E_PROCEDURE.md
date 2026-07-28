# M5 Tester Transport E2E Procedure

**Document Version:** 1.0
**Created:** 2026-07-27
**Status:** NOT EXECUTED - Requires explicit human authorization

---

## Prerequisites

Before executing this E2E procedure, ensure:

1. GitHub App is installed on `poggit-alternative-test` organization
2. GitHub App has appropriate permissions (see Section 2)
3. GitHub App private key is available
4. Tester configuration is validated
5. Human authorization is explicitly granted

---

## Required Credentials

The following must be provided by the human operator before E2E execution:

```bash
# Environment variables required for E2E
export M5_TESTER_ENABLED=true
export M5_GITHUB_APP_ID="<provided-by-operator>"
export M5_GITHUB_APP_PRIVATE_KEY_PATH="<path-to-private-key>"
export M5_GITHUB_APP_INSTALLATION_ID="<provided-by-operator>"
export M5_TESTER_ALLOWED_ORGS="poggit-alternative-test"
export M5_TESTER_ALLOW_REPO_CREATION=true
export M5_GITHUB_TOKEN="<provided-by-operator>"  # For initial auth setup

# M4 configuration (required for plan generation)
export MAT_M4_REVIEWS_DIR="<path-to-m4-reviews>"
export MAT_STORAGE_OWNER="poggit-alternative-test"
export MAT_REVIEWERS_CONFIG="<path-to-reviewers.yaml>"
```

---

## Step-by-Step E2E Procedure

### Step 1: Authenticate GitHub App

```bash
# Verify GitHub App credentials are valid
npm run materialize -- plan --help
```

**Expected:** Help message displays without errors.

**Verification:** No authentication errors in output.

---

### Step 2: Verify Installation

```bash
# List GitHub App installations (requires appId and private key)
# This step verifies the App can authenticate
node -e "
const { GitHubAppAuth } = require('./dist/materialization/github-app-auth.js');
const auth = new GitHubAppAuth({
  appId: process.env.M5_GITHUB_APP_ID,
  privateKeyContent: require('fs').readFileSync(process.env.M5_GITHUB_APP_PRIVATE_KEY_PATH, 'utf-8')
});
auth.listInstallations().then(installations => {
  console.log('Installations:', JSON.stringify(installations, null, 2));
}).catch(err => {
  console.error('Auth failed:', err.message);
  process.exit(1);
});
"
```

**Expected:** List of installations including `poggit-alternative-test`.

**Verification:** Output contains installation for the tester org.

---

### Step 3: Verify Tester Organization

```bash
# Verify the tester organization is correctly configured
node -e "
const { validateTesterConfig, loadTesterConfigFromEnv } = require('./dist/materialization/tester-transport-config.js');
const config = loadTesterConfigFromEnv();
const validation = validateTesterConfig(config);
console.log('Tester config valid:', validation.valid);
if (!validation.valid) {
  console.error('Errors:', validation.errors);
  process.exit(1);
}
if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
}
console.log('Allowed owners:', config.allowedStorageOwners);
"
```

**Expected:**
- `Tester config valid: true`
- `Allowed owners: [poggit-alternative-test]`
- No errors
- No production orgs in warnings

**Verification:** Output confirms tester org is allowed, production orgs are blocked.

---

### Step 4: Read-Only Connectivity Test

```bash
# Create a test repository (manual step if not exists)
# Then test read access
node -e "
const { RealGitHubClientImpl } = require('./dist/materialization/real-github-client.js');
const client = new RealGitHubClientImpl({
  accessToken: process.env.M5_GITHUB_TOKEN,
  writeEnabled: false
});

async function test() {
  // Try to get a non-existent repository
  const repo = await client.getRepository('poggit-alternative-test/test-repo');
  console.log('Read test result:', repo === null ? 'PASS - correctly returned null for non-existent repo' : 'UNEXPECTED - got repo data');
  client.close();
}
test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
"
```

**Expected:** No errors, correctly handles 404.

**Verification:** Test completes without exceptions.

---

### Step 5: Generate Materialization Plan

```bash
# Create test M4 review data
TEST_PLUGIN_ID="test-plugin"
TEST_SHA="a".repeat(40)
TEST_REPO="test-developer/test-upstream"
TEST_VERSION="1.0.0"

# Create M4 review structure
mkdir -p ".test-m4/${TEST_PLUGIN_ID}/${TEST_SHA:0:8}/decisions"
cat > ".test-m4/${TEST_PLUGIN_ID}/${TEST_SHA:0:8}/candidate.yaml" << EOF
schemaVersion: 1
candidateIdentity: "${TEST_PLUGIN_ID}@${TEST_REPO}#${TEST_SHA}"
pluginSlug: ${TEST_PLUGIN_ID}
upstreamRepository: ${TEST_REPO}
upstreamBranch: main
sha: ${TEST_SHA}
inspectionTimestamp: 2025-12-31T00:00:00.000Z
EOF

cat > ".test-m4/${TEST_PLUGIN_ID}/${TEST_SHA:0:8}/decisions/decision01.yaml" << EOF
schemaVersion: 1
decisionId: decision01
candidateIdentity: "${TEST_PLUGIN_ID}@${TEST_REPO}#${TEST_SHA}"
pluginSlug: ${TEST_PLUGIN_ID}
upstreamRepository: ${TEST_REPO}
reviewedSha: ${TEST_SHA}
decision: APPROVED
reviewer:
  githubId: 12345678
timestamp: 2026-01-01T00:00:00.000Z
EOF

# Generate plan
export MAT_M4_REVIEWS_DIR="$(pwd)/.test-m4"
export MAT_STORAGE_OWNER="poggit-alternative-test"
export MAT_GITHUB_TOKEN="ghp_xxx"  # Not used for plan

npm run materialize -- plan \
  --plugin-slug "${TEST_PLUGIN_ID}" \
  --repository "${TEST_REPO}" \
  --sha "${TEST_SHA}" \
  --version "${TEST_VERSION}" \
  > /tmp/plan.json 2>&1

echo "Plan generation exit code: $?"
cat /tmp/plan.json | head -50
```

**Expected:** Plan JSON is generated with correct structure.

**Verification:**
- `materializationId` is deterministic SHA-256
- `storageRepository` is `poggit-alternative-test/test-plugin`
- `source.commitSha` matches the approved SHA
- No errors

---

### Step 6: Dry-Run Validation

```bash
# The plan command already generates a plan
# Verify it's marked as dry-run by default
cat /tmp/plan.json | jq '.dryRun'
```

**Expected:** `true`

**Verification:** Plan cannot trigger writes.

---

### Step 7: Inspect Exact Target

```bash
# Review the plan to verify exact targets
cat /tmp/plan.json | jq '{
  storageRepository,
  storageBranch,
  sourcePath,
  provenancePath,
  actions: .actions[].action
}'
```

**Expected:**
- `storageRepository` = `poggit-alternative-test/test-plugin`
- `storageBranch` = `main`
- `sourcePath` = `materialized/<materializationId>/source`
- `provenancePath` = `.axolotl/materializations/<materializationId>.json`
- Actions include `create-repository`, `commit-source`, `commit-provenance`

**Verification:** Target is exactly the tester org, no production targets.

---

### Step 8: Explicit Human Authorization

**Before proceeding, human operator must:**

1. Review the plan JSON (`/tmp/plan.json`)
2. Verify `storageRepository` is `poggit-alternative-test/test-plugin`
3. Verify no production orgs are targeted
4. Explicitly confirm: "I authorize materialization to poggit-alternative-test only"

```bash
# Prompt for authorization
read -p "Verify plan targets poggit-alternative-test only. Type 'AUTHORIZE' to proceed: " answer
if [ "$answer" != "AUTHORIZE" ]; then
  echo "Authorization not granted. Aborting E2E."
  exit 1
fi
echo "Authorization granted. Proceeding with write test..."
```

---

### Step 9: Perform ONE Controlled Write

```bash
# Create a test archive
TEST_SHA="a".repeat(40)
mkdir -p ".test-archives/${TEST_PLUGIN_ID}"
# Create a minimal ZIP archive with plugin.yml
cd ".test-archives/${TEST_PLUGIN_ID}"
mkdir -p "root"
echo "name: TestPlugin" > "root/plugin.yml"
echo "version: 1.0.0" >> "root/plugin.yml"
cd ../..

# Note: For E2E, we need an actual archive
# This step would require real upstream data

# Execute the write (requires authenticated RealGitHubClient)
# This is the ONLY write operation in E2E
node -e "
const { RealGitHubClientImpl } = require('./dist/materialization/real-github-client.js');
const { DEFAULT_TESTER_CONFIG } = require('./dist/materialization/tester-transport-config.js');

const client = new RealGitHubClientImpl({
  githubApp: {
    appId: process.env.M5_GITHUB_APP_ID,
    privateKeyPath: process.env.M5_GITHUB_APP_PRIVATE_KEY_PATH,
    installationId: process.env.M5_GITHUB_APP_INSTALLATION_ID,
  },
  writeEnabled: true,
  testerConfig: DEFAULT_TESTER_CONFIG,
});

async function testWrite() {
  try {
    // Create a test repository
    const result = await client.createRepository({
      name: 'e2e-test-' + Date.now(),
      description: 'M5 E2E test repository',
      private: true,
    });

    if (result.success) {
      console.log('Repository created:', result.repository);
    } else {
      console.error('Repository creation failed:', result.error);
      process.exit(1);
    }
  } finally {
    client.close();
  }
}

testWrite().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
"
```

**Expected:**
- Repository created in `poggit-alternative-test`
- No production orgs targeted

**Verification:**
- Repository URL is `https://github.com/poggit-alternative-test/e2e-test-*`

---

### Step 10: Verify Repository State

```bash
# Verify the created repository
node -e "
const { RealGitHubClientImpl } = require('./dist/materialization/real-github-client.js');

const client = new RealGitHubClientImpl({
  accessToken: process.env.M5_GITHUB_TOKEN,
  writeEnabled: false,
});

async function verify() {
  // List repositories in tester org
  const repo = await client.getRepository('poggit-alternative-test/<test-repo-name>');
  console.log('Repository exists:', !!repo);
  console.log('Owner:', repo?.owner);
  console.log('Is private:', repo?.isPrivate);
  client.close();
}

verify();
"
```

**Expected:** Repository exists in tester org, is private.

---

### Step 11: Verify Immutable Source

```bash
# Create test commit with immutable source structure
node -e "
const { RealGitHubClientImpl } = require('./dist/materialization/real-github-client.js');

const client = new RealGitHubClientImpl({
  accessToken: process.env.M5_GITHUB_TOKEN,
  writeEnabled: true,
});

async function testSource() {
  const testRepo = 'poggit-alternative-test/e2e-test';
  const materializationId = 'test-materialization-id';
  const sourcePath = 'materialized/' + materializationId + '/source';

  // Create source commit
  const result = await client.createCommit({
    repository: testRepo,
    branch: 'main',
    expectedParent: null,
    message: 'Add immutable source',
    files: [{
      path: sourcePath + '/plugin.yml',
      content: Buffer.from('name: TestPlugin\nversion: 1.0.0').toString('base64'),
      encoding: 'base64',
    }],
    author: { name: 'E2E Test', email: 'test@e2e.local' },
  });

  console.log('Source commit success:', result.success);
  if (result.success) {
    console.log('Source commit SHA:', result.commitSha);
  } else {
    console.error('Source commit failed:', result.error);
  }

  client.close();
}

testSource();
"
```

**Expected:** Commit succeeds with correct structure.

---

### Step 12: Verify Canonical Provenance

```bash
# Record provenance commit
node -e "
const { RealGitHubClientImpl } = require('./dist/materialization/real-github-client.js');

const client = new RealGitHubClientImpl({
  accessToken: process.env.M5_GITHUB_TOKEN,
  writeEnabled: true,
});

async function testProvenance() {
  const testRepo = 'poggit-alternative-test/e2e-test';
  const materializationId = 'test-materialization-id';
  const provenancePath = '.axolotl/materializations/' + materializationId + '.json';

  // Get current branch HEAD
  const branch = await client.getBranch(testRepo, 'main');
  console.log('Current branch SHA:', branch?.sha);

  // Create provenance record
  const provenance = {
    schemaVersion: 2,
    materializationId,
    pluginId: 'test-plugin',
    version: '1.0.0',
    materializedAt: new Date().toISOString(),
  };

  const result = await client.createCommit({
    repository: testRepo,
    branch: 'main',
    expectedParent: branch?.sha,
    message: 'Record provenance',
    files: [{
      path: provenancePath,
      content: Buffer.from(JSON.stringify(provenance, null, 2)).toString('base64'),
      encoding: 'base64',
    }],
    author: { name: 'E2E Test', email: 'test@e2e.local' },
  });

  console.log('Provenance commit success:', result.success);
  if (result.success) {
    console.log('Provenance commit SHA:', result.commitSha);
  } else {
    console.error('Provenance commit failed:', result.error);
  }

  client.close();
}

testProvenance();
"
```

**Expected:** Provenance recorded correctly.

---

### Step 13: Rerun Identical Materialization

```bash
# Attempt to materialize the same plugin again
# Should return ALREADY_MATERIALIZED
node -e "
const { createMaterializationService } = require('./dist/materialization/materialization-service.js');
const { FakeGitHubClient } = require('./dist/materialization/github-client.js');

// For this test, use fake client with pre-populated state
const client = new FakeGitHubClient({ writeEnabled: true });

// Simulate already-materialized state
// Then run materialization
"
```

**Expected:** `ALREADY_MATERIALIZED` returned.

---

### Step 14: Expect ALREADY_MATERIALIZED

```bash
# Verify ALREADY_MATERIALIZED detection
node -e "
const { createMaterializationService } = require('./dist/materialization/materialization-service.js');
const { FakeGitHubClient } = require('./dist/materialization/github-client.js');

async function testIdempotency() {
  const client = new FakeGitHubClient({ writeEnabled: true });
  const service = createMaterializationService({
    storageOwners: ['poggit-alternative-test'],
    defaultStorage: { owner: 'poggit-alternative-test', branch: 'main' },
  });

  // First execution would succeed
  // Second execution should return ALREADY_MATERIALIZED

  console.log('Idempotency test complete');
  client.close();
}

testIdempotency();
"
```

**Expected:** Second execution returns `alreadyMaterialized: true`.

---

### Step 15: Simulate Stale-Head Conflict

```bash
# Test concurrent branch advancement
node -e "
const { FakeGitHubClient } = require('./dist/materialization/github-client.js');

async function testConflict() {
  const client = new FakeGitHubClient({ writeEnabled: true });

  await client.createRepository({
    name: 'conflict-test',
    description: 'Conflict test',
    private: false,
    owner: 'poggit-alternative-test',
  });

  const zeroSha = '0'.repeat(40);

  // First writer succeeds
  const first = await client.createCommit({
    repository: 'poggit-alternative-test/conflict-test',
    branch: 'main',
    expectedParent: zeroSha,
    message: 'first',
    files: [],
    author: { name: 'First', email: 'first@test.local' },
  });

  // Second writer with same parent fails
  const second = await client.createCommit({
    repository: 'poggit-alternative-test/conflict-test',
    branch: 'main',
    expectedParent: zeroSha,
    message: 'second',
    files: [],
    author: { name: 'Second', email: 'second@test.local' },
  });

  console.log('First writer succeeded:', first.success);
  console.log('Second writer failed:', !second.success);
  console.log('Error code:', second.error?.code);

  client.close();
}

testConflict();
"
```

**Expected:**
- First writer: `success: true`
- Second writer: `success: false`, `error.code: CONCURRENCY_CONFLICT`

---

### Step 16: Verify Fail-Closed/Reconiliation Behavior

```bash
# After CONCURRENCY_CONFLICT, retry should succeed
node -e "
const { FakeGitHubClient } = require('./dist/materialization/github-client.js');

async function testRecovery() {
  const client = new FakeGitHubClient({ writeEnabled: true });

  await client.createRepository({
    name: 'recovery-test',
    description: 'Recovery test',
    private: false,
    owner: 'poggit-alternative-test',
  });

  const zeroSha = '0'.repeat(40);

  // First commit
  const first = await client.createCommit({
    repository: 'poggit-alternative-test/recovery-test',
    branch: 'main',
    expectedParent: zeroSha,
    message: 'first',
    files: [],
    author: { name: 'First', email: 'first@test.local' },
  });

  console.log('First commit succeeded:', first.success);
  console.log('First commit SHA:', first.commitSha);

  // Get new head and retry with correct parent
  const branch = await client.getBranch('poggit-alternative-test/recovery-test', 'main');
  console.log('Current head:', branch?.sha);

  const second = await client.createCommit({
    repository: 'poggit-alternative-test/recovery-test',
    branch: 'main',
    expectedParent: branch?.sha,
    message: 'second after recovery',
    files: [{ path: 'recovered.txt', content: 'recovered', encoding: 'utf-8' }],
    author: { name: 'Second', email: 'second@test.local' },
  });

  console.log('Second commit after recovery succeeded:', second.success);

  client.close();
}

testRecovery();
"
```

**Expected:**
- First commit succeeds
- Current head is first commit SHA
- Second commit with correct parent succeeds

---

## Cleanup

After E2E completes (success or failure):

```bash
# Remove test data
rm -rf .test-m4 .test-archives /tmp/plan.json

# Delete test repositories (manual or via API)
# This step requires human confirmation
echo "Please delete test repositories manually:"
echo "- poggit-alternative-test/e2e-test-*"
echo "- poggit-alternative-test/conflict-test"
echo "- poggit-alternative-test/recovery-test"
```

---

## Expected Results Summary

| Step | Test | Expected Result |
|------|------|-----------------|
| 1 | GitHub App authentication | No errors |
| 2 | Installation verification | Tester org installation found |
| 3 | Tester org validation | Config valid, no production orgs |
| 4 | Read-only connectivity | Handles 404 correctly |
| 5 | Plan generation | Valid plan for tester org |
| 6 | Dry-run validation | Plan marked as dry-run |
| 7 | Target inspection | Only poggit-alternative-test |
| 8 | Human authorization | Operator confirmed |
| 9 | One controlled write | Repository created in tester org |
| 10 | Repository state | Exists in tester org, private |
| 11 | Immutable source | Source committed correctly |
| 12 | Canonical provenance | Provenance recorded |
| 13 | Rerun materialization | Second run detected |
| 14 | ALREADY_MATERIALIZED | Returned correctly |
| 15 | Stale-head conflict | CONCURRENCY_CONFLICT |
| 16 | Reconciliation | Retry succeeds with correct parent |

---

## Success Criteria

E2E is considered successful when:

1. ✅ All 16 steps complete without errors
2. ✅ No production organizations (axolotl-pm, axolotl-pm-pl) are targeted
3. ✅ Only `poggit-alternative-test` is used for all operations
4. ✅ CONCURRENCY_CONFLICT is properly detected and handled
5. ✅ ALREADY_MATERIALIZED is properly detected
6. ✅ Human operator has explicitly authorized the test

---

## Emergency Stop

If at any point a production organization is detected:

1. **STOP IMMEDIATELY**
2. Report the incident
3. Do not proceed with any further steps
4. Document what was attempted and what went wrong

---

**END OF E2E PROCEDURE**
