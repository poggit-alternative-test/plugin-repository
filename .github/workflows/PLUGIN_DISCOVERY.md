# Plugin Discovery Workflow

Automated GitHub Actions workflow to discover PocketMine-MP plugins.

## Overview

This workflow automatically discovers plugins by searching GitHub for repositories that use the `pmmp-plugin-actions` workflow. It then collects plugin metadata and verification status.

## How It Works

```
1. GitHub Actions runs every 6 hours (scheduled)
2. Search GitHub API for repos with pmmp-plugin-actions workflow
3. For each repository:
   - Get plugin.yml for plugin metadata
   - Get latest release information
   - Check verification status
4. Save results to JSON
5. Deploy to GitHub Pages
```

## Verification Status

| Status | Meaning |
|--------|---------|
| **Verified** | Plugin is built using `pmmp-plugin-actions` workflow |
| **Unverified** | Plugin has releases but not built with official workflow |

## Generated Data

The workflow generates `plugins.json` with the following structure:

```json
[
  {
    "repo": "owner/repo",
    "repo_url": "https://github.com/owner/repo",
    "plugin": {
      "name": "PluginName",
      "version": "1.0.0",
      "api": "5.0.0",
      "author": "author"
    },
    "stats": {
      "stars": 42,
      "forks": 12
    },
    "release": {
      "tag": "v1.0.0",
      "url": "https://github.com/owner/repo/releases/tag/v1.0.0",
      "assets": [...]
    },
    "verification": {
      "is_verified": true,
      "workflow_info": "Built by Publish Release"
    }
  }
]
```

## For Plugin Developers

### How to Get Listed

1. Add `pmmp-plugin-actions` workflow to your repository
2. Publish a release
3. Your plugin will be automatically discovered!

### Requirements

- Public GitHub repository
- Valid `plugin.yml` in root
- `pmmp-plugin-actions` workflow in `.github/workflows/`
- Published release with PHAR asset

## For Website Users

### Verification Badge

- **✓ Verified** - Plugin built with official `pmmp-plugin-actions` workflow
- **⚠ Unverified** - Plugin has releases but not built with official workflow

### Download

Click the download button on verified plugins to download the PHAR directly from GitHub releases.

### Star

Click "⭐ Star" to go to GitHub and star the repository.

## Manual Trigger

To manually trigger the discovery:

1. Go to the Actions tab
2. Select "Discover Plugins"
3. Click "Run workflow"

## Architecture

```
.github/workflows/
└── discover-plugins.yml    # Main discovery workflow

apps/website/
├── public/generated/plugins/
│   └── index.json          # Generated plugin data
└── src/
    ├── pages/PluginsPage.tsx
    ├── components/PluginCard/
    └── types/plugin.ts
```

## Rate Limits

GitHub API has rate limits:
- 30 requests/minute for search
- 5,000 requests/hour for authenticated

The workflow uses token-based authentication to maximize rate limits.

## Future Improvements

- [ ] Add more verification checks
- [ ] Include changelog from release notes
- [ ] Add dependency information
- [ ] Support filtering by API version
- [ ] Add trending/popular sections
