/**
 * PluginFeature Component
 *
 * Plugin detail page with tabs.
 * Figma tokens: 2-column grid (1fr 296px sidebar).
 */

import { useState } from 'react';
import { usePluginFeature } from './hooks';
import { LoadingState, ErrorState } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';
import type { Plugin, Version } from '@/services/generated';

export interface PluginFeatureProps {
  pluginId: string;
  version?: string;
}

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

export function PluginFeature({ pluginId, version }: PluginFeatureProps) {
  const { colors } = useTheme();
  const { plugin, releases, readme, dependencies, loading, githubLoading, error } = usePluginFeature(pluginId, version);
  const [tab, setTab] = useState('Installation');

  if (loading) {
    return <div style={{ backgroundColor: colors.bg, minHeight: '100vh', padding: '48px 40px' }}>
      <LoadingState message="Loading plugin..." />
    </div>;
  }

  if (error) {
    return <div style={{ backgroundColor: colors.bg, minHeight: '100vh', padding: '48px 40px' }}>
      <ErrorState title="Failed to load" message={error.message} />
    </div>;
  }

  if (!plugin) {
    return <div style={{ backgroundColor: colors.bg, minHeight: '100vh', padding: '48px 40px' }}>
      <ErrorState title="Plugin not found" message="Plugin not found" />
    </div>;
  }

  // GitHub URLs
  const githubUrl = plugin.repoUrl || `https://github.com/${plugin.repo}`;
  const starsUrl = `${githubUrl}/stargazers`;
  const issuesUrl = `${githubUrl}/issues/new`;

  return (
    <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, gap: 6, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['Plugins', plugin.author, plugin.id].map((item, i, arr) => (
              <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: i < arr.length - 1 ? colors.brand : colors.textSecondary }}>{item}</span>
                {i < arr.length - 1 && <span style={{ color: colors.textMuted }}>/</span>}
              </span>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <a href={starsUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.textSecondary, cursor: 'pointer', textDecoration: 'none' }}>
              ⭐ Star
            </a>
            <a href={issuesUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 12px', fontSize: 12, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.textSecondary, cursor: 'pointer', textDecoration: 'none' }}>
              Report
            </a>
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px' }}>
          <div style={{ padding: 40, borderRight: `1px solid ${colors.border}` }}>
            <PluginHeader plugin={plugin} />
            <PluginTabs tab={tab} onTab={setTab} hasReleases={releases.length > 0} hasDependencies={dependencies.depend.length > 0 || dependencies.softdepend.length > 0} />
            {tab === 'Installation' && <InstallationTab plugin={plugin} releases={releases} />}
            {tab === 'Overview' && <OverviewTab readme={readme} loading={githubLoading} />}
            {tab === 'Versions' && <VersionsTab plugin={plugin} releases={releases} loading={githubLoading} />}
            {tab === 'Dependencies' && <DependenciesTab dependencies={dependencies} />}
          </div>
          <Sidebar plugin={plugin} githubUrl={githubUrl} releases={releases} />
        </div>
      </div>
    </div>
  );
}

