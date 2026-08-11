# 🎯 Axolotl Plugin Repository - Proof of Concept

## Quick Start

### For Plugin Developers

1. **Copy workflow templates** to your plugin repository:
   ```bash
   # Copy dev build workflow
   curl -O https://raw.githubusercontent.com/axolotl-pm/registry/main/.github/workflows/axolotl-dev-build.yml

   # Copy release build workflow
   curl -O https://raw.githubusercontent.com/axolotl-pm/registry/main/.github/workflows/axolotl-release-build.yml
   ```

2. **Push to GitHub** - Dev builds auto-trigger on push to main/dev branches

3. **Create a release** - Push a tag to trigger release build:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **Submit for review** - Open an Issue on the plugin-registry repo

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GITHUB ECOSYSTEM                             │
│                                                                       │
│  Developer Repo                Plugin Registry          GitHub Pages    │
│  ┌─────────────┐              ┌─────────────┐        ┌───────────┐  │
│  │ Your Plugin │              │ axolotl-pm/│        │  Static   │  │
│  │ Repository  │              │ registry    │        │  Website  │  │
│  └──────┬──────┘              └──────┬──────┘        └─────┬─────┘  │
│         │                            │                      │         │
│         │ GitHub Actions            │                      │         │
│         │ on push/tag               │                      │         │
│         ▼                           ▼                      ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     GitHub Actions                               │ │
│  │                                                                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │ │
│  │  │ Dev Build   │  │ Release      │  │ Registry Update     │   │ │
│  │  │ (auto)      │  │ Build (tag)  │  │ (on approval)       │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │ │
│  │                                                                  │ │
│  │  Builds PHAR → Creates GitHub Release → Updates Registry YAML    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                    │                                 │
│                                    │ Webhook                         │
│                                    ▼                                 │
│                         ┌─────────────────┐                         │
│                         │ GitHub App      │                         │
│                         │ (Cloudflare    │                         │
│                         │  Workers)      │                         │
│                         └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Dev Build Workflow (`.github/workflows/axolotl-dev-build.yml`)

**Trigger:** Push to main/dev branch

**What it does:**
- Checkout code
- Install dependencies
- Build PHAR with Pharynx
- Calculate SHA-256
- Create draft release with "dev/" tag

**Result:** Dev releases at `https://github.com/developer/plugin/releases`

---

### 2. Release Build Workflow (`.github/workflows/axolotl-release-build.yml`)

**Trigger:** Push tag `v*.*.*`

**What it does:**
- Validate plugin.yml
- Build PHAR
- Generate checksums.txt
- Generate metadata.json
- Create GitHub Release
- Notify registry

**Result:** Public releases at `https://github.com/developer/plugin/releases`

---

### 3. Submission (GitHub Issue)

**Trigger:** Open Issue on plugin-registry repo

**Format:**
```markdown
## Submission

**Plugin:** MyPlugin
**Repository:** developer/my-plugin
**Branch:** main
**Version:** 1.0.0
```

**Result:** Review queue entry

---

### 4. GitHub App Webhook Handler

**Trigger:** GitHub events (issues, releases, PRs)

**What it does:**
- Validates webhook signatures
- Parses submission issues
- Comments on issues
- Triggers review workflows

**Deployment:** Cloudflare Workers (FREE)

---

## Repository Structure

```
axolotl-pm/
├── registry/                    # Plugin Registry Repository
│   ├── plugins/
│   │   └── {plugin-id}/
│   │       ├── metadata.yaml
│   │       └── versions/
│   │           └── {version}.yaml
│   └── submissions/
│       └── {submission-id}.yaml
│
├── workflows/                   # Workflow Templates
│   ├── axolotl-dev-build.yml
│   └── axolotl-release-build.yml
│
├── webhook-handler/            # GitHub App Backend
│   └── index.ts
│
└── website/                    # GitHub Pages
    └── index.html
```

---

## Setup Instructions

### 1. Fork this repository

### 2. Create GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Create new GitHub App
3. Set Webhook URL to your Cloudflare Workers URL
4. Set permissions:
   - Repository: Read/Write
   - Issues: Read/Write
   - Pull requests: Read/Write
5. Install on your organizations

### 3. Deploy Webhook Handler

```bash
# Using Cloudflare Workers
npm create cloudflare-worker@latest webhook-handler
cd webhook-handler
# Copy webhook-handler.ts content
wrangler deploy
```

### 4. Configure Repository Secrets

In your GitHub App settings:
```
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=<paste private key>
WEBHOOK_SECRET=your-webhook-secret
```

### 5. Test the workflow

```bash
# Clone your plugin repo
git clone https://github.com/developer/your-plugin
cd your-plugin

# Copy workflows
curl -O https://raw.githubusercontent.com/axolotl-pm/registry/main/.github/workflows/axolotl-dev-build.yml
curl -O https://raw.githubusercontent.com/axolotl-pm/registry/main/.github/workflows/axolotl-release-build.yml

# Push
git add .
git commit -m "Add Axolotl build workflows"
git push
```

---

## Workflow Demo

### Dev Build (on push)

```
Developer pushes code
        │
        ▼
GitHub Actions starts
        │
        ├── Checkout code
        ├── Install PHP
        ├── Install Composer deps
        ├── Download Pharynx
        ├── Build PHAR
        ├── Calculate checksums
        │
        ▼
Create draft release
        │
        ├── Tag: dev/abc1234
        ├── Assets: *.phar, checksums.txt
        └── Prerelease: true
```

### Release Build (on tag)

```
Developer pushes tag
        │
        ▼
GitHub Actions starts
        │
        ├── Validate plugin.yml
        ├── Build PHAR
        ├── Generate checksums.txt
        ├── Generate metadata.json
        │
        ▼
Create public release
        │
        ├── Tag: v1.0.0
        ├── Assets: *.phar, checksums.txt, metadata.json
        ├── Prerelease: false
        └── Release notes auto-generated
```

---

## Cost

| Feature | Service | Cost |
|---------|---------|------|
| CI/CD | GitHub Actions (public repos) | FREE |
| Static Site | GitHub Pages | FREE |
| Webhook Handler | Cloudflare Workers | FREE |
| Storage | GitHub Releases | FREE |
| Database | Git Repository | FREE |

**Total: $0/month** 💰

---

## Next Steps

1. ✅ This POC demonstrates the workflow
2. 🔄 Need: Fix existing TypeScript errors
3. 🔄 Need: GitHub App integration
4. 🔄 Need: Registry update automation
5. 🔄 Need: Frontend website

---

## License

MIT
