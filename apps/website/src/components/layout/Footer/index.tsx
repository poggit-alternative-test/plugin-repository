/**
 * Footer Component
 *
 * Global website footer with links and attribution.
 * Visual implementation follows Figma design.
 */

import { Link } from 'react-router-dom';
import { Github, Heart } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function Footer() {
  const { colors } = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="border-t"
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
    >
      <div className="footer-container mx-auto max-w-7xl px-2 sm:px-4 md:px-6 lg:px-10">
        {/* Main footer content */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {/* Navigation links */}
          <nav
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]"
            aria-label="Footer navigation"
          >
            <Link
              to="/about"
              className="transition-all hover:opacity-80"
              style={{ color: colors.textSecondary }}
            >
              About
            </Link>
            <Link
              to="/submit"
              className="transition-all hover:opacity-80"
              style={{ color: colors.textSecondary }}
            >
              Submit Plugin
            </Link>
            <a
              href="https://poggit.pmmp.io"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-all hover:opacity-80"
              style={{ color: colors.textSecondary }}
            >
              poggit
            </a>
            <a
              href="https://github.com/axolotl-pm/plugin-repository"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition-all hover:opacity-80"
              style={{ color: colors.textSecondary }}
              aria-label="View source on GitHub"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              GitHub
            </a>
          </nav>

          {/* Attribution */}
          <p
            className="flex items-center gap-1 text-[13px]"
            style={{ color: colors.textMuted }}
          >
            Made with{' '}
            <Heart className="h-4 w-4" style={{ color: colors.textMuted }} aria-hidden="true" />
            {' '}by the{' '}
            <a
              href="https://github.com/axolotl-pm"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition-all hover:opacity-80"
              style={{ color: colors.textSecondary }}
            >
              axolotl-pm
            </a>
            {' '}team
          </p>
        </div>

        {/* Secondary line */}
        <div
          className="mt-6 border-t pt-6 text-center text-[11px] font-mono"
          style={{ borderColor: colors.border, color: colors.textMuted }}
        >
          <p>
            Axolotl Plugin Registry. All plugins are reviewed and verified before publication.
          </p>
          <p className="mt-1">
            © {currentYear} Axolotl. Built with PocketMine-MP.
          </p>
        </div>
      </div>
    </footer>
  );
}
