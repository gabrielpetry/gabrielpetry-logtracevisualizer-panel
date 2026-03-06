import { Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import React from 'react';
import { css, cx } from '@emotion/css';
import { formatDuration, getServiceColor } from '../utils/traceUtils';

import { GrafanaTheme2 } from '@grafana/data';
import { LogLine, TraceViewSpan } from '../types';

interface SpanRowProps {
  span: TraceViewSpan;
  isExpanded: boolean;
  isActive: boolean;
  onToggleExpand: () => void;
  onFocus: () => void;
  enableExploreLinks?: boolean;
  onOpenExploreSpan?: () => void;
  onOpenExploreLog?: (log: LogLine) => void;
}

const TREE_INDENT_STEP = 24;
const TREE_GUTTER_BASE = 24;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
  row: css`
    display: grid;
    grid-template-columns: minmax(240px, 36%) minmax(0, 1fr) minmax(92px, auto);
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;

    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `,
  spanCell: css`
    display: flex;
    align-items: stretch;
    min-width: 0;
  `,
  treeGutter: css`
    position: relative;
    height: auto;
    min-height: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
    padding-right: 4px;
  `,
  treeGuides: css`
    position: absolute;
    inset: 0;
    pointer-events: none;
  `,
  treeGuideLine: css`
    position: absolute;
    top: -8px;
    bottom: -8px;
    width: 1px;
    background: ${theme.colors.border.weak};
  `,
  treeGuideBranch: css`
    position: absolute;
    top: 50%;
    border-top: 1px solid ${theme.colors.border.medium};
    transform: translateY(-50%);
  `,
  rowActive: css`
    background: ${theme.colors.primary.main}14;
    box-shadow: inset 2px 0 0 ${theme.colors.primary.main};
  `,
  rowFailed: css`
    box-shadow: inset 2px 0 0 ${theme.colors.error.main};
  `,
  expandButton: css`
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: ${theme.colors.text.secondary};
    cursor: pointer;

    &:hover {
      background: ${theme.colors.background.canvas};
      color: ${theme.colors.text.primary};
    }
  `,
  expandPlaceholder: css`
    width: 20px;
    height: 20px;
    display: inline-block;
  `,
  details: css`
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    overflow: hidden;
    min-width: 0;
  `,
  serviceLine: css`
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  `,
  serviceDot: css`
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  `,
  serviceName: css`
    font-size: 11px;
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  operationName: css`
    font-size: 13px;
    color: ${theme.colors.text.primary};
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  badges: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    flex-shrink: 0;
  `,
  badge: css`
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 999px;
    line-height: 1.3;
    font-weight: 600;
  `,
  badgeFailed: css`
    color: ${theme.colors.error.text};
    background: ${theme.colors.error.main}24;
  `,
  badgeLogs: css`
    color: ${theme.colors.primary.text};
    background: ${theme.colors.primary.main}20;
  `,
  timeline: css`
    position: relative;
    min-width: 0;
    height: 16px;
    border-radius: 4px;
    background: ${theme.colors.background.canvas};
    border: 1px solid ${theme.colors.border.weak};
    overflow: hidden;
  `,
  timelineBar: css`
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 3px;
    min-width: 2px;
  `,
  timelineBarFailed: css`
    box-shadow: 0 0 0 1px ${theme.colors.error.main}66;
  `,
  timelineOut: css`
    color: ${theme.colors.text.disabled};
    font-size: 10px;
    text-align: center;
  `,
  duration: css`
    font-size: 12px;
    color: ${theme.colors.text.secondary};
    text-align: right;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  `,
  exploreButton: css`
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
  expandedArea: css`
    border-top: 1px dashed ${theme.colors.border.weak};
    background: ${theme.colors.background.secondary};
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  sectionTitle: css`
    font-size: 10px;
    color: ${theme.colors.text.secondary};
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-weight: 700;
  `,
  attributes: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
  attrPill: css`
    font-size: 10px;
    color: ${theme.colors.text.secondary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 999px;
    padding: 2px 8px;
    background: ${theme.colors.background.primary};
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  `,
  logs: css`
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 6px;
    background: ${theme.colors.background.primary};
    overflow: hidden;
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
    padding: 6px 8px;
    font-size: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;

    &:hover {
      background: ${theme.colors.background.canvas};
    }

    &:last-child {
      border-bottom: none;
    }
  `,
  logMeta: css`
    grid-area: meta;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
  `,
  logTime: css`
    color: ${theme.colors.text.disabled};
    font-size: 11px;
  `,
  logLevel: css`
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
  logMessage: css`
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
  noData: css`
    font-size: 12px;
    color: ${theme.colors.text.disabled};
    font-style: italic;
    padding: 2px 0;
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

export const SpanRow: React.FC<SpanRowProps> = ({
  span,
  isExpanded,
  isActive,
  onToggleExpand,
  onFocus,
  enableExploreLinks = true,
  onOpenExploreSpan,
  onOpenExploreLog,
}) => {
  useTheme2();
  const styles = useStyles2(getStyles);

  const depth = span.depth ?? 0;
  const hasChildren = (span.children?.length ?? 0) > 0;
  const hasAttrs = Object.keys(span.tags).length > 0;
  const hasLogs = span.logs.length > 0;
  const hasExpandableContent = hasChildren || hasAttrs || hasLogs;

  const indentPx = depth * TREE_INDENT_STEP;
  const treeGutterWidth = TREE_GUTTER_BASE + indentPx;
  const branchStart = depth > 0 ? (depth - 1) * TREE_INDENT_STEP + TREE_GUTTER_BASE / 2 : 0;
  const branchWidth = depth > 0 ? Math.max(10, treeGutterWidth - branchStart - 12) : 0;
  const detailIndentPx = depth > 0 ? 6 : 0;
  const expandedPaddingLeft = Math.min(28 + indentPx, 220);
  const serviceColor = getServiceColor(span.serviceName);
  const barColor = span.isFailed ? '#F2495C' : serviceColor;
  const visibleWidth = Math.max((span.visibleEnd - span.visibleStart) * 100, 0.8);
  const sortedAttributes = Object.entries(span.tags).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className={styles.container} data-testid="trace-span-row" data-span-id={span.spanId} data-depth={depth}>
      <div
        className={cx(styles.row, isActive && styles.rowActive, span.isFailed && styles.rowFailed)}
        onClick={() => {
          onFocus();
          if (hasExpandableContent) {
            onToggleExpand();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onFocus();
            if (hasExpandableContent) {
              onToggleExpand();
            }
          }
        }}
        role="button"
        tabIndex={0}
        aria-level={depth + 1}
      >
        <div className={styles.spanCell}>
          <div className={styles.treeGutter} style={{ width: `${treeGutterWidth}px` }} aria-hidden="true">
            {depth > 0 && (
              <div className={styles.treeGuides}>
                {Array.from({ length: depth }).map((_, level) => (
                  <span
                    key={`${span.spanId}-guide-${level}`}
                    className={styles.treeGuideLine}
                    style={{ left: `${TREE_GUTTER_BASE / 2 + level * TREE_INDENT_STEP}px` }}
                  />
                ))}
                <span
                  className={styles.treeGuideBranch}
                  style={{
                    left: `${branchStart}px`,
                    width: `${branchWidth}px`,
                  }}
                />
              </div>
            )}

            {hasExpandableContent ? (
              <button
                className={styles.expandButton}
                onClick={(event) => {
                  event.stopPropagation();
                  onFocus();
                  onToggleExpand();
                }}
                aria-label={isExpanded ? 'Collapse span' : 'Expand span'}
              >
                <Icon name={isExpanded ? 'angle-down' : 'angle-right'} size="sm" />
              </button>
            ) : (
              <div className={styles.expandPlaceholder} />
            )}
          </div>

          <div className={styles.details} style={{ paddingLeft: `${detailIndentPx}px` }}>
            <div className={styles.serviceLine}>
              <span className={styles.serviceDot} style={{ background: serviceColor }} />
              <span className={styles.serviceName}>{span.serviceName}</span>
              <div className={styles.badges}>
                {span.isFailed && <span className={cx(styles.badge, styles.badgeFailed)}>FAILED</span>}
                {hasLogs && <span className={cx(styles.badge, styles.badgeLogs)}>{span.logs.length} LOGS</span>}
              </div>
            </div>

            <Tooltip content={span.operationName} placement="top">
              <span className={styles.operationName}>{span.operationName}</span>
            </Tooltip>
          </div>
        </div>

        <div className={styles.timeline}>
          {span.isVisibleInWindow ? (
            <div
              className={cx(styles.timelineBar, span.isFailed && styles.timelineBarFailed)}
              style={{
                left: `${span.visibleStart * 100}%`,
                width: `${visibleWidth}%`,
                background: barColor,
              }}
            />
          ) : (
            <div className={styles.timelineOut}>out of view</div>
          )}
        </div>

        <div className={styles.duration}>
          <span>{formatDuration(span.duration)}</span>
          {enableExploreLinks && onOpenExploreSpan && (
            <Tooltip content="Open span context in Explore" placement="top">
              <button
                className={styles.exploreButton}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenExploreSpan();
                }}
                aria-label="Open span in Explore"
              >
                <Icon name="compass" size="xs" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {isExpanded && (
        <div
          className={styles.expandedArea}
          style={{ paddingLeft: `${expandedPaddingLeft}px` }}
          data-testid="trace-span-details"
          data-span-id={span.spanId}
        >
          <div>
            <div className={styles.sectionTitle}>Attributes</div>
            {sortedAttributes.length > 0 ? (
              <div className={styles.attributes}>
                {sortedAttributes.map(([key, value]) => (
                  <span key={key} className={styles.attrPill}>
                    {key}={String(value)}
                  </span>
                ))}
              </div>
            ) : (
              <div className={styles.noData}>No attributes on this span.</div>
            )}
          </div>

          <div>
            <div className={styles.sectionTitle}>Logs</div>
            {hasLogs ? (
              <div className={styles.logs}>
                {span.logs.map((log, index) => (
                  <div className={styles.logRow} key={`${span.spanId}-${index}`} data-testid="trace-span-log-row">
                    <div className={styles.logMeta}>
                      <span className={styles.logTime}>{relativeLogTime(log.timestamp, span.startTime)}</span>
                      <span className={cx(styles.logLevel, levelClass(log.level, styles))}>{log.level ?? 'info'}</span>
                    </div>
                    <span className={styles.logMessage}>{log.line}</span>
                    <div className={styles.logActions}>
                      <button
                        className={styles.exploreButton}
                        onClick={() => {
                          void navigator.clipboard.writeText(log.line);
                        }}
                        aria-label="Copy log line"
                      >
                        <Icon name="copy" size="xs" />
                      </button>
                      {enableExploreLinks && onOpenExploreLog && (
                        <button
                          className={styles.exploreButton}
                          onClick={() => onOpenExploreLog(log)}
                          aria-label="Open log in Explore"
                        >
                          <Icon name="compass" size="xs" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noData}>No correlated logs for this span.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
