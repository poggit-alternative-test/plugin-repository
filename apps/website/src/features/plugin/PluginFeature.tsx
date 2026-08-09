/**
 * PluginFeature Component
 *
 * Plugin detail page with tabs.
 * Uses marked.js + highlight.js from CDN (same as HTML example)
 */

// @ts-ignore - from CDN
declare const marked: any;
// @ts-ignore - from CDN
declare const hljs: any;

import { useState } from 'react';
import { usePluginFeature } from './hooks';
import { LoadingState, ErrorState } from '@/components/ui';
import { PluginIcon } from '@/features/_shared/plugin';
import { useTheme } from '@/contexts/ThemeContext';
import type { Plugin, Version } from '@/services/generated';

// Base URL for public paths
const BASE_URL = import.meta.env.BASE_URL || '/';

function Badge({ label, color }: { label: string; color: 'blue' | 'green' | 'zinc' | 'red' | 'amber' }) {
  const { colors } = useTheme();
  const map = {
    blue: { bg: colors.brandBg, text: colors.brand },
    green: { bg: colors.successBg, text: colors.success },
    zinc: { bg: colors.card, text: colors.textSecondary },
    red: { bg: colors.errorBg, text: colors.error },
    amber: { bg: colors.warningBg, text: colors.warning },
  };
  const { bg, text } = map[color] || map.zinc;
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: bg,
        color: text,
      }}
    >
      {label}
    </span>
  );
}

function formatNumber(num?: number): string {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

/**
 * Check if a tag is a nightly/dev build based on tag name
 */
function isNightlyTag(tag: string): boolean {
  const lowerTag = tag.toLowerCase();
  return lowerTag.includes('nightly') ||
         lowerTag.includes('dev') ||
         lowerTag.includes('beta') ||
         lowerTag.includes('alpha');
}

/**
 * Get the release type based on tag name
 * GitHub API: /releases/latest returns only stable (no pre-release)
 * So pre-release/nightly comes from /releases endpoint
 */
function getReleaseType(release: { prerelease?: boolean; tag: string }): { label: string; isPreRelease: boolean; isNightly: boolean } {
  const isNightly = isNightlyTag(release.tag);

  if (isNightly) {
    return { label: 'Dev Build', isPreRelease: true, isNightly: true };
  }
  if (release.prerelease) {
    return { label: 'Pre-release', isPreRelease: true, isNightly: false };
  }
  return { label: 'Stable', isPreRelease: false, isNightly: false };
}

export function PluginFeature({ pluginId, version }: { pluginId: string; version?: string }) {
  const { colors } = useTheme();
  const { plugin, releases, readme, dependencies, loading, githubLoading, error } = usePluginFeature(pluginId, version);
  const [tab, setTab] = useState('Installation');

  if (loading) {
    return (
      <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
        <div className="page-container">
          <LoadingState message="Loading plugin..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
        <div className="page-container">
          <ErrorState title="Failed to load" message={error.message} />
        </div>
      </div>
    );
  }

  if (!plugin) {
    return (
      <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
        <div className="page-container">
          <ErrorState title="Plugin not found" message="Plugin not found" />
        </div>
      </div>
    );
  }

  const githubUrl = plugin.repoUrl || `https://github.com/${plugin.repo}`;
  const starsUrl = `${githubUrl}/stargazers`;
  const issuesUrl = `${githubUrl}/issues/new`;

  return (
    <div className="plugin-page" style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
      {/* Breadcrumb Header */}
      <header style={{
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap' }}>
            <a href={`${BASE_URL}plugins`} style={{ color: colors.brand, textDecoration: 'none' }}>Plugins</a>
            <span style={{ color: colors.textMuted }}>/</span>
            <a href={`${BASE_URL}plugins?author=${encodeURIComponent(plugin.author)}`} style={{ color: colors.brand, textDecoration: 'none' }}>{plugin.author}</a>
            <span style={{ color: colors.textMuted }}>/</span>
            <span style={{ color: colors.textSecondary }}>{plugin.id}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={starsUrl} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.textSecondary,
              textDecoration: 'none',
            }}>⭐ Stars</a>
            <a href={issuesUrl} target="_blank" rel="noopener noreferrer" style={{
              padding: '6px 12px',
              fontSize: 12,
              backgroundColor: colors.errorBg,
              border: `1px solid ${colors.error}33`,
              borderRadius: 8,
              color: colors.error,
              textDecoration: 'none',
            }}>🚨 Report</a>
          </div>
        </div>
      </header>

      {/* Content Grid */}
      <div className="plugin-grid">
        {/* Main Content */}
        <main className="plugin-main">
          {/* Plugin Info Section */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <PluginIcon repo={plugin.repo} name={plugin.name} size={56} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>{plugin.name}</h1>
                  <Badge label={`v${plugin.latestVersion}`} color="blue" />
                  <Badge label={plugin.status} color="green" />
                </div>
                <p style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 12px' }}>
                  {plugin.summary}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {plugin.categories?.map(c => <Badge key={c} label={c} color="zinc" />)}
                </div>
              </div>
            </div>
          </section>

          {/* Tabs */}
          <nav style={{
            display: 'flex',
            borderBottom: `1px solid ${colors.border}`,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            marginBottom: 24,
          }}>
            {['Installation', 'Overview', ...(releases.length > 0 ? ['Versions'] : []), ...((dependencies.depend.length > 0 || dependencies.softdepend.length > 0) ? ['Dependencies'] : [])].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: tab === t ? colors.brand : colors.textSecondary,
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? `2px solid ${colors.brand}` : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t}
              </button>
            ))}
          </nav>

          {/* Tab Content */}
          <div>
            {tab === 'Installation' && <InstallationTab plugin={plugin} releases={releases} />}
            {tab === 'Overview' && <OverviewTab readme={readme} loading={githubLoading} />}
            {tab === 'Versions' && <VersionsTab plugin={plugin} releases={releases} loading={githubLoading} />}
            {tab === 'Dependencies' && <DependenciesTab dependencies={dependencies} />}
          </div>
        </main>

        {/* Sidebar */}
        <aside className="plugin-sidebar">
          <Sidebar plugin={plugin} githubUrl={githubUrl} releases={releases} />
        </aside>
      </div>
    </div>
  );
}

