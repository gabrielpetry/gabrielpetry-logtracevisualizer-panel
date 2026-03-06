import {
  buildFailureNavigationIndex,
  buildTraceTree,
  clampWindow,
  isSpanFailed,
  matchLogsToSpans,
  parseLogData,
  panWindow,
  zoomWindow,
} from './traceUtils';
import { DataFrame } from '@grafana/data';
import { LogLine, Span } from '../types';

describe('traceUtils', () => {
  test('isSpanFailed detects failures from tags and logs', () => {
    const failedByTag = isSpanFailed({
      tags: {
        'http.status_code': 500,
      },
      logs: [],
    });

    const failedByLog = isSpanFailed({
      tags: {},
      logs: [
        {
          timestamp: 10,
          line: 'Unhandled exception in worker',
          labels: {},
          level: 'info',
        },
      ],
    });

    const healthy = isSpanFailed({
      tags: {
        'http.status_code': 200,
      },
      logs: [
        {
          timestamp: 11,
          line: 'request completed',
          labels: {},
          level: 'info',
        },
      ],
    });

    expect(failedByTag).toBe(true);
    expect(failedByLog).toBe(true);
    expect(healthy).toBe(false);
  });

  test('matchLogsToSpans matches by span id and by trace/time fallback', () => {
    const spans: Span[] = [
      {
        traceId: 't1',
        spanId: 'root',
        operationName: 'root',
        serviceName: 'svc',
        startTime: 1_000_000,
        duration: 10_000,
        tags: {},
      },
      {
        traceId: 't1',
        spanId: 'child-a',
        parentSpanId: 'root',
        operationName: 'child-a',
        serviceName: 'svc-a',
        startTime: 1_001_000,
        duration: 2_000,
        tags: {},
      },
      {
        traceId: 't1',
        spanId: 'child-b',
        parentSpanId: 'root',
        operationName: 'child-b',
        serviceName: 'svc-b',
        startTime: 1_008_000,
        duration: 1_000,
        tags: {},
      },
    ];

    const trace = buildTraceTree(spans);
    const logs: LogLine[] = [
      {
        timestamp: 1_001_500_000,
        line: 'direct span-id log',
        labels: {},
        level: 'info',
        traceId: 't1',
        spanId: 'child-a',
      },
      {
        timestamp: 1_002_000_000,
        line: 'trace-only fallback log',
        labels: {},
        level: 'warn',
        traceId: 't1',
      },
      {
        timestamp: 1_008_500_000,
        line: 'different trace',
        labels: {},
        level: 'info',
        traceId: 't2',
      },
    ];

    const spansWithLogs = matchLogsToSpans(trace, logs);
    const byId = new Map(spansWithLogs.map((span) => [span.spanId, span]));

    expect(byId.get('child-a')?.logs.length).toBe(2);
    expect(byId.get('child-b')?.logs.length).toBe(0);
    expect(byId.get('root')?.logs.length).toBe(1);
  });

  test('window helpers clamp/zoom/pan deterministically', () => {
    const clamped = clampWindow({ start: 0.95, end: 0.96 }, 0.2);
    expect(clamped.end - clamped.start).toBeCloseTo(0.2, 6);
    expect(clamped.start).toBeGreaterThanOrEqual(0);
    expect(clamped.end).toBeLessThanOrEqual(1);

    const zoomed = zoomWindow({ start: 0, end: 1 }, 0.5, 0.5);
    expect(Number((zoomed.end - zoomed.start).toFixed(2))).toBe(0.5);

    const panned = panWindow({ start: 0, end: 0.5 }, 0.1);
    expect(Number(panned.start.toFixed(2))).toBe(0.1);
    expect(Number(panned.end.toFixed(2))).toBe(0.6);

    const pannedAtBoundary = panWindow({ start: 0.8, end: 1 }, 0.2);
    expect(Number(pannedAtBoundary.start.toFixed(2))).toBe(0.8);
    expect(Number(pannedAtBoundary.end.toFixed(2))).toBe(1);
  });

  test('buildFailureNavigationIndex computes cursor and bounds', () => {
    const nav = buildFailureNavigationIndex(['a', 'b', 'c'], 'b');
    expect(nav.currentIndex).toBe(1);
    expect(nav.hasPrevious).toBe(true);
    expect(nav.hasNext).toBe(true);
  });

  test('parseLogData infers levels from label variants', () => {
    const frame = {
      length: 3,
      fields: [
        {
          name: 'ts',
          type: 'time',
          values: [1000, 2000, 3000],
        },
        {
          name: 'line',
          type: 'string',
          values: ['one', 'two', 'three'],
        },
        {
          name: 'labels',
          type: 'other',
          values: [
            { severity_text: 'WARN', trace_id: 't1', span_id: 's1' },
            { detectedLevel: 'ERROR', traceId: 't1', spanId: 's2' },
            { 'otel.severity_number': '5', traceid: 't1', spanid: 's3' },
          ],
        },
      ],
    } as unknown as DataFrame;

    const logs = parseLogData([frame]);

    expect(logs).toHaveLength(3);
    expect(logs[0].level).toBe('warn');
    expect(logs[1].level).toBe('error');
    expect(logs[2].level).toBe('debug');
    expect(logs[0].traceId).toBe('t1');
    expect(logs[0].spanId).toBe('s1');
  });
});
