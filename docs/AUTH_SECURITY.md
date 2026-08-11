# GitHub OAuth Security Documentation

## Overview

The system uses GitHub OAuth 2.0 for user authentication without custom auth server.

## Authentication Flow

```
┌──────────┐         ┌─────────────┐         ┌──────────┐
│   User    │────────▶│  GitHub OAuth │────────▶│   User    │
│  Browser  │◀────────│   Provider   │◀────────│  Browser  │
└──────────┘         └─────────────┘         └──────────┘
     │                                              │
     │  1. Login                                     │
     │──────────────────────────────────────────▶ GitHub redirect │
     │  2. User approves                             │
     │  3. Code callback                           │
     │  4. Exchange code → token                    │
     │  5. Create session                         │
     │◀───────────────────────────────────────── │
```

## Scopes

### Minimum Required Scopes

```yaml
read:user        # User profile, email
public_repo      # Access user's public repositories
```

### Scopes NOT Used

```yaml
# DANGEROUS - not used:
repo           # Private repositories access
delete_repo     # Repository deletion
admin:org      # Organization admin
admin:public_key # SSH keys
```

## Token Storage

### Encrypted Token Vault

```typescript
interface EncryptedToken {
  ciphertext: string;  // AES-256-GCM encrypted token
  iv: string;        // Initialization vector
  version: number;    // Encryption version for rotation
}

interface TokenVault {
  encrypt(plaintext: string): EncryptedToken;
  decrypt(vault: EncryptedToken): string;
  rotate(): { old: EncryptedToken; new: EncryptedToken };
}
```

### Encryption Requirements

| Requirement | Implementation |
|-------------|---------------|
| Algorithm | AES-256-GCM |
| Key Derivation | PBKDF2 with salt |
| Key Storage | Environment variable |
| IV | Unique per encryption |
| Version | Stored for key rotation |

## Session Security

### Cookie Configuration

```yaml
Cookie Settings:
────────────────────────────────
Name:           axolotl_session
HttpOnly:       true        # No JavaScript access
Secure:         true        # HTTPS only
SameSite:       Strict     # CSRF protection
Expires:        30 days
Path:           /          # All paths
Domain:         Cookie scope
```

### Session Data

```yaml
Session contains:
────────────────────────────────
user_id:        GitHub user ID
login:          GitHub username
access_token:     Encrypted GitHub token
scopes:         Authorized scopes
created_at:      Session creation time
expires_at:      Session expiry
```

## CSRF Protection

### State Parameter Flow

```
1. Generate random state = UUID v4
2. Store state in session
3. Redirect to GitHub with state param
4. GitHub returns callback with state
5. Validate state === session.state
6. If mismatch → reject authentication
```

## Rate Limiting

### GitHub API Limits

| Token Type | Per Hour | Strategy |
|-----------|----------|----------|
| Unauthenticated | 60 | GitHub Pages fallback |
| OAuth Token | 5000 | Cache responses |
| GitHub App | 5000 | App token pooling |

### Mitigation Strategies

```yaml
Mitigation:
────────────────────────────────
1. Exponential backoff on 429 responses
2. Cache /user endpoint for 5 minutes
3. Batch requests where possible
4. Token refresh before expiry
```

## Security Headers

```yaml
Response Headers:
────────────────────────────────
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

## Threat Model

### Accepted Risks

```yaml
Risks accepted:
────────────────────────────────
GitHub OAuth outage        # Third-party dependency
GitHub security breach    # GitHub responsibility
User GitHub compromise   # User responsibility
```

### Mitigated Risks

| Threat | Mitigation |
|--------|------------|
| Token theft | AES-256-GCM encryption |
| CSRF attack | SameSite=Strict + state validation |
| Session hijacking | HttpOnly + Secure cookies |
| XSS token theft | HttpOnly prevents JS access |
| Replay attack | State nonce (single-use) |
| OAuth callback injection | State parameter validation |

### Out of Scope

```yaml
Not our responsibility:
────────────────────────────────
GitHub database security   # GitHub's responsibility
User machine security    # User's responsibility
Network-level MITM       # HTTPS enforcement
```

## Token Refresh Flow

```
Token expires ─────────────────────────▶ User redirected to login
                                            │
                                    Check refresh_token exists
                                            │
                               ┌─────────────┴─────────────┐
                               │ Refresh token available        No refresh token
                               │                              │
                               ▼                              ▼
                          Exchange refresh                   Redirect
                          for new token                 to login
                               │
                               ▼
                          Success ───────────────────▶ Update session
```

## Audit Logging

### Events to Log

```yaml
Authentication Events:
────────────────────────────────
LOGIN_SUCCESS    # Successful authentication
LOGIN_FAILED     # Failed attempt
TOKEN_REFRESH    # Token rotation
SESSION_EXPIRED  # Session timeout
LOGOUT            # User logged out
TOKEN_ROTATION   # Encryption key rotated

Security Events:
────────────────────────────────
CSRF_DETECTED    # Invalid state parameter
RATE_LIMITED     # GitHub API limit hit
TOKEN_STALE       # Token not refreshed in 30 days
```

### Log Format

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "event": "LOGIN_SUCCESS",
  "user_id": 12345678,
  "ip_hash": "sha256(user_ip + salt)",
  "user_agent": "Browser info"
}
```

## Dependencies

### Security-Critical Dependencies

```yaml
Dependencies with security implications:
────────────────────────────────
crypto              # Token encryption
express-session    # Session management
helmet             # Security headers
express-rate-limit # API rate limiting
```

### Dependency Updates

```bash
# Security updates priority
npm audit fix --force
npm update --priority security
```

## Incident Response

### If Token Compromise Suspected

```bash
1. Invalidate all sessions user token
2. Force re-authentication
3. Log incident
4. Notify user via email
5. Rotate encryption keys
```

### If Encryption Key Leaked

```bash
1. Rotate key immediately
2. Re-encrypt all tokens
3. Force all users to re-authenticate
4. Update environment variable
5. Log incident
```

## Compliance

### Data Minimization

```yaml
Stored data (minimized):
────────────────────────────────
GitHub user ID           # For identification
GitHub login             # Display purposes
Encrypted token          # Encoded

NOT stored:
────────────────────────────────
User password            # GitHub handles
User email              # Not needed
Private repos            # Scopes limited to public
Organization secrets     # No access
```

### User Rights

```yaml
Right to access        # Show stored data
Right to erasure        # Delete token + session
Right to portability    # Export session data
```

## Pre-deployment Checklist

```yaml
Pre-deployment:
────────────────────────────────
☐ Encryption key in environment variable
☐ HTTPS enforced everywhere
☐ Security headers configured
☐ Rate limiting implemented
☐ CSRF protection working
☐ Session timeout configured
☐ Audit logging active
☐ Token rotation mechanism ready
☐ Dependencies audited (npm audit)
☐ Security headers tested
☐ CSRF tokens tested
☐ Encryption tested with known vectors
```

## References

- [GitHub OAuth Docs](https://docs.github.com/apps/oauth-apps)
- [OWASP Session Management](https://cheatsheets.owasp.org)
- [CSP Implementation](https://content-security-policy.com)
- [AES-GCM Spec](https://csrc.nist.gov/publications)
