import { Icon, useStyles2, useTheme2 } from '@grafana/ui';
import React, { useEffect, useMemo, useState } from 'react';
import { css, cx } from '@emotion/css';
import {
  buildFailureNavigationIndex,
  buildTraceViewSpans,
  formatDuration,
  getServiceColor,
  matchLogsToSpans,
  panWindow,
  zoomWindow,
} from '../utils/traceUtils';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { LogLevelFilter, LogLine, SpanFilter, Trace, TraceViewSpan, TraceWindow } from '../types';
import { SpanRow } from './SpanRow';
import { RefreshEvent, getAppEvents } from '@grafana/runtime';

interface TraceTimelineProps {
  trace: Trace;
  logs: LogLine[];
  width: number;
  height: number;
  defaultSpanFilter?: SpanFilter;
  defaultLogLevel?: LogLevelFilter;
  showServiceLegend?: boolean;
  enableExploreLinks?: boolean;
  liveMode?: boolean;
  liveRefreshMs?: number;
  dataState?: LoadingState;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 8px;
    overflow: hidden;
  `,
  toolbar: css`
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid ${theme.colors.border.weak};
    background: linear-gradient(135deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.primary} 100%);
  `,
  titleSection: css`
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 4px;
  `,
  traceTitle: css`
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: ${theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  traceId: css`
    color: ${theme.colors.text.secondary};
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  `,
  metrics: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  metric: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    color: ${theme.colors.text.secondary};
    background: ${theme.colors.background.primary};
  `,
  metricFailed: css`
    color: ${theme.colors.error.text};
    border-color: ${theme.colors.error.main}66;
    background: ${theme.colors.error.main}16;
  `,
  metricLive: css`
    color: ${theme.colors.success.text};
    border-color: ${theme.colors.success.main}66;
    background: ${theme.colors.success.main}14;
  `,
  metricLoading: css`
    color: ${theme.colors.warning.text};
    border-color: ${theme.colors.warning.main}66;
    background: ${theme.colors.warning.main}14;
  `,
  controls: css`
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  `,
  input: css`
    border: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
    color: ${theme.colors.text.primary};
    border-radius: 4px;
    padding: 5px 8px;
    height: 28px;
    font-size: 12px;
    min-width: 180px;

    &:focus {
      outline: none;
      border-color: ${theme.colors.primary.main};
    }
  `,
  select: css`
    border: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
    color: ${theme.colors.text.primary};
    border-radius: 4px;
    padding: 5px 8px;
    height: 28px;
    font-size: 12px;
  `,
  button: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 4px;
    height: 28px;
    padding: 0 8px;
    background: ${theme.colors.background.primary};
    color: ${theme.colors.text.secondary};
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;

    &:hover {
      color: ${theme.colors.text.primary};
      border-color: ${theme.colors.border.medium};
      background: ${theme.colors.background.canvas};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  buttonActive: css`
    border-color: ${theme.colors.primary.main};
    color: ${theme.colors.primary.text};
    background: ${theme.colors.primary.main}18;
  `,
  legend: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.secondary};
  `,
  legendItem: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: ${theme.colors.text.secondary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 999px;
    padding: 2px 8px;
    background: ${theme.colors.background.primary};
  `,
  legendSwatch: css`
    width: 8px;
    height: 8px;
    border-radius: 2px;
  `,
  timelineHeader: css`
    display: grid;
    grid-template-columns: minmax(240px, 36%) minmax(0, 1fr) minmax(92px, auto);
    align-items: center;
    gap: 12px;
    padding: 6px 12px;
    border-bottom: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.canvas};
    font-size: 11px;
    color: ${theme.colors.text.secondary};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  `,
  markers: css`
    display: flex;
    justify-content: space-between;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 10px;
    color: ${theme.colors.text.disabled};
  `,
  content: css`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,
  list: css`
    flex: 1;
    overflow: auto;
  `,
  empty: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: ${theme.colors.text.secondary};
    min-height: 180px;
    padding: 24px;
    text-align: center;
  `,
});

function matchesSearch(span: TraceViewSpan, searchTerm: string): boolean {
  if (!searchTerm) {
    return true;
  }

  const query = searchTerm.toLowerCase();
  return (
    span.operationName.toLowerCase().includes(query) ||
    span.serviceName.toLowerCase().includes(query) ||
    span.spanId.toLowerCase().includes(query)
  );
}

function buildExploreUrl(queryText: string): string {
  const leftState = {
    range: {
      from: 'now-1h',
      to: 'now',
    },
    queries: [
      {
        refId: 'A',
        query: queryText,
      },
    ],
  };

  return `/explore?left=${encodeURIComponent(JSON.stringify(leftState))}`;
}

export const TraceTimeline: React.FC<TraceTimelineProps> = ({
  trace,
  logs,
  width,
  height,
  defaultSpanFilter = 'all',
  defaultLogLevel = 'all',
  showServiceLegend = true,
  enableExploreLinks = true,
  liveMode = false,
  liveRefreshMs = 5000,
  dataState = LoadingState.Done,
}) => {
  useTheme2();
  const styles = useStyles2(getStyles);

  const [spanFilter, setSpanFilter] = useState<SpanFilter>(defaultSpanFilter);
  const [minLogLevel, setMinLogLevel] = useState<LogLevelFilter>(defaultLogLevel);
  const [searchTerm, setSearchTerm] = useState('');
  const [windowRange, setWindowRange] = useState<TraceWindow>({ start: 0, end: 1 });
  const [expandedSpanIds, setExpandedSpanIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (trace.rootSpan?.spanId) {
      initial.add(trace.rootSpan.spanId);
    }
    return initial;
  });
  const [focusedSpanId, setFocusedSpanId] = useState<string | undefined>(undefined);
  const [liveEnabled, setLiveEnabled] = useState<boolean>(liveMode);

  useEffect(() => {
    if (!liveEnabled) {
      return;
    }

    const timerId = window.setInterval(() => {
      getAppEvents().publish(new RefreshEvent());
    }, liveRefreshMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [liveEnabled, liveRefreshMs]);

  const spansWithLogs = useMemo(() => matchLogsToSpans(trace, logs), [trace, logs]);

  const viewSpans = useMemo(() => {
    return buildTraceViewSpans(
      spansWithLogs,
      trace.startTime,
      trace.duration,
      windowRange,
      minLogLevel
    );
  }, [spansWithLogs, trace.startTime, trace.duration, windowRange, minLogLevel]);

  const spanMap = useMemo(() => {
    const map = new Map<string, TraceViewSpan>();
    for (const span of viewSpans) {
      map.set(span.spanId, span);
    }
    return map;
  }, [viewSpans]);

  const filteredIds = useMemo(() => {
    const selected = new Set<string>();

    for (const span of viewSpans) {
      if (spanFilter === 'failed' && !span.isFailed) {
        continue;
      }

      if (!matchesSearch(span, searchTerm)) {
        continue;
      }

      selected.add(span.spanId);

      let parentId = span.parentSpanId;
      while (parentId) {
        selected.add(parentId);
        parentId = spanMap.get(parentId)?.parentSpanId;
      }
    }

    if (selected.size === 0 && trace.rootSpan?.spanId) {
      selected.add(trace.rootSpan.spanId);
    }

    return selected;
  }, [viewSpans, spanFilter, searchTerm, spanMap, trace.rootSpan]);

  const filteredSpans = useMemo(() => viewSpans.filter((span) => filteredIds.has(span.spanId)), [viewSpans, filteredIds]);

  const visibleSpans = useMemo(() => {
    const visibilityCache = new Map<string, boolean>();

    const isVisible = (span: TraceViewSpan): boolean => {
      if (!filteredIds.has(span.spanId)) {
        return false;
      }

      const cached = visibilityCache.get(span.spanId);
      if (cached !== undefined) {
        return cached;
      }

      if (!span.parentSpanId) {
        visibilityCache.set(span.spanId, true);
        return true;
      }

      const parent = spanMap.get(span.parentSpanId);
      if (!parent) {
        visibilityCache.set(span.spanId, true);
        return true;
      }

      if (!expandedSpanIds.has(parent.spanId)) {
        visibilityCache.set(span.spanId, false);
        return false;
      }

      const parentVisible = isVisible(parent);
      visibilityCache.set(span.spanId, parentVisible);
      return parentVisible;
    };

    return filteredSpans.filter((span) => isVisible(span));
  }, [filteredSpans, filteredIds, spanMap, expandedSpanIds]);

  const failedSpanIds = useMemo(() => filteredSpans.filter((span) => span.isFailed).map((span) => span.spanId), [filteredSpans]);

  const failureNavigation = useMemo(
    () => buildFailureNavigationIndex(failedSpanIds, focusedSpanId),
    [failedSpanIds, focusedSpanId]
  );

  const timeMarkers = useMemo(() => {
    const steps = 4;
    const markers: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const ratio = windowRange.start + (windowRange.end - windowRange.start) * (i / steps);
      markers.push(formatDuration(trace.duration * ratio));
    }
    return markers;
  }, [windowRange, trace.duration]);

  const focusAbsoluteRatio = useMemo(() => {
    if (!focusedSpanId) {
      return 0.5;
    }

    const focusedSpan = spanMap.get(focusedSpanId);
    if (!focusedSpan) {
      return 0.5;
    }

    const center = focusedSpan.startTime + focusedSpan.duration / 2;
    const absolute = (center - trace.startTime) / trace.duration;
    return Math.max(0, Math.min(1, absolute));
  }, [focusedSpanId, spanMap, trace.startTime, trace.duration]);

  const zoomAnchor = useMemo(() => {
    const currentWidth = Math.max(0.001, windowRange.end - windowRange.start);
    return (focusAbsoluteRatio - windowRange.start) / currentWidth;
  }, [focusAbsoluteRatio, windowRange.start, windowRange.end]);

  const expandAncestors = (spanId: string): void => {
    setExpandedSpanIds((current) => {
      const next = new Set(current);
      let parentId = spanMap.get(spanId)?.parentSpanId;
      while (parentId) {
        next.add(parentId);
        parentId = spanMap.get(parentId)?.parentSpanId;
      }
      return next;
    });
  };

  const selectFailure = (direction: 'next' | 'previous'): void => {
    const failures = failureNavigation.orderedFailedSpanIds;
    if (failures.length === 0) {
      return;
    }

    let nextIndex = failureNavigation.currentIndex;

    if (nextIndex === -1) {
      nextIndex = direction === 'next' ? 0 : failures.length - 1;
    } else if (direction === 'next') {
      nextIndex = Math.min(failures.length - 1, nextIndex + 1);
    } else {
      nextIndex = Math.max(0, nextIndex - 1);
    }

    const targetSpanId = failures[nextIndex];
    expandAncestors(targetSpanId);
    setExpandedSpanIds((current) => {
      const next = new Set(current);
      next.add(targetSpanId);
      return next;
    });
    setFocusedSpanId(targetSpanId);
  };

  const toggleExpand = (spanId: string): void => {
    setExpandedSpanIds((current) => {
      const next = new Set(current);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  };

  const openExplore = (query: string): void => {
    if (!enableExploreLinks) {
      return;
    }

    const url = buildExploreUrl(query);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const panStep = Math.max(0.02, (windowRange.end - windowRange.start) * 0.2);
  const isStreaming = dataState === LoadingState.Streaming;
  const isLoading = dataState === LoadingState.Loading;
  const liveStatusText = liveEnabled
    ? isStreaming
      ? 'Live stream'
      : isLoading
        ? 'Refreshing…'
        : `Auto ${Math.round(liveRefreshMs / 1000)}s`
    : 'Live off';

  return (
    <div className={styles.container} style={{ width, height }}>
      <div className={styles.toolbar}>
        <div className={styles.titleSection}>
          <h3 className={styles.traceTitle}>{trace.rootSpan?.operationName ?? 'Trace Timeline'}</h3>
          <span className={styles.traceId}>trace_id={trace.traceId}</span>
          <div className={styles.metrics}>
            <span className={styles.metric}>{formatDuration(trace.duration)}</span>
            <span className={styles.metric}>{trace.spans.length} spans</span>
            <span className={styles.metric}>{logs.length} logs</span>
            <span
              className={cx(
                styles.metric,
                liveEnabled ? (isStreaming ? styles.metricLive : isLoading ? styles.metricLoading : undefined) : undefined
              )}
              data-testid="trace-live-indicator"
            >
              {liveStatusText}
            </span>
            <span className={cx(styles.metric, styles.metricFailed)} data-testid="trace-failed-count">
              {failedSpanIds.length} failed
            </span>
          </div>
        </div>

        <div className={styles.controls}>
          <input
            className={styles.input}
            placeholder="Search service, operation, or span ID"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search spans"
          />

          <select
            className={styles.select}
            value={minLogLevel}
            onChange={(event) => setMinLogLevel(event.target.value as LogLevelFilter)}
            aria-label="Log level filter"
          >
            <option value="all">Logs: all</option>
            <option value="error">Logs: error+</option>
            <option value="warn">Logs: warn+</option>
            <option value="info">Logs: info+</option>
            <option value="debug">Logs: debug+</option>
            <option value="trace">Logs: trace+</option>
          </select>

          <button
            className={cx(styles.button, spanFilter === 'failed' && styles.buttonActive)}
            onClick={() => setSpanFilter((current) => (current === 'all' ? 'failed' : 'all'))}
            data-testid="trace-failed-toggle"
          >
            <Icon name="exclamation-triangle" size="xs" />
            Failed only
          </button>

          <button
            className={cx(styles.button, liveEnabled && styles.buttonActive)}
            onClick={() => setLiveEnabled((current) => !current)}
            data-testid="trace-live-toggle"
          >
            {liveEnabled ? 'Stop live' : 'Start live'}
          </button>

          <button
            className={styles.button}
            onClick={() => selectFailure('previous')}
            disabled={!failureNavigation.hasPrevious && failureNavigation.currentIndex !== -1}
            data-testid="trace-failure-prev"
          >
            <Icon name="angle-left" size="xs" />
            Prev fail
          </button>

          <button
            className={styles.button}
            onClick={() => selectFailure('next')}
            disabled={!failureNavigation.hasNext && failureNavigation.currentIndex !== -1}
            data-testid="trace-failure-next"
          >
            Next fail
            <Icon name="angle-right" size="xs" />
          </button>

          <button
            className={styles.button}
            onClick={() => setWindowRange({ start: 0, end: 1 })}
            data-testid="trace-window-fit"
          >
            Fit
          </button>

          <button
            className={styles.button}
            onClick={() => setWindowRange((current) => zoomWindow(current, 0.75, zoomAnchor))}
            data-testid="trace-window-zoom-in"
          >
            +
          </button>

          <button
            className={styles.button}
            onClick={() => setWindowRange((current) => zoomWindow(current, 1.3, zoomAnchor))}
            data-testid="trace-window-zoom-out"
          >
            -
          </button>

          <button
            className={styles.button}
            onClick={() => setWindowRange((current) => panWindow(current, -panStep))}
            data-testid="trace-window-pan-left"
          >
            <Icon name="angle-left" size="xs" />
          </button>

          <button
            className={styles.button}
            onClick={() => setWindowRange((current) => panWindow(current, panStep))}
            data-testid="trace-window-pan-right"
          >
            <Icon name="angle-right" size="xs" />
          </button>
        </div>
      </div>

      {showServiceLegend && (
        <div className={styles.legend}>
          {trace.services.map((service) => (
            <span className={styles.legendItem} key={service}>
              <span className={styles.legendSwatch} style={{ background: getServiceColor(service) }} />
              {service}
            </span>
          ))}
        </div>
      )}

      <div className={styles.timelineHeader}>
        <span>Span tree</span>
        <div className={styles.markers}>
          {timeMarkers.map((marker, index) => (
            <span key={`${marker}-${index}`} data-testid={`trace-marker-${index}`}>
              {marker}
            </span>
          ))}
        </div>
        <span style={{ textAlign: 'right' }}>Duration</span>
      </div>

      <div className={styles.content}>
        <div className={styles.list} data-testid="trace-span-list">
          {visibleSpans.length === 0 && (
            <div className={styles.empty}>
              <Icon name="search" size="lg" />
              <div>No spans match the current filters.</div>
            </div>
          )}

          {visibleSpans.map((span) => (
            <SpanRow
              key={span.spanId}
              span={span}
              isExpanded={expandedSpanIds.has(span.spanId)}
              isActive={focusedSpanId === span.spanId}
              onToggleExpand={() => toggleExpand(span.spanId)}
              onFocus={() => setFocusedSpanId(span.spanId)}
              enableExploreLinks={enableExploreLinks}
              onOpenExploreSpan={() => {
                openExplore(`trace_id=\"${trace.traceId}\" span_id=\"${span.spanId}\"`);
              }}
              onOpenExploreLog={(log) => {
                const safeLine = log.line.replace(/\s+/g, ' ').slice(0, 120);
                openExplore(`trace_id=\"${trace.traceId}\" span_id=\"${span.spanId}\" ${safeLine}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
