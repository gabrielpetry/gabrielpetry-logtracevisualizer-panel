import { Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { formatDuration, getServiceColor } from '../utils/traceUtils';

import { GrafanaTheme2 } from '@grafana/data';
import { LogsPanel } from './LogsPanel';
import React from 'react';
import { SpanWithLogs } from '../types';

interface SpanRowProps {
  span: SpanWithLogs;
  traceStart: number;
  traceDuration: number;
  isExpanded: boolean;
  onToggle: () => void;
  timelineWidth: number;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
    transition: all 0.15s ease;

    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `,
  expanded: css`
    background: ${theme.colors.background.secondary};
  `,
  row: css`
    display: flex;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    min-height: 44px;
  `,
  expandIcon: css`
    width: 20px;
    display: flex;
    justify-content: center;
    color: ${theme.colors.text.secondary};
    transition: transform 0.15s ease;
    flex-shrink: 0;
  `,
  expandIconRotated: css`
    transform: rotate(90deg);
  `,
  indent: css`
    flex-shrink: 0;
  `,
  serviceIndicator: css`
    width: 4px;
    height: 28px;
    border-radius: 2px;
    margin-right: 12px;
    flex-shrink: 0;
  `,
  details: css`
    flex: 1;
    min-width: 200px;
    overflow: hidden;
    margin-right: 12px;
  `,
  serviceName: css`
    font-size: 11px;
    color: ${theme.colors.text.secondary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
  `,
  logCount: css`
    background: ${theme.colors.primary.main}20;
    color: ${theme.colors.primary.text};
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 500;
  `,
  operationName: css`
    font-size: 13px;
    font-weight: 500;
    color: ${theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  timeline: css`
    flex: 2;
    position: relative;
    height: 20px;
    background: ${theme.colors.background.primary};
    border-radius: 4px;
    overflow: hidden;
  `,
  timelineBar: css`
    position: absolute;
    height: 100%;
    border-radius: 4px;
    min-width: 3px;
    transition: all 0.2s ease;

    &:hover {
      filter: brightness(1.15);
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
    }
  `,
  duration: css`
    width: 80px;
    text-align: right;
    font-size: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: ${theme.colors.text.secondary};
    flex-shrink: 0;
    margin-left: 12px;
  `,
  tags: css`
    display: flex;
    gap: 4px;
    margin-left: 12px;
    flex-wrap: wrap;
    max-width: 150px;
  `,
  tag: css`
    padding: 2px 6px;
    background: ${theme.colors.background.canvas};
    border-radius: 3px;
    font-size: 10px;
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
  `,
  tagError: css`
    background: ${theme.colors.error.main}20;
    color: ${theme.colors.error.text};
  `,
});

export const SpanRow: React.FC<SpanRowProps> = ({
  span,
  traceStart,
  traceDuration,
  isExpanded,
  onToggle,
  timelineWidth,
}) => {
  useTheme2();
  const styles = useStyles2(getStyles);
  const serviceColor = getServiceColor(span.serviceName);

  // Calculate timeline bar position and width
  const offsetPercent = ((span.startTime - traceStart) / traceDuration) * 100;
  const widthPercent = (span.duration / traceDuration) * 100;

  const depth = span.depth || 0;
  const indentPx = depth * 24;
  const hasLogs = span.logs && span.logs.length > 0;

  // Check for error tags
  const statusCode = Number(span.tags['http.status_code']);
  const hasError =
    span.tags['error'] === true ||
    (statusCode && statusCode >= 400) ||
    span.tags['otel.status_code'] === 'ERROR';

  return (
    <div className={cx(styles.container, isExpanded && styles.expanded)}>
      <div className={styles.row} onClick={onToggle}>
        {/* Expand Icon */}
        <div className={cx(styles.expandIcon, isExpanded && styles.expandIconRotated)}>
          {hasLogs ? <Icon name="angle-right" size="md" /> : <span style={{ width: 16 }} />}
        </div>

        {/* Indentation based on depth */}
        <div className={styles.indent} style={{ width: indentPx }} />

        {/* Service color indicator */}
        <div className={styles.serviceIndicator} style={{ background: serviceColor }} />

        {/* Service and Operation details */}
        <div className={styles.details}>
          <div className={styles.serviceName}>
            {span.serviceName}
            {hasLogs && <span className={styles.logCount}>{span.logs.length} logs</span>}
          </div>
          <Tooltip content={span.operationName} placement="top">
            <div className={styles.operationName}>{span.operationName}</div>
          </Tooltip>
        </div>

        {/* Timeline visualization */}
        <div className={styles.timeline} style={{ width: timelineWidth }}>
          <Tooltip
            content={
              <div>
                <div>
                  <strong>{span.operationName}</strong>
                </div>
                <div>Duration: {formatDuration(span.duration)}</div>
                <div>Service: {span.serviceName}</div>
              </div>
            }
          >
            <div
              className={styles.timelineBar}
              style={{
                left: `${offsetPercent}%`,
                width: `${Math.max(widthPercent, 0.5)}%`,
                background: `linear-gradient(135deg, ${serviceColor} 0%, ${serviceColor}CC 100%)`,
              }}
            />
          </Tooltip>
        </div>

        {/* Duration */}
        <div className={styles.duration}>{formatDuration(span.duration)}</div>

        {/* Tags */}
        <div className={styles.tags}>
          {hasError && <span className={cx(styles.tag, styles.tagError)}>error</span>}
          {span.tags['http.method'] && <span className={styles.tag}>{String(span.tags['http.method'])}</span>}
          {span.tags['http.status_code'] && (
            <span className={cx(styles.tag, statusCode >= 400 && styles.tagError)}>
              {String(span.tags['http.status_code'])}
            </span>
          )}
        </div>
      </div>

      {/* Expanded logs panel */}
      {isExpanded && hasLogs && <LogsPanel logs={span.logs} spanStartTime={span.startTime} />}
    </div>
  );
};
