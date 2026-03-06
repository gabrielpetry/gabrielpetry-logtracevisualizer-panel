import { Icon, useStyles2, useTheme2 } from '@grafana/ui';
import React, { useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { parseLogData, parseTraceData } from '../utils/traceUtils';

import { PanelProps } from '@grafana/data';
import { SimpleOptions } from '../types';
import { TraceTimeline } from './TraceTimeline';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = () => {
  return {
    wrapper: css`
      position: relative;
      overflow: hidden;
    `,
    emptyState: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 12px;
      padding: 24px;
      text-align: center;
    `,
    emptyIcon: css`
      opacity: 0.4;
    `,
    emptyTitle: css`
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    `,
    emptyDescription: css`
      font-size: 13px;
      opacity: 0.75;
      max-width: 460px;
      line-height: 1.5;
      margin: 0;
    `,
  };
};

export const SimplePanel: React.FC<Props> = ({ options, data, width, height }) => {
  useTheme2();
  const styles = useStyles2(getStyles);

  const durationUnit = options.durationUnit ?? 'auto';
  const lokiTraceIdField = options.lokiTraceIdField ?? 'traceId';
  const lokiSpanIdField = options.lokiSpanIdField ?? 'spanId';
  const liveMode = options.liveMode ?? false;
  const liveRefreshMs = Math.min(60000, Math.max(1000, Number(options.liveRefreshMs ?? 5000)));

  const { trace, logs } = useMemo(() => {
    const parsedTrace = parseTraceData(data.series, durationUnit);
    const parsedLogs = parseLogData(data.series, {
      lokiTraceIdField,
      lokiSpanIdField,
    });

    return {
      trace: parsedTrace,
      logs: parsedLogs,
    };
  }, [data.series, durationUnit, lokiTraceIdField, lokiSpanIdField]);

  if (!trace) {
    return (
      <div className={cx(styles.wrapper, styles.emptyState)} style={{ width, height }}>
        <Icon name="gf-traces" size="xxxl" className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>No trace data available</h3>
        <p className={styles.emptyDescription}>
          This panel expects Tempo trace data and optionally Loki logs for correlation. Add a trace query,
          then include logs with trace/span IDs to unlock the full view.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} style={{ width, height }}>
      <TraceTimeline
        key={`${trace.traceId}:${options.defaultSpanFilter ?? 'all'}:${options.defaultLogLevel ?? 'all'}:${liveMode}:${liveRefreshMs}`}
        trace={trace}
        logs={logs}
        width={width}
        height={height}
        defaultSpanFilter={options.defaultSpanFilter ?? 'all'}
        defaultLogLevel={options.defaultLogLevel ?? 'all'}
        showServiceLegend={options.showServiceLegend ?? true}
        enableExploreLinks={options.enableExploreLinks ?? true}
        liveMode={liveMode}
        liveRefreshMs={liveRefreshMs}
        dataState={data.state}
      />
    </div>
  );
};
