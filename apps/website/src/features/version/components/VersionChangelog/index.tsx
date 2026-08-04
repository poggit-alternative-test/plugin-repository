/**
 * VersionChangelog Component
 *
 * Displays the version changelog/release notes.
 * Follows Figma layout specifications with markdown parsing like PluginReadmePreview.
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { Card, Divider } from '@/components/ui';
import type { Version } from '@/services/generated';

export interface VersionChangelogProps {
  version: Version;
}

/**
 * Parse inline markdown formatting (bold, italic, code, links)
 */
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={key++}
          className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/) || remaining.match(/^__(.+?)__/);
    if (boldMatch) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic: *text*
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(
        <em key={key++} className="italic">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Link: [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          className="text-primary-600 dark:text-primary-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Regular character
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts;
}

/**
 * Parse changelog content with markdown-like formatting
 */
function parseChangelog(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listLines: string[] = [];

  const flushList = () => {
    if (listLines.length > 0) {
      const Tag = listType || 'ul';
      elements.push(
        <Tag
          key={elements.length}
          className={
            Tag === 'ol'
              ? 'text-sm text-gray-600 dark:text-gray-400 mb-4 pl-6 list-decimal list-inside space-y-1'
              : 'text-sm text-gray-600 dark:text-gray-400 mb-4 pl-6 list-disc list-inside space-y-1'
          }
        >
          {listLines.map((item, i) => (
            <li key={i}>{parseInline(item.trim())}</li>
          ))}
        </Tag>
      );
      listLines = [];
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Code block start/end
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={elements.length}
            className="bg-gray-900 dark:bg-gray-950 text-gray-100 text-xs font-mono p-4 rounded-lg overflow-x-auto mb-4"
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Empty line - flush lists
    if (trimmed === '') {
      flushList();
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1
          key={elements.length}
          className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3 first:mt-0"
        >
          {trimmed.slice(2)}
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2
          key={elements.length}
          className="text-lg font-semibold text-gray-900 dark:text-white mt-5 mb-3"
        >
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3
          key={elements.length}
          className="text-base font-semibold text-gray-900 dark:text-white mt-4 mb-2"
        >
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushList();
      elements.push(
        <hr
          key={elements.length}
          className="border-gray-200 dark:border-gray-700 my-4"
        />
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote
          key={elements.length}
          className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-500 dark:text-gray-400 my-4"
        >
          {trimmed.slice(2)}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listLines.push(trimmed.slice(2));
      continue;
    }

    // Ordered list
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (orderedMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listLines.push(orderedMatch[1]);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p
        key={elements.length}
        className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3"
      >
        {parseInline(trimmed)}
      </p>
    );
  }

  flushList();
  return elements;
}

export function VersionChangelog({ version }: VersionChangelogProps) {
  if (!version.release.changelog) {
    return null;
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Changelog
          </h3>
        </div>
      </div>

      <Divider className="mb-4" />

      <div className="space-y-1">
        {parseChangelog(version.release.changelog)}
      </div>
    </Card>
  );
}
