/**
 * AboutFeature Component
 *
 * Displays information about the Axolotl Plugin Registry.
 * Includes submission guidelines, verification process, and links.
 */

import { useTheme } from '@/contexts/ThemeContext';
import { Shield, CheckCircle, FileCheck, Github, ExternalLink, Download, Users, Clock } from 'lucide-react';

export function AboutFeature() {
  const { colors } = useTheme();

  return (
    <div style={{ backgroundColor: colors.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 40px' }}>
        {/* Hero Section */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{
            fontSize: 36,
            fontWeight: 700,
            color: colors.textPrimary,
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}>
            About Axolotl PM PL
          </h1>
          <p style={{
            fontSize: 16,
            color: colors.textSecondary,
            lineHeight: 1.7,
          }}>
            Axolotl PM PL is an open plugin registry for PocketMine-MP. We provide a trusted source for discovering, installing, and publishing plugins with verified provenance and security guarantees.
          </p>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 48,
        }}>
          <StatCard
            icon={Download}
            value="1,200+"
            label="Plugins"
            description="Trusted plugins"
            colors={colors}
          />
          <StatCard
            icon={Users}
            value="400+"
            label="Authors"
            description="Active developers"
            colors={colors}
          />
          <StatCard
            icon={Clock}
            value="24/7"
            label="Available"
            description="Always accessible"
            colors={colors}
          />
        </div>

        {/* Features Section */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontSize: 22,
            fontWeight: 600,
            color: colors.textPrimary,
            marginBottom: 20,
          }}>
            Why Axolotl PM PL?
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FeatureCard
              icon={Shield}
              title="Verified Security"
              description="Every plugin is reviewed by our team. We verify source code matches the distributed PHAR files using GitHub Artifact Attestation."
              colors={colors}
            />
            <FeatureCard
              icon={CheckCircle}
              title="Trusted Source"
              description="All plugins are cryptographically verified. You can confirm the plugin you're installing was built from the exact commit you see on GitHub."
              colors={colors}
            />
            <FeatureCard
              icon={FileCheck}
              title="Open Review"
              description="Every plugin goes through our review process. We check for malicious code, security issues, and compliance with PocketMine-MP standards."
              colors={colors}
            />
          </div>
        </section>

        {/* How It Works */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontSize: 22,
            fontWeight: 600,
            color: colors.textPrimary,
            marginBottom: 20,
          }}>
            How It Works
          </h2>

          <div style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 24,
          }}>
            <ol style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}>
              <Step
                number={1}
                title="Submit Your Plugin"
                description="Submit a pull request to our registry with your plugin's GitHub repository."
                colors={colors}
              />
              <Step
                number={2}
                title="Automated Review"
                description="Our CI system automatically checks your plugin for common issues and security problems."
                colors={colors}
              />
              <Step
                number={3}
                title="Manual Review"
                description="Our team reviews the code manually to ensure quality and safety standards are met."
                colors={colors}
              />
              <Step
                number={4}
                title="Published & Verified"
                description="Approved plugins are published with cryptographic attestation proving the PHAR matches the source."
                colors={colors}
              />
            </ol>
          </div>
        </section>

        {/* Links */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontSize: 22,
            fontWeight: 600,
            color: colors.textPrimary,
            marginBottom: 20,
          }}>
            Resources
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <LinkCard
              href="https://github.com/axolotl-pm/plugin-repository"
              icon={Github}
              title="GitHub Repository"
              description="View our source code and contribute"
              colors={colors}
            />
            <LinkCard
              href="https://axolotl-pm.github.io/docs/submission"
              icon={ExternalLink}
              title="Submission Guide"
              description="Learn how to submit your plugin"
              colors={colors}
            />
            <LinkCard
              href="https://axolotl-pm.github.io/docs/policies"
              icon={Shield}
              title="Policies"
              description="Review our submission and review policies"
              colors={colors}
            />
            <LinkCard
              href="https://axolotl-pm.github.io/docs"
              icon={FileCheck}
              title="Documentation"
              description="Full documentation for developers"
              colors={colors}
            />
          </div>
        </section>

        {/* Trust Model */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontSize: 22,
            fontWeight: 600,
            color: colors.textPrimary,
            marginBottom: 20,
          }}>
            Trust Model
          </h2>

          <div style={{
            backgroundColor: colors.brandBg,
            border: `1px solid ${colors.brand}`,
            borderRadius: 12,
            padding: 24,
          }}>
            <p style={{
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 1.7,
              marginBottom: 16,
            }}>
              Every plugin published on Axolotl is cryptographically verified using GitHub Artifact Attestation. This means:
            </p>
            <ul style={{
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 1.7,
              paddingLeft: 20,
              margin: 0,
            }}>
              <li style={{ marginBottom: 8 }}>The PHAR file you download was built from the exact source code shown on GitHub</li>
              <li style={{ marginBottom: 8 }}>The build was performed in a clean, isolated GitHub Actions environment</li>
              <li style={{ marginBottom: 8 }}>The build is linked to a specific GitHub commit and pull request</li>
              <li>The attestation can be verified using the GitHub CLI</li>
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section>
          <h2 style={{
            fontSize: 22,
            fontWeight: 600,
            color: colors.textPrimary,
            marginBottom: 20,
          }}>
            Get In Touch
          </h2>

          <p style={{
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 1.7,
            marginBottom: 16,
          }}>
            Have questions or want to contribute? Reach out to us on GitHub or check out our documentation.
          </p>

          <a
            href="https://github.com/axolotl-pm/plugin-repository"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`,
              color: '#fff',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <Github className="h-5 w-5" />
            View on GitHub
          </a>
        </section>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, value, label, description, colors }: {
  icon: React.ElementType;
  value: string;
  label: string;
  description: string;
  colors: any;
}) {
  return (
    <div style={{
      backgroundColor: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 20,
      textAlign: 'center',
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.brandBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 12px',
        color: colors.brand,
      }}>
        <Icon className="h-5 w-5" />
      </div>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color: colors.textPrimary,
        fontFamily: 'var(--font-mono)',
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: colors.textPrimary,
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 11,
        color: colors.textMuted,
      }}>
        {description}
      </div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon: Icon, title, description, colors }: {
  icon: React.ElementType;
  title: string;
  description: string;
  colors: any;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 16,
      padding: 20,
      backgroundColor: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.brandBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: colors.brand,
      }}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 style={{
          fontSize: 15,
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: 4,
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.6,
          margin: 0,
        }}>
          {description}
        </p>
      </div>
    </div>
  );
}

// Step Component
function Step({ number, title, description, colors }: {
  number: number;
  title: string;
  description: string;
  colors: any;
}) {
  return (
    <li style={{ display: 'flex', gap: 16 }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {number}
      </div>
      <div>
        <h4 style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: 4,
        }}>
          {title}
        </h4>
        <p style={{
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.6,
          margin: 0,
        }}>
          {description}
        </p>
      </div>
    </li>
  );
}

// Link Card Component
function LinkCard({ href, icon: Icon, title, description, colors }: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  colors: any;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        gap: 12,
        padding: 16,
        backgroundColor: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        textDecoration: 'none',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.brand;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: colors.brandBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: colors.brand,
      }}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: 2,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 11,
          color: colors.textMuted,
        }}>
          {description}
        </div>
      </div>
    </a>
  );
}
