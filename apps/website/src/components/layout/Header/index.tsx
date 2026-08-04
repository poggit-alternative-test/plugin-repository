/**
 * Header Component
 *
 * Global website header with navigation.
 * Follows Figma design: clean, minimal header with logo and navigation.
 * Search is handled by the HomeHero component.
 */

import { useState, useCallback } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, Menu, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { colors } = useTheme();

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          height: 56,
          maxWidth: 1280,
          margin: '0 auto',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
        }}
      >
        {/* Brand logo */}
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none' }}
          aria-label="Axolotl PM home"
        >
          <img
            src="/brand/logo/mark.svg"
            alt=""
            width={28}
            height={28}
            style={{ flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: colors.textPrimary,
              letterSpacing: '-0.01em',
            }}
          >
            AXOLOTL PM
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          style={{ display: 'flex', alignItems: 'center', gap: 2 }}
          aria-label="Main navigation"
        >
          <NavLink
            to="/search"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              backgroundColor: isActive ? colors.brandBg : 'transparent',
              color: isActive ? colors.brand : colors.textSecondary,
              textDecoration: 'none',
              transition: 'all 0.15s',
            })}
          >
            <Search className="h-4 w-4" />
            Browse
          </NavLink>
          <NavLink
            to="/authors"
            style={({ isActive }) => ({
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              backgroundColor: isActive ? colors.brandBg : 'transparent',
              color: isActive ? colors.brand : colors.textSecondary,
              textDecoration: 'none',
              transition: 'all 0.15s',
            })}
          >
            Authors
          </NavLink>
          <a
            href="https://axolotl-pm.github.io/docs/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              backgroundColor: 'transparent',
              color: colors.textSecondary,
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
          >
            Docs
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={toggleMobileMenu}
          style={{
            display: 'none',
            padding: 8,
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: colors.textSecondary,
          }}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <nav
          style={{
            borderTop: `1px solid ${colors.border}`,
            padding: '12px 40px',
            backgroundColor: colors.surface,
          }}
          aria-label="Mobile navigation"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <NavLink
              to="/search"
              onClick={closeMobileMenu}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 8,
                backgroundColor: isActive ? colors.brandBg : 'transparent',
                color: isActive ? colors.brand : colors.textSecondary,
                textDecoration: 'none',
              })}
            >
              <Search className="h-4 w-4" />
              Browse Plugins
            </NavLink>
            <NavLink
              to="/authors"
              onClick={closeMobileMenu}
              style={({ isActive }) => ({
                padding: '10px 12px',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 8,
                backgroundColor: isActive ? colors.brandBg : 'transparent',
                color: isActive ? colors.brand : colors.textSecondary,
                textDecoration: 'none',
              })}
            >
              Authors
            </NavLink>
            <a
              href="https://axolotl-pm.github.io/docs/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMobileMenu}
              style={{
                padding: '10px 12px',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 8,
                backgroundColor: 'transparent',
                color: colors.textSecondary,
                textDecoration: 'none',
              }}
            >
              Docs
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