function InstallationTab({ plugin, releases }: { plugin: Plugin; releases: Version[] }) {
  const { colors } = useTheme();
  // Find latest stable release (not nightly/dev)
  const latestStableRelease = releases.find(r => !isNightlyTag(r.release.tag));
  const githubUrl = plugin.repoUrl || `https://github.com/${plugin.repo}`;
  const totalDownloads = plugin.downloads?.total || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Installation</h2>

      {/* Download Stats */}
      <div style={{
        display: 'flex',
        gap: 16,
        padding: 16,
        backgroundColor: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Latest Stable</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.brand }}>
            {latestStableRelease?.release.tag || plugin.latestVersion}
          </div>
        </div>
        <div style={{ width: 1, backgroundColor: colors.border }} />
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Total Downloads</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>
            ↓ {formatNumber(totalDownloads)}
          </div>
        </div>
      </div>

      {/* Download Button - links to /releases/latest */}
      {latestStableRelease ? (
        <a
          href={`${githubUrl}/releases/latest`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            background: `linear-gradient(135deg, ${colors.brandLight}, ${colors.brandDark})`,
            color: '#fff',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            width: 'fit-content',
          }}
        >
          ⬇ Download Latest ({latestStableRelease.release.tag})
        </a>
      ) : (
        <p style={{ fontSize: 14, color: colors.textSecondary }}>
          No stable release available yet.
        </p>
      )}

      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10 }}>
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${colors.border}`, fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' }}>
          Terminal
        </div>
        <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, color: colors.textSecondary }}>
          <span style={{ color: colors.textMuted }}>$ </span>poggit require {plugin.repo || `${plugin.author}/${plugin.id}`}:{latestStableRelease?.release.tag || plugin.latestVersion}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ readme, loading }: { readme: string | null; loading: boolean }) {
  const { colors, mode } = useTheme();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Overview</h2>
        <p style={{ fontSize: 14, color: colors.textSecondary }}>Loading README...</p>
      </div>
    );
  }

  if (!readme) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Overview</h2>
        <p style={{ fontSize: 14, color: colors.textSecondary }}>No README available.</p>
      </div>
    );
  }

  marked.setOptions({
    gfm: true,
    breaks: true,
    highlight: function(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(code, { language: lang }).value; } catch (_) {}
      }
      return code;
    }
  });

  const html = marked.parse(readme);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Overview</h2>
      <article
        className={`markdown-body ${mode === 'dark' ? 'dark' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function VersionsTab({ plugin, releases, loading }: { plugin: Plugin; releases: Version[]; loading: boolean }) {
  const { colors, mode } = useTheme();
  const totalDownloads = plugin.downloads?.total || 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Versions</h2>
        <p style={{ fontSize: 14, color: colors.textSecondary }}>Loading versions...</p>
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Versions</h2>
        <p style={{ fontSize: 14, color: colors.textSecondary }}>No versions found.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Versions ({releases.length})</h2>

      {/* Release Type Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: colors.textMuted }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.brand }} />
          <span>Latest</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.textMuted }} />
          <span>Stable</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.warning }} />
          <span>Pre-release</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.error }} />
          <span>Dev Build</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {releases.map((release) => {
          const releaseType = getReleaseType(release.release);
          const releaseDownloads = release.artifact.downloads || 0;
          const downloadPercent = totalDownloads > 0 ? (releaseDownloads / totalDownloads) * 100 : 0;
          // Find latest stable release (for comparison)
          const latestStableRelease = releases.find(r => !isNightlyTag(r.release.tag));
          const isLatestStable = release === latestStableRelease;

          // Border color based on release type
          const getBorderColor = () => {
            if (releaseType.isNightly) return colors.error;
            if (releaseType.isPreRelease) return colors.warning;
            if (isLatestStable) return colors.brand;
            return colors.border;
          };

          return (
            <div key={release.version} style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: 16,
              borderLeft: `3px solid ${getBorderColor()}`,
              opacity: releaseType.isPreRelease ? 0.9 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, fontFamily: 'monospace' }}>
                        {release.release.tag}
                      </span>
                      {isLatestStable && (
                        <Badge label="Latest" color="blue" />
                      )}
                      {releaseType.isNightly && !isLatestStable && (
                        <Badge label="Pre-release" color="amber" />
                      )}
                      {!releaseType.isPreRelease && !isLatestStable && (
                        <Badge label="Stable" color="zinc" />
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: colors.textMuted }}>
                      {releaseType.label}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: colors.textMuted }}>
                    {new Date(release.release.publishedAt).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.brand, marginTop: 2 }}>
                    ↓ {formatNumber(releaseDownloads)}
                  </div>
                </div>
              </div>

              {/* Download Progress Bar */}
              {totalDownloads > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    height: 4,
                    backgroundColor: colors.border,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${downloadPercent}%`,
                      height: '100%',
                      backgroundColor: releaseType.isNightly
                        ? colors.error
                        : releaseType.isPreRelease
                          ? colors.warning
                          : isLatestStable
                            ? colors.brand
                            : colors.textMuted,
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
                    {downloadPercent.toFixed(1)}% of total downloads
                  </div>
                </div>
              )}

              {release.release.changelog && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: colors.textSecondary, cursor: 'pointer', marginBottom: 8 }}>
                    Changelog
                  </summary>
                  <div className={`markdown-body ${mode === 'dark' ? 'dark' : ''}`} style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <div dangerouslySetInnerHTML={{ __html: marked.parse(release.release.changelog) }} />
                  </div>
                </details>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {release.artifact?.downloadUrl ? (
                  <a
                    href={release.artifact.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      background: releaseType.isNightly
                        ? colors.errorBg
                        : releaseType.isPreRelease
                          ? colors.warningBg
                          : colors.brandBg,
                      color: releaseType.isNightly
                        ? colors.error
                        : releaseType.isPreRelease
                          ? colors.warning
                          : colors.brand,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    ⬇ Download
                  </a>
                ) : (
                  <a
                    href={`https://github.com/${plugin.repo}/releases/tag/${release.release.tag}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      background: releaseType.isNightly
                        ? colors.errorBg
                        : releaseType.isPreRelease
                          ? colors.warningBg
                          : colors.brandBg,
                      color: releaseType.isNightly
                        ? colors.error
                        : releaseType.isPreRelease
                          ? colors.warning
                          : colors.brand,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    View Release
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DependenciesTab({ dependencies }: { dependencies: { depend: string[]; softdepend: string[] } }) {
  const { colors } = useTheme();

  if (dependencies.depend.length === 0 && dependencies.softdepend.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Dependencies</h2>
        <p style={{ fontSize: 14, color: colors.textSecondary }}>No dependencies required.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Dependencies</h2>

      {dependencies.depend.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px' }}>
            Required ({dependencies.depend.length})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {dependencies.depend.map(dep => (
              <div key={dep} style={{
                padding: '8px 12px',
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 12,
                color: colors.textSecondary,
              }}>
                {dep}
              </div>
            ))}
          </div>
        </div>
      )}

      {dependencies.softdepend.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px' }}>
            Optional ({dependencies.softdepend.length})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {dependencies.softdepend.map(dep => (
              <div key={dep} style={{
                padding: '8px 12px',
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 12,
                color: colors.textSecondary,
              }}>
                {dep}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ plugin, githubUrl, releases }: { plugin: Plugin; githubUrl: string; releases: Version[] }) {
  const { colors } = useTheme();
  const downloadCount = releases.length;
  const totalDownloads = plugin.downloads?.total || 0;

  // Find latest stable release (not nightly/dev)
  const latestStableRelease = releases.find(r => !isNightlyTag(r.release.tag));

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Install button - links to /releases/latest which redirects to latest stable */}
      {latestStableRelease?.artifact?.downloadUrl ? (
        <a
          href={`${githubUrl}/releases/latest`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: '100%',
            padding: 12,
            background: `linear-gradient(135deg, ${colors.brandLight}, ${colors.brandDark})`,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'none',
            textAlign: 'center',
            display: 'block',
          }}
        >
          ↓ Install Plugin
        </a>
      ) : (
        <button style={{
          width: '100%',
          padding: 12,
          background: `linear-gradient(135deg, ${colors.brandLight}, ${colors.brandDark})`,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'not-allowed',
          opacity: 0.6,
        }} disabled>
          No Download
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {[
          { label: 'Version', value: latestStableRelease?.release.tag || plugin.latestVersion },
          { label: 'Author', value: plugin.author },
          { label: 'Releases', value: String(downloadCount) },
          { label: 'Downloads', value: formatNumber(totalDownloads) },
        ].map(item => (
          <div key={item.label} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: `1px solid ${colors.border}`,
            fontSize: 12,
          }}>
            <span style={{ color: colors.textMuted }}>{item.label}</span>
            <span style={{ color: colors.textSecondary, fontFamily: 'monospace' }}>{item.value}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Links
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a href={githubUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: colors.brand, textDecoration: 'none' }}>
            GitHub ↗
          </a>
          <a href={`${githubUrl}/stargazers`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: colors.brand, textDecoration: 'none' }}>
            Stars ↗
          </a>
          <a href={`${githubUrl}/issues`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: colors.brand, textDecoration: 'none' }}>
            Issues ↗
          </a>
        </div>
      </div>
    </div>
  );
}
