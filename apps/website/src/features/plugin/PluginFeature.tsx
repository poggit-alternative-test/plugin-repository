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
import type { Plugin } from '@/services/generated';

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
  const { plugin, loading, error } = usePluginFeature(pluginId, version);

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

  const [tab, setTab] = useState('Installation');

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
            <span style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.textSecondary, cursor: 'pointer' }}>
              ⭐ Star
            </span>
            <span style={{ padding: '5px 12px', fontSize: 12, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.textSecondary, cursor: 'pointer' }}>
              Report
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px' }}>
          <div style={{ padding: 40, borderRight: `1px solid ${colors.border}` }}>
            <PluginHeader plugin={plugin} />
            <PluginTabs tab={tab} onTab={setTab} />
            {tab === 'Installation' && <InstallationTab plugin={plugin} />}
            {tab === 'Overview' && <OverviewTab plugin={plugin} />}
          </div>
          <Sidebar plugin={plugin} />
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
          <Badge label="published" color="green" />
          {plugin.verified && <Badge label="✓ Verified" color="green" />}
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

function PluginTabs({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const { colors } = useTheme();
  const tabs = ['Installation', 'Overview', 'Versions', 'Dependencies'];
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

function InstallationTab({ plugin }: { plugin: Plugin }) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Installation</h2>
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10 }}>
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'var(--font-mono)' }}>composer.json</span>
          <button style={{ marginLeft: 'auto', fontSize: 11, color: colors.brand, background: 'none', border: 'none', cursor: 'pointer' }}>⧉ Copy</button>
        </div>
        <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: colors.textSecondary }}>
          <span style={{ color: colors.brand }}>"{plugin.author}/{plugin.id}"</span>: <span style={{ color: colors.warning }}>"^{plugin.latestVersion}"</span>
        </div>
      </div>
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10 }}>
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${colors.border}`, fontSize: 11, color: colors.textMuted, fontFamily: 'var(--font-mono)' }}>
          Terminal
        </div>
        <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: colors.textSecondary }}>
          <span style={{ color: colors.textMuted }}>$ </span>composer require {plugin.author}/{plugin.id}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ plugin }: { plugin: Plugin }) {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Overview</h2>
      <p style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.7, margin: 0 }}>
        {plugin.description || 'No description available.'}
      </p>
    </div>
  );
}

function Sidebar({ plugin }: { plugin: Plugin }) {
  const { colors } = useTheme();
  const metadata = [
    { label: 'Version', value: plugin.latestVersion, mono: true },
    { label: 'Author', value: plugin.author },
    { label: 'Downloads', value: plugin.downloads?.total?.toLocaleString() || 'N/A' },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <button style={{
        width: '100%', padding: 12,
        background: `linear-gradient(135deg, ${colors.brandLight}, ${colors.brandDark})`,
        color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
      }}>
        ↓ Install Plugin
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {metadata.map(item => (
          <div key={item.label} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: 12,
          }}>
            <span style={{ color: colors.textMuted }}>{item.label}</span>
            <span style={{ color: colors.textSecondary, fontFamily: item.mono ? 'var(--font-mono)' : undefined }}>
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
          {[
            ['GitHub', plugin.source],
            ['Homepage', plugin.homepage],
          ].filter(([, v]) => v).map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: colors.brand, textDecoration: 'none' }}>
              {label} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
