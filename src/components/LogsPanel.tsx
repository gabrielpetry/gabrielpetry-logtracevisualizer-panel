import { Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import React, { useMemo, useState } from 'react';
import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { LogLine, SelectedSpanTab } from '../types';
import { formatDuration } from '../utils/traceUtils';

interface LogsPanelProps {
  tabs: SelectedSpanTab[];
  focusedSpanId?: string;
  onFocusSpan: (spanId: string) => void;
  onCloseSpan: (spanId: string) => void;
  onClearSelection: () => void;
  enableExploreLinks?: boolean;
  onOpenExploreSpan?: (spanId: string) => void;
  onOpenExploreLog?: (spanId: string, log: LogLine) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    border-top: 1px solid ${theme.colors.border.weak};
    background: linear-gradient(180deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.primary} 100%);
    display: flex;
    flex-direction: column;
    min-height: 180px;
    max-height: 44%;
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid ${theme.colors.border.weak};
    gap: 12px;
  `,
  title: css`
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${theme.colors.text.secondary};
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  `,
  headerActions: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  textButton: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 4px;
    background: ${theme.colors.background.primary};
    color: ${theme.colors.text.secondary};
    font-size: 11px;
    padding: 4px 8px;
    cursor: pointer;

    &:hover {
      color: ${theme.colors.text.primary};
      border-color: ${theme.colors.border.medium};
      background: ${theme.colors.background.canvas};
    }
  `,
  tabs: css`
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    overflow-x: auto;
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
  tab: css`
    min-width: 160px;
    max-width: 260px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
    border-radius: 6px;
    padding: 6px 8px;
    cursor: pointer;
  `,
  tabActive: css`
    border-color: ${theme.colors.primary.main};
    background: ${theme.colors.primary.main}12;
  `,
  tabText: css`
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
  `,
  tabTitle: css`
    font-size: 12px;
    color: ${theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  tabSub: css`
    font-size: 10px;
    color: ${theme.colors.text.secondary};
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  tabBadge: css`
    font-size: 9px;
    font-weight: 700;
    border-radius: 999px;
    padding: 1px 6px;
    line-height: 1.4;
  `,
  badgeFailed: css`
    color: ${theme.colors.error.text};
    background: ${theme.colors.error.main}28;
  `,
  closeButton: css`
    border: none;
    background: transparent;
    color: ${theme.colors.text.disabled};
    cursor: pointer;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: ${theme.colors.text.primary};
      background: ${theme.colors.background.canvas};
    }
  `,
  body: css`
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  `,
  details: css`
    padding: 10px 12px;
    border-bottom: 1px dashed ${theme.colors.border.weak};
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: start;
  `,
  detailMain: css`
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  operation: css`
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  chips: css`
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  `,
  chip: css`
    font-size: 10px;
    border-radius: 999px;
    border: 1px solid ${theme.colors.border.weak};
    padding: 2px 8px;
    color: ${theme.colors.text.secondary};
  `,
  failedChip: css`
    color: ${theme.colors.error.text};
    border-color: ${theme.colors.error.main}66;
    background: ${theme.colors.error.main}20;
  `,
  detailActions: css`
    display: flex;
    gap: 8px;
    align-items: center;
  `,
  attrs: css`
    margin: 0 12px 10px;
    padding: 8px;
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 6px;
    max-height: 120px;
    overflow: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
  attr: css`
    font-size: 10px;
    color: ${theme.colors.text.secondary};
    background: ${theme.colors.background.canvas};
    border-radius: 4px;
    padding: 2px 6px;
  `,
  logs: css`
    flex: 1;
    overflow: auto;
    padding: 0 12px 12px;
  `,
  logRow: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'meta actions'
      'message message';
    gap: 8px;
    align-items: start;
    border-bottom: 1px solid ${theme.colors.border.weak};
    padding: 8px 0;
    font-size: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;

    &:hover {
      background: ${theme.colors.background.canvas};
    }
  `,
  meta: css`
    grid-area: meta;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
  `,
  time: css`
    color: ${theme.colors.text.disabled};
    font-size: 11px;
  `,
  level: css`
    min-width: 52px;
    font-size: 10px;
    font-weight: 700;
    border-radius: 3px;
    text-transform: uppercase;
    text-align: center;
    padding: 2px 6px;
  `,
  levelInfo: css`
    background: ${theme.colors.info.main}20;
    color: ${theme.colors.info.text};
  `,
  levelWarn: css`
    background: ${theme.colors.warning.main}20;
    color: ${theme.colors.warning.text};
  `,
  levelError: css`
    background: ${theme.colors.error.main}20;
    color: ${theme.colors.error.text};
  `,
  levelDebug: css`
    background: ${theme.colors.secondary.main}18;
    color: ${theme.colors.text.secondary};
  `,
  message: css`
    grid-area: message;
    color: ${theme.colors.text.primary};
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.4;
  `,
  logActions: css`
    grid-area: actions;
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  `,
  iconButton: css`
    border: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
    color: ${theme.colors.text.secondary};
    border-radius: 4px;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:hover {
      color: ${theme.colors.text.primary};
      border-color: ${theme.colors.border.medium};
      background: ${theme.colors.background.canvas};
    }
  `,
  emptyLogs: css`
    color: ${theme.colors.text.disabled};
    font-size: 12px;
    padding: 12px 0;
    font-style: italic;
  `,
});

function levelClass(level: LogLine['level'], styles: ReturnType<typeof getStyles>): string {
  if (level === 'error') {
    return styles.levelError;
  }

  if (level === 'warn') {
    return styles.levelWarn;
  }

  if (level === 'debug' || level === 'trace') {
    return styles.levelDebug;
  }

  return styles.levelInfo;
}

function relativeLogTime(logTimestampNs: number, spanStartUs: number): string {
  const spanStartNs = spanStartUs * 1000;
  const deltaMs = (logTimestampNs - spanStartNs) / 1000000;
  const prefix = deltaMs >= 0 ? '+' : '-';
  return `${prefix}${Math.abs(deltaMs).toFixed(2)}ms`;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({
  tabs,
  focusedSpanId,
  onFocusSpan,
  onCloseSpan,
  onClearSelection,
  enableExploreLinks = true,
  onOpenExploreSpan,
  onOpenExploreLog,
}) => {
  useTheme2();
  const styles = useStyles2(getStyles);
  const [showAttributes, setShowAttributes] = useState(false);

  const focusedTab = useMemo(() => {
    if (tabs.length === 0) {
      return undefined;
    }

    const selected = focusedSpanId ? tabs.find((tab) => tab.spanId === focusedSpanId) : undefined;
    return selected ?? tabs[0];
  }, [tabs, focusedSpanId]);

  if (!focusedTab) {
    return null;
  }

  const sortedAttributes = Object.entries(focusedTab.span.tags).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className={styles.container} data-testid="trace-details-drawer">
      <div className={styles.header}>
        <div className={styles.title}>
          <Icon name="list-ul" size="sm" />
          <span>Selected Spans ({tabs.length})</span>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.textButton} onClick={() => setShowAttributes((current) => !current)}>
            {showAttributes ? 'Hide Attributes' : 'Show Attributes'}
          </button>
          <button className={styles.textButton} onClick={onClearSelection}>
            Clear Selection
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <div
            key={tab.spanId}
            className={cx(styles.tab, focusedTab.spanId === tab.spanId && styles.tabActive)}
            onClick={() => onFocusSpan(tab.spanId)}
            data-testid="trace-selected-tab"
            data-span-id={tab.spanId}
          >
            <div className={styles.tabText}>
              <span className={styles.tabTitle}>{tab.title}</span>
              <span className={styles.tabSub}>{tab.serviceName}</span>
            </div>

            {tab.isFailed && <span className={cx(styles.tabBadge, styles.badgeFailed)}>FAILED</span>}

            <button
              className={styles.closeButton}
              onClick={(event) => {
                event.stopPropagation();
                onCloseSpan(tab.spanId);
              }}
              aria-label="Remove selected span"
            >
              <Icon name="times" size="xs" />
            </button>
          </div>
        ))}
      </div>

      <div className={styles.body}>
        <div className={styles.details}>
          <div className={styles.detailMain}>
            <div className={styles.operation}>{focusedTab.span.operationName}</div>
            <div className={styles.chips}>
              <span className={styles.chip}>{focusedTab.span.serviceName}</span>
              <span className={styles.chip}>{formatDuration(focusedTab.span.duration)}</span>
              <span className={styles.chip}>{focusedTab.logs.length} logs</span>
              <span className={cx(styles.chip, focusedTab.isFailed && styles.failedChip)}>
                {focusedTab.isFailed ? 'Failed span' : 'Successful span'}
              </span>
            </div>
          </div>

          <div className={styles.detailActions}>
            <Tooltip content="Copy span ID" placement="top">
              <button
                className={styles.iconButton}
                onClick={() => {
                  void navigator.clipboard.writeText(focusedTab.spanId);
                }}
                aria-label="Copy span ID"
              >
                <Icon name="copy" size="xs" />
              </button>
            </Tooltip>

            {enableExploreLinks && onOpenExploreSpan && (
              <Tooltip content="Open selected span in Explore" placement="top">
                <button
                  className={styles.iconButton}
                  onClick={() => onOpenExploreSpan(focusedTab.spanId)}
                  aria-label="Open selected span in Explore"
                >
                  <Icon name="compass" size="xs" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {showAttributes && sortedAttributes.length > 0 && (
          <div className={styles.attrs}>
            {sortedAttributes.map(([key, value]) => (
              <span key={key} className={styles.attr}>
                {key}={String(value)}
              </span>
            ))}
          </div>
        )}

        <div className={styles.logs}>
          {focusedTab.logs.length === 0 && <div className={styles.emptyLogs}>No correlated logs for this span.</div>}

          {focusedTab.logs.map((log, index) => (
            <div className={styles.logRow} key={`${focusedTab.spanId}-${index}`}>
              <div className={styles.meta}>
                <span className={styles.time}>{relativeLogTime(log.timestamp, focusedTab.span.startTime)}</span>
                <span className={cx(styles.level, levelClass(log.level, styles))}>{log.level ?? 'info'}</span>
              </div>
              <span className={styles.message}>{log.line}</span>
              <div className={styles.logActions}>
                <Tooltip content="Copy log line" placement="top">
                  <button
                    className={styles.iconButton}
                    onClick={() => {
                      void navigator.clipboard.writeText(log.line);
                    }}
                    aria-label="Copy log"
                  >
                    <Icon name="copy" size="xs" />
                  </button>
                </Tooltip>

                {enableExploreLinks && onOpenExploreLog && (
                  <Tooltip content="Open log context in Explore" placement="top">
                    <button
                      className={styles.iconButton}
                      onClick={() => onOpenExploreLog(focusedTab.spanId, log)}
                      aria-label="Open log context in Explore"
                    >
                      <Icon name="compass" size="xs" />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
