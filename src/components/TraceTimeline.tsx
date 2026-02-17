import { Icon, useStyles2, useTheme2 } from '@grafana/ui';
import { LogLine, Trace } from '../types';
import React, { useMemo, useState } from 'react';
import { formatDuration, getServiceColor, matchLogsToSpans } from '../utils/traceUtils';

import { GrafanaTheme2 } from '@grafana/data';
import { SpanRow } from './SpanRow';
import { css } from '@emotion/css';

interface TraceTimelineProps {
  trace: Trace;
  logs: LogLine[];
  width: number;
  height: number;
  showServiceColors?: boolean;
  showDuration?: boolean;
  collapsedByDefault?: boolean;
  colorizeByLogLevel?: boolean;
  errorColor?: string;
  warningColor?: string;
  infoColor?: string;
  debugColor?: string;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: ${theme.colors.background.primary};
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.canvas} 100%);
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
  headerLeft: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  traceId: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: ${theme.colors.text.secondary};
  `,
  traceIdLabel: css`
    color: ${theme.colors.text.disabled};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,
  traceIdValue: css`
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    background: ${theme.colors.background.canvas};
    padding: 2px 8px;
    border-radius: 4px;
    color: ${theme.colors.primary.text};
  `,
  stats: css`
    display: flex;
    gap: 20px;
  `,
  stat: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 16px;
    background: ${theme.colors.background.primary};
    border-radius: 8px;
  `,
  statValue: css`
    font-size: 20px;
    font-weight: 600;
    color: ${theme.colors.text.primary};
    line-height: 1.2;
  `,
  statLabel: css`
    font-size: 10px;
    color: ${theme.colors.text.secondary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,
  timeline: css`
    display: flex;
    align-items: center;
    padding: 8px 20px;
    background: ${theme.colors.background.canvas};
    border-bottom: 1px solid ${theme.colors.border.weak};
    gap: 8px;
    font-size: 11px;
    color: ${theme.colors.text.secondary};
  `,
  timelineLegend: css`
    flex: 1;
    display: flex;
    justify-content: space-between;
    margin-left: 310px;
  `,
  timeMarker: css`
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: ${theme.colors.text.disabled};
  `,
  services: css`
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px 20px;
    background: ${theme.colors.background.secondary};
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
  serviceItem: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: ${theme.colors.text.secondary};
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.15s ease;

    &:hover {
      background: ${theme.colors.background.canvas};
    }
  `,
  serviceColor: css`
    width: 10px;
    height: 10px;
    border-radius: 2px;
  `,
  spansContainer: css`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: ${theme.colors.background.secondary};
    }

    &::-webkit-scrollbar-thumb {
      background: ${theme.colors.border.medium};
      border-radius: 4px;

      &:hover {
        background: ${theme.colors.border.strong};
      }
    }
  `,
  emptyState: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: ${theme.colors.text.secondary};
    gap: 16px;
  `,
  emptyIcon: css`
    color: ${theme.colors.text.disabled};
    opacity: 0.5;
  `,
  emptyText: css`
    font-size: 16px;
    font-weight: 500;
  `,
  emptySubtext: css`
    font-size: 13px;
    color: ${theme.colors.text.disabled};
    text-align: center;
    max-width: 400px;
  `,
});

export const TraceTimeline: React.FC<TraceTimelineProps> = ({
  trace,
  logs,
  width,
  height,
  showServiceColors = true,
  showDuration = true,
  collapsedByDefault = true,
  colorizeByLogLevel = false,
  errorColor = '#F2495C',
  warningColor = '#FF9830',
  infoColor = '#73BF69',
  debugColor = '#A352CC',
}) => {
  useTheme2();
  const styles = useStyles2(getStyles);

  // Debug: log trace duration raw and formatted
  React.useEffect(() => {
    try {
      console.log('TraceTimeline: trace.duration raw =', trace.duration);
      console.log('TraceTimeline: trace.duration formatted =', formatDuration(trace.duration));
      if (trace.spans && trace.spans.length > 0) {
        const sample = trace.spans.slice(0, 5).map((s) => ({ spanId: s.spanId, raw: s.duration, formatted: formatDuration(s.duration) }));
        console.log('TraceTimeline: span duration samples =', sample);
      }
    } catch (e) {
      // ignore
    }
  }, [trace]);
  // Process spans with logs
  const spansWithLogs = useMemo(() => matchLogsToSpans(trace, logs), [trace, logs]);

  // Track expanded spans
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());

  // Reset expanded state when collapsedByDefault changes
  React.useEffect(() => {
    if (collapsedByDefault) {
      setExpandedSpans(new Set());
    } else {
      // If not collapsed by default, expand spans that have logs
      setExpandedSpans(new Set(spansWithLogs.filter((s) => s.logs.length > 0).map((s) => s.spanId)));
    }
  }, [collapsedByDefault, spansWithLogs]);

  const toggleSpan = (spanId: string) => {
    setExpandedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  };

  // Calculate timeline width based on panel width
  const timelineWidth = Math.max(200, width - 500);

  // Build a map of spans for ancestor checks
  const spanMap = useMemo(() => new Map(spansWithLogs.map((s) => [s.spanId, s])), [spansWithLogs]);

  // Determine which spans should be visible based on expanded parents
  const visibleSpans = useMemo(() => {
    const visible: typeof spansWithLogs = [];

    const isSpanVisible = (span: typeof spansWithLogs[0]): boolean => {
      if (!span.parentSpanId) return true; // root-level spans always visible
      const parent = spanMap.get(span.parentSpanId);
      if (!parent) return true;
      // parent must be visible and expanded
      if (!isSpanVisible(parent)) return false;
      return expandedSpans.has(parent.spanId);
    };

    for (const s of spansWithLogs) {
      if (isSpanVisible(s)) visible.push(s);
    }
    return visible;
  }, [spansWithLogs, spanMap, expandedSpans]);

  // Calculate time markers
  const timeMarkers = useMemo(() => {
    const markers = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const time = (trace.duration / steps) * i;
      markers.push(formatDuration(time));
    }
    return markers;
  }, [trace.duration]);

  // Count logs per span
  const totalLogs = logs.length;

  return (
    <div className={styles.container} style={{ width, height }}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.traceId}>
            <span className={styles.traceIdLabel}>Trace ID</span>
            <span className={styles.traceIdValue}>{trace.traceId}</span>
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{trace.spans.length}</span>
            <span className={styles.statLabel}>Spans</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{trace.services.length}</span>
            <span className={styles.statLabel}>Services</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatDuration(trace.duration)}</span>
            <span className={styles.statLabel}>Duration</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totalLogs}</span>
            <span className={styles.statLabel}>Logs</span>
          </div>
        </div>
      </div>

      {/* Services legend */}
      {showServiceColors && (
        <div className={styles.services}>
          {trace.services.map((service) => (
            <div key={service} className={styles.serviceItem}>
              <div className={styles.serviceColor} style={{ background: getServiceColor(service) }} />
              <span>{service}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline header */}
      <div className={styles.timeline}>
        <Icon name="clock-nine" size="sm" />
        <span>Timeline</span>
        <div className={styles.timelineLegend}>
          {timeMarkers.map((marker, i) => (
            <span key={i} className={styles.timeMarker}>
              {marker}
            </span>
          ))}
        </div>
      </div>

      {/* Spans list */}
      <div className={styles.spansContainer}>
        {visibleSpans.map((span) => (
          <SpanRow
            key={span.spanId}
            span={span}
            traceStart={trace.startTime}
            traceDuration={trace.duration}
            isExpanded={expandedSpans.has(span.spanId)}
            onToggle={() => toggleSpan(span.spanId)}
            timelineWidth={timelineWidth}
            showServiceColors={showServiceColors}
            showDuration={showDuration}
            colorizeByLogLevel={colorizeByLogLevel}
            errorColor={errorColor}
            warningColor={warningColor}
            infoColor={infoColor}
            debugColor={debugColor}
          />
        ))}
      </div>
    </div>
  );
};