function PluginHeader({ plugin }: { plugin: Plugin }) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 32 }}>
      <div style={{ width: 64, height: 64, borderRadius: 14, background: `linear-gradient(135deg, ${colors.brandLight}22, ${colors.brandDark}22)`, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
        {plugin.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: colors.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>{plugin.name}</h1>
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
  );
}

function PluginTabs({ tab, onTab, hasReleases, hasDependencies }: { tab: string; onTab: (t: string) => void; hasReleases: boolean; hasDependencies: boolean }) {
  const { colors } = useTheme();
  const tabs = ['Installation', 'Overview'];
  if (hasReleases) tabs.push('Versions');
  if (hasDependencies) tabs.push('Dependencies');

  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, marginBottom: 32 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onTab(t)} style={{
          padding: '10px 16px', fontSize: 13, fontWeight: 500,
          color: tab === t ? colors.brand : colors.textSecondary,
          background: 'none', border: 'none',
          borderBottom: tab === t ? `2px solid ${colors.brand}` : '2px solid transparent',
          cursor: 'pointer', marginBottom: -1,
        }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function InstallationTab({ plugin, releases }: { plugin: Plugin; releases: Version[] }) {
  const { colors } = useTheme();

  // Get the latest release with download URL
  const latestRelease = releases.length > 0 ? releases[0] : null;
  const downloadUrl = latestRelease?.artifact?.downloadUrl;
  const directDownloadUrl = downloadUrl && downloadUrl !== latestRelease.html_url
    ? downloadUrl
    : latestRelease?.html_url;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Installation</h2>

      {directDownloadUrl ? (
        <a
          href={directDownloadUrl}
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
          ⬇ Download Latest Release ({plugin.latestVersion})
        </a>
      ) : (
        <p style={{ fontSize: 14, color: colors.textSecondary }}>
          No release download available yet.
        </p>
      )}

      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10 }}>
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' }}>poggit.json</span>
        </div>
        <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, color: colors.textSecondary, whiteSpace: 'pre-wrap' }}>
          <span style={{ color: colors.textMuted }}>{"{\n"}</span>
          <span style={{ color: colors.textMuted }}>  </span><span style={{ color: colors.brand }}>"repo"</span><span style={{ color: colors.textMuted }}>: </span><span style={{ color: colors.success }}>"{plugin.repo || `${plugin.author}/${plugin.id}`}"</span><span style={{ color: colors.textMuted }}>,\n</span>
          <span style={{ color: colors.textMuted }}>  </span><span style={{ color: colors.brand }}>"version"</span><span style={{ color: colors.textMuted }}>: </span><span style={{ color: colors.success }}>"{plugin.latestVersion}"</span><span style={{ color: colors.textMuted }}>\n</span>
          <span style={{ color: colors.textMuted }}>{"}"}</span>
        </div>
      </div>

      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10 }}>
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${colors.border}`, fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' }}>
          Terminal
        </div>
        <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, color: colors.textSecondary }}>
          <span style={{ color: colors.textMuted }}>$ </span>poggit require {plugin.repo || `${plugin.author}/${plugin.id}`}:{plugin.latestVersion}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ readme, loading }: { readme: string | null; loading: boolean }) {
  const { colors } = useTheme();

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

  // Simple markdown to HTML conversion (basic)
  const htmlContent = readme
    .replace(/^### (.+)$/gm, '<h3 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 20px 0 10px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 24px 0 12px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 28px 0 14px;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px;">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #3b82f6;">$1</a>')
    .replace(/\n\n/g, '</p><p style="font-size: 14px; color: #4b5563; line-height: 1.7; margin: 0 0 12px;">')
    .replace(/\n/g, '<br/>');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Overview</h2>
      <div
        style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: `<p style="font-size: 14px; color: #4b5563; line-height: 1.7; margin: 0 0 12px;">${htmlContent}</p>` }}
      />
    </div>
  );
}

function VersionsTab({ plugin, releases, loading }: { plugin: Plugin; releases: Version[]; loading: boolean }) {
  const { colors } = useTheme();

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {releases.map((release, index) => (
          <div key={release.version} style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: 16,
            borderLeft: index === 0 ? `3px solid ${colors.brand}` : `3px solid ${colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, fontFamily: 'monospace' }}>
                  v{release.version}
                </span>
                {index === 0 && <Badge label="Latest" color="blue" />}
                {release.status === 'published' && <Badge label="published" color="green" />}
              </div>
              <span style={{ fontSize: 12, color: colors.textMuted }}>
                {new Date(release.release.publishedAt).toLocaleDateString()}
              </span>
            </div>
            {release.release.changelog && (
              <details>
                <summary style={{ fontSize: 12, color: colors.textSecondary, cursor: 'pointer', marginBottom: 8 }}>
                  Changelog
                </summary>
                <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {release.release.changelog}
                </div>
              </details>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {release.artifact?.downloadUrl && release.artifact.downloadUrl !== release.release.tag ? (
                <a
                  href={release.artifact.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 12px',
                    background: colors.brandBg,
                    color: colors.brand,
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
                  href={release.release.tag ? `https://github.com/${plugin.repo}/releases/tag/${release.release.tag}` : release.source.upstream}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 12px',
                    background: colors.brandBg,
                    color: colors.brand,
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
        ))}
      </div>
    </div>
  );
}

function DependenciesTab({ dependencies }: { dependencies: { depend: string[]; softdepend: string[] } }) {
  const { colors } = useTheme();

  const hasDepend = dependencies.depend.length > 0;
  const hasSoftdepend = dependencies.softdepend.length > 0;

  if (!hasDepend && !hasSoftdepend) {
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

      {hasDepend && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px' }}>
            Required Dependencies ({dependencies.depend.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dependencies.depend.map(dep => (
              <div key={dep} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 12, color: colors.textSecondary }}>{dep}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSoftdepend && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px' }}>
            Soft Dependencies ({dependencies.softdepend.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dependencies.softdepend.map(dep => (
              <div key={dep} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 12, color: colors.textSecondary }}>{dep}</span>
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
  const downloadCount = releases.reduce((sum, r) => sum + (r.artifact?.downloadUrl ? 1 : 0), 0);

  const metadata = [
    { label: 'Version', value: plugin.latestVersion, mono: true },
    { label: 'Author', value: plugin.author },
    { label: 'Downloads', value: downloadCount > 0 ? downloadCount.toLocaleString() : 'N/A' },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {releases[0]?.artifact?.downloadUrl ? (
        <a
          href={releases[0].artifact.downloadUrl}
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
          width: '100%', padding: 12,
          background: `linear-gradient(135deg, ${colors.brandLight}, ${colors.brandDark})`,
          color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'not-allowed',
          opacity: 0.6,
        }} disabled>
          No Download Available
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {metadata.map(item => (
          <div key={item.label} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: 12,
          }}>
            <span style={{ color: colors.textMuted }}>{item.label}</span>
            <span style={{ color: colors.textSecondary, fontFamily: item.mono ? 'monospace' : undefined }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Links
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
