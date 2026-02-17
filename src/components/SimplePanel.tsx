import { Icon, useStyles2, useTheme2 } from '@grafana/ui';
import React, { useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { parseLogData, parseTraceData } from '../utils/traceUtils';

import { PanelProps } from '@grafana/data';
import { SimpleOptions } from 'types';
import { TraceTimeline } from './TraceTimeline';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = () => {
  return {
    wrapper: css`
      position: relative;
      overflow: hidden;
    `,
    loading: css`
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      flex-direction: column;
      gap: 16px;
    `,
    emptyState: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
      padding: 24px;
      text-align: center;
    `,
    emptyIcon: css`
      opacity: 0.4;
    `,
    emptyTitle: css`
      font-size: 18px;
      font-weight: 500;
      margin: 0;
    `,
    emptyDescription: css`
      font-size: 13px;
      opacity: 0.7;
      max-width: 400px;
      line-height: 1.5;
    `,
  };
};

export const SimplePanel: React.FC<Props> = ({ options, data, width, height }) => {
  useTheme2();
  const styles = useStyles2(getStyles);

  // Try to parse trace and log data from the data frames
  const { trace, logs } = useMemo(() => {
    console.log('SimplePanel: Processing', data.series.length, 'data frames');
    // Attempt to parse real trace data from Tempo
    const parsedTrace = parseTraceData(data.series, options.durationUnit);
    // Attempt to parse real log data from Loki
    const parsedLogs = parseLogData(data.series, {
      lokiTraceIdField: options.lokiTraceIdField,
      lokiSpanIdField: options.lokiSpanIdField,
    });

    console.log('SimplePanel: parsedTrace', parsedTrace ? 'found' : 'not found');
    console.log('SimplePanel: parsedLogs count:', parsedLogs.length);

    // Return the parsed data (or null if no trace found)
    return {
      trace: parsedTrace,
      logs: parsedLogs,
    };
  }, [data.series, options.lokiTraceIdField, options.lokiSpanIdField, options.durationUnit]);

  // Show empty state if there's no data and no demo mode available
  if (!trace) {
    return (
      <div className={cx(styles.wrapper, styles.emptyState)} style={{ width, height }}>
        <Icon name="gf-traces" size="xxxl" className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>No trace data available</h3>
        <p className={styles.emptyDescription}>
          Configure a Tempo datasource query to visualize traces, and optionally add a Loki query to
          see correlated logs for each span.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} style={{ width, height }}>
      <TraceTimeline
        trace={trace}
        logs={logs}
        width={width}
        height={height}
        showServiceColors={options.showServiceColors}
        showDuration={options.showDuration}
        collapsedByDefault={options.collapsedByDefault}
        colorizeByLogLevel={options.colorizeByLogLevel}
        errorColor={options.errorColor}
        warningColor={options.warningColor}
        infoColor={options.infoColor}
        debugColor={options.debugColor}
      />
    </div>
  );
};
