/**
 * HomeEmptyState Component
 *
 * Displayed when the repository has no plugins.
 * Matches Figma design exactly:
 * - Centered content
 * - Icon with container
 * - Heading and description
 * - CTA button
 */

import { Package } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export interface HomeEmptyStateProps {
  /** Optional message */
  message?: string;
}

/**
 * Figma tokens:
 * - Card: rounded-[12px], border, padding
 * - Icon container: h-16 w-16, rounded-full, centered
 * - Heading: text-lg, font-medium
 * - Description: text-sm, text-secondary
 * - Button: outline style
 */
export function HomeEmptyState({
  message = 'No plugins have been published yet.',
}: HomeEmptyStateProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '48px 24px',
        backgroundColor: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        textAlign: 'center',
      }}
    >
      {/* Icon container */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: colors.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${colors.border}`,
        }}
      >
        <Package className="h-8 w-8" style={{ color: colors.textMuted }} />
      </div>

      {/* Text content */}
      <div>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: colors.textPrimary,
            marginBottom: 8,
          }}
        >
          No Plugins Yet
        </h3>
        <p
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            maxWidth: 400,
          }}
        >
          {message}
        </p>
      </div>

      {/* CTA Button - Figma: outline style */}
      <a
        href="https://axolotl-pm.github.io/docs/submission"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 500,
          color: colors.brand,
          backgroundColor: 'transparent',
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          textDecoration: 'none',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = colors.brand;
          e.currentTarget.style.backgroundColor = colors.brandBg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = colors.border;
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        Learn how to submit →
      </a>
    </div>
  );
}
