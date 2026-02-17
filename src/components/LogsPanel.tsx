import { Icon, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import React, { useState } from 'react';
import { css, cx, keyframes } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { LogLine } from '../types';

interface LogsPanelProps {
  logs: LogLine[];
  spanStartTime: number;
}

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-8px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 500px;
  }
`;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    background: linear-gradient(180deg, ${theme.colors.background.canvas} 0%, ${theme.colors.background.primary} 100%);
    border-top: 1px solid ${theme.colors.border.weak};
    padding: 12px 16px 12px 72px;
    animation: ${slideIn} 0.2s ease-out;
    overflow: hidden;
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed ${theme.colors.border.weak};
  `,
  title: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: ${theme.colors.text.secondary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,
  titleIcon: css`
    color: ${theme.colors.primary.main};
  `,
  controls: css`
    display: flex;
    gap: 4px;
  `,
  logsContainer: css`
    max-height: 300px;
    overflow-y: auto;
    border-radius: 6px;
    background: ${theme.colors.background.canvas};
    border: 1px solid ${theme.colors.border.weak};

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: ${theme.colors.background.secondary};
    }

    &::-webkit-scrollbar-thumb {
      background: ${theme.colors.border.medium};
      border-radius: 3px;
    }
  `,
  logLine: css`
    display: flex;
    align-items: flex-start;
    padding: 6px 12px;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    border-bottom: 1px solid ${theme.colors.border.weak};
    transition: background 0.1s ease;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `,
  timestamp: css`
    color: ${theme.colors.text.disabled};
    margin-right: 12px;
    flex-shrink: 0;
    font-size: 11px;
    min-width: 90px;
  `,
  levelBadge: css`
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    margin-right: 12px;
    flex-shrink: 0;
    min-width: 50px;
    text-align: center;
  `,
  levelInfo: css`
    background: ${theme.colors.info.main}25;
    color: ${theme.colors.info.text};
  `,
  levelDebug: css`
    background: ${theme.colors.secondary.main}25;
    color: ${theme.colors.text.secondary};
  `,
  levelWarn: css`
    background: ${theme.colors.warning.main}25;
    color: ${theme.colors.warning.text};
  `,
  levelError: css`
    background: ${theme.colors.error.main}25;
    color: ${theme.colors.error.text};
  `,
  levelTrace: css`
    background: ${theme.colors.secondary.main}15;
    color: ${theme.colors.text.disabled};
  `,
  message: css`
    color: ${theme.colors.text.primary};
    word-break: break-word;
    flex: 1;
    white-space: pre-wrap;
  `,
  messageError: css`
    color: ${theme.colors.error.text};
  `,
  noLogs: css`
    padding: 24px;
    text-align: center;
    color: ${theme.colors.text.disabled};
    font-style: italic;
  `,
  expandedLine: css`
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: ${theme.colors.background.secondary};
  `,
  expandedMeta: css`
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  `,
  metaItem: css`
    font-size: 11px;
    color: ${theme.colors.text.secondary};
  `,
  metaLabel: css`
    color: ${theme.colors.text.disabled};
    margin-right: 4px;
  `,
  labels: css`
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 4px;
  `,
  label: css`
    padding: 2px 6px;
    background: ${theme.colors.primary.main}15;
    border-radius: 3px;
    font-size: 10px;
    color: ${theme.colors.primary.text};
  `,
});

export const LogsPanel: React.FC<LogsPanelProps> = ({ logs, spanStartTime }) => {
  useTheme2();
  const styles = useStyles2(getStyles);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  const formatTimestamp = (timestamp: number): string => {
    // Convert from nanoseconds to milliseconds
    const date = new Date(timestamp / 1000000);
    return date.toISOString().split('T')[1].replace('Z', '').slice(0, 12);
  };

  const getRelativeTime = (timestamp: number): string => {
    // Calculate relative time from span start (both in same units)
    const diffNs = timestamp - spanStartTime * 1000;
    const diffMs = diffNs / 1000000;
    if (diffMs < 0) {
      return `-${Math.abs(diffMs).toFixed(2)}ms`;
    }
    return `+${diffMs.toFixed(2)}ms`;
  };

  const getLevelStyle = (level?: LogLine['level']) => {
    switch (level) {
      case 'error':
        return styles.levelError;
      case 'warn':
        return styles.levelWarn;
      case 'debug':
        return styles.levelDebug;
      case 'trace':
        return styles.levelTrace;
      default:
        return styles.levelInfo;
    }
  };

  if (logs.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noLogs}>No logs found for this span</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <Icon name="document-info" size="sm" className={styles.titleIcon} />
          Related Logs ({logs.length})
        </div>
        <div className={styles.controls}>
          <IconButton
            name={showLabels ? 'eye' : 'eye-slash'}
            size="sm"
            tooltip={showLabels ? 'Hide labels' : 'Show labels'}
            onClick={() => setShowLabels(!showLabels)}
          />
        </div>
      </div>

      <div className={styles.logsContainer}>
        {logs.map((log, index) => (
          <div
            key={index}
            className={cx(styles.logLine, expandedLog === index && styles.expandedLine)}
            onClick={() => setExpandedLog(expandedLog === index ? null : index)}
          >
            {expandedLog === index ? (
              <>
                <div className={styles.expandedMeta}>
                  <span className={styles.metaItem}>
                    <span className={styles.metaLabel}>Time:</span>
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span className={styles.metaItem}>
                    <span className={styles.metaLabel}>Relative:</span>
                    {getRelativeTime(log.timestamp)}
                  </span>
                  <span className={cx(styles.levelBadge, getLevelStyle(log.level))}>{log.level || 'info'}</span>
                </div>
                <div className={cx(styles.message, log.level === 'error' && styles.messageError)}>{log.line}</div>
                {showLabels && Object.keys(log.labels).length > 0 && (
                  <div className={styles.labels}>
                    {Object.entries(log.labels).map(([key, value]) => (
                      <span key={key} className={styles.label}>
                        {key}={value}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <span className={styles.timestamp}>{getRelativeTime(log.timestamp)}</span>
                <span className={cx(styles.levelBadge, getLevelStyle(log.level))}>{log.level || 'info'}</span>
                <span className={cx(styles.message, log.level === 'error' && styles.messageError)}>{log.line}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
