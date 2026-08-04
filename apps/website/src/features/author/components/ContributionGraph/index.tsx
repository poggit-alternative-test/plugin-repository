/**
 * ContributionGraph Component
 *
 * GitHub-style contribution activity graph.
 * Displays 52 weeks × 7 days of contribution activity.
 */

import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export interface ContributionGraphProps {
  /** Plugin publish dates for calculating contributions */
  pluginDates?: string[];
  /** Number of weeks to display (default: 52) */
  weeks?: number;
  className?: string;
}

interface DayData {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

/**
 * Generate contribution data from plugin dates
 */
function generateContributions(pluginDates: string[], weeks: number): DayData[] {
  const today = new Date();
  const days: DayData[] = [];
  const totalDays = weeks * 7;

  // Count contributions by date
  const contributionsByDate = new Map<string, number>();
  pluginDates.forEach(dateStr => {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const key = date.toISOString().split('T')[0];
      contributionsByDate.set(key, (contributionsByDate.get(key) || 0) + 1);
    }
  });

  // Generate days from today backwards
  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    const count = contributionsByDate.get(dateKey) || 0;

    // Calculate level based on count (0-4 scale like GitHub)
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count > 0) {
      level = 1;
      if (count >= 3) level = 2;
      if (count >= 6) level = 3;
      if (count >= 10) level = 4;
    }

    days.push({ date: dateKey, count, level });
  }

  return days;
}

const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ContributionGraph({
  pluginDates = [],
  weeks = 52,
  className = '',
}: ContributionGraphProps) {
  const { colors } = useTheme();

  const { days, monthLabels } = useMemo(() => {
    const allDays = generateContributions(pluginDates, weeks);
    const cols: DayData[][] = [];

    // Group into weeks (columns)
    for (let i = 0; i < allDays.length; i += 7) {
      cols.push(allDays.slice(i, i + 7));
    }

    // Generate month labels
    const labels: { month: string; col: number }[] = [];
    let lastMonth = -1;
    cols.forEach((week, i) => {
      const firstDay = week.find(d => d.date);
      if (firstDay) {
        const month = new Date(firstDay.date).getMonth();
        if (month !== lastMonth) {
          labels.push({ month: MONTHS[month], col: i });
          lastMonth = month;
        }
      }
    });

    return { days: cols, monthLabels: labels };
  }, [pluginDates, weeks]);

  // Get color for level
  const getColor = (level: number) => {
    switch (level) {
      case 0:
        return colors.border;
      case 1:
        return colors.brandLight + '40'; // 25% opacity
      case 2:
        return colors.brandLight + '70'; // ~44% opacity
      case 3:
        return colors.brandLight + 'A0'; // ~63% opacity
      case 4:
        return colors.brand;
      default:
        return colors.border;
    }
  };

  return (
    <div className={className}>
      {/* Month labels */}
      <div style={{ display: 'flex', marginBottom: 4, marginLeft: 32 }}>
        {monthLabels.map(({ month, col }, i) => (
          <div
            key={`${month}-${i}`}
            style={{
              position: 'absolute',
              left: `calc(32px + ${col * 14}px)`,
              fontSize: 10,
              color: colors.textMuted,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {month}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {/* Weekday labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4 }}>
          {WEEKDAYS.map((day, i) => (
            <div
              key={i}
              style={{
                height: 10,
                fontSize: 9,
                color: colors.textMuted,
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Contribution grid */}
        <div style={{ display: 'flex', gap: 3 }}>
          {days.map((week, weekIdx) => (
            <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {week.map((day, dayIdx) => (
                <div
                  key={`${weekIdx}-${dayIdx}`}
                  title={`${day.date}: ${day.count} plugin${day.count !== 1 ? 's' : ''}`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: getColor(day.level),
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          marginTop: 8,
          fontSize: 10,
          color: colors.textMuted,
        }}
      >
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: getColor(level),
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
