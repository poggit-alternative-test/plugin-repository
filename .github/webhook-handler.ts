/**
 * =============================================================================
 * GITHUB APP WEBHOOK HANDLER - POC
 * =============================================================================
 *
 * This is a simple webhook handler that can run on:
 * - Cloudflare Workers (FREE: 100k requests/day)
 * - Vercel Edge Functions (FREE: 100k requests/day)
 * - Railway (FREE: $5/month credit)
 *
 * For POC purposes, this handles:
 * - issue.created (new submission)
 * - pull_request (review events)
 * - release.published
 *
 * =============================================================================
 */

export interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;

  // Storage
  REGISTRY_REPO: string;

  // Optional: Database for sessions
  SESSION_KV: KVNamespace;
}

export interface GitHubWebhookEvent {
  action: string;
  repository: {
    owner: { login: string };
    name: string;
    full_name: string;
    html_url: string;
  };
  issue?: {
    number: number;
    title: string;
    body: string;
    user: { login: string };
  };
  release?: {
    tag_name: string;
    name: string;
    html_url: string;
    draft: boolean;
    prerelease: boolean;
  };
}

// =============================================================================
// WEBHOOK VERIFICATION
// =============================================================================

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `sha256=${expectedSignature}` === signature;
}

// =============================================================================
// GITHUB API HELPERS
// =============================================================================

async function getInstallationToken(installationId: number, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Create JWT
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iat: now,
    exp: now + 600,
    iss: env.GITHUB_APP_ID,
  }));

  const jwt = `${header}.${payload}`;

  // Sign JWT (simplified - in production use node:crypto)
  const privateKey = env.GITHUB_APP_PRIVATE_KEY
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  // Exchange JWT for installation token
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get installation token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.token;
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

async function handleSubmission(
  event: GitHubWebhookEvent,
  env: Env
): Promise<Response> {
  const { issue, repository } = event;

  if (!issue) {
    return new Response('No issue data', { status: 400 });
  }

  // Parse submission from issue body
  const body = issue.body || '';

  const repoMatch = body.match(/\*\*GitHub Repository\*\*[:\s]*([^\n]+)/i) ||
                    body.match(/repository[:\s]*([^\n]+)/i);
  const branchMatch = body.match(/\*\*Branch\*\*[:\s]*([^\n]+)/i) ||
                      body.match(/branch[:\s]*([^\n]+)/i);
  const versionMatch = body.match(/version[:\s]*([^\n]+)/i);

  if (!repoMatch) {
    // Comment that submission format is invalid
    return new Response(JSON.stringify({
      action: 'add_comment',
      body: `❌ Submission format invalid. Please use the plugin submission template.

Need help? See the [submission guide](https://github.com/axolotl-pm/docs/blob/main/SUBMISSION.md).`,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const submissionData = {
    schema_version: 1,
    upstream: {
      repository: repoMatch[1].trim(),
      branch: branchMatch?.[1]?.trim() || 'main',
    },
    submitted_at: new Date().toISOString(),
    submitted_by: issue.user.login,
    issue_number: issue.number,
  };

  // Store submission (in real implementation, this would create a PR or commit to registry)
  console.log('New submission received:', JSON.stringify(submissionData, null, 2));

  return new Response(JSON.stringify({
    action: 'add_comment',
    body: `✅ **Submission Received!**

Plugin: ${issue.title}
Repository: ${submissionData.upstream.repository}
Branch: ${submissionData.upstream.branch}

📋 **Next Steps:**
1. Automated checks will run shortly
2. Our review team will evaluate your plugin
3. You'll be notified of the decision

Estimated review time: 1-7 days`,
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleRelease(
  event: GitHubWebhookEvent,
  env: Env
): Promise<Response> {
  const { release, repository } = event;

  if (!release) {
    return new Response('No release data', { status: 400 });
  }

  // Skip draft releases
  if (release.draft) {
    return new Response(JSON.stringify({
      action: 'log',
      message: 'Skipped draft release',
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log('New release published:', {
    tag: release.tag_name,
    name: release.name,
    url: release.html_url,
    prerelease: release.prerelease,
    repository: repository.full_name,
  });

  // In production, this would:
  // 1. Fetch release assets (PHAR, checksums.txt)
  // 2. Update registry repository
  // 3. Trigger website rebuild

  return new Response(JSON.stringify({
    action: 'process_release',
    data: {
      tag: release.tag_name,
      url: release.html_url,
      repository: repository.full_name,
      is_prerelease: release.prerelease,
    },
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handlePullRequest(
  event: GitHubWebhookEvent,
  env: Env
): Promise<Response> {
  const action = event.action;
  const repository = event.repository;

  console.log(`PR event: ${action} on ${repository.full_name}`);

  // Handle different PR actions
  switch (action) {
    case 'opened':
      return new Response(JSON.stringify({
        action: 'review',
        body: `👋 Thanks for your submission!

Automated checks will run shortly.
Our reviewers will take a look as soon as possible.`,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    case 'closed':
      return new Response(JSON.stringify({
        action: 'log',
        message: 'PR closed',
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    default:
      return new Response(JSON.stringify({
        action: 'noop',
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const payload = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || '';
    const event = request.headers.get('x-github-event') || '';

    // Verify webhook signature
    if (env.GITHUB_WEBHOOK_SECRET) {
      const isValid = await verifyWebhookSignature(payload, signature, env.GITHUB_WEBHOOK_SECRET);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    // Parse event
    let eventData: GitHubWebhookEvent;
    try {
      eventData = JSON.parse(payload);
    } catch {
      return new Response('Invalid JSON payload', { status: 400 });
    }

    console.log(`Processing ${event} event from ${eventData.repository?.full_name}`);

    // Route to appropriate handler
    let response: Response;
    switch (event) {
      case 'issues':
        response = await handleSubmission(eventData, env);
        break;
      case 'release':
        response = await handleRelease(eventData, env);
        break;
      case 'pull_request':
        response = await handlePullRequest(eventData, env);
        break;
      default:
        console.log(`Unhandled event: ${event}`);
        response = new Response(JSON.stringify({ action: 'noop' }), {
          headers: { 'Content-Type': 'application/json' }
        });
    }

    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256',
    };

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  },
};
