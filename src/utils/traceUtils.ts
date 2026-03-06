import { DataFrame, Field } from '@grafana/data';
import {
  FailureNavigationIndex,
  LogLevel,
  LogLevelFilter,
  LogLine,
  LogSeverity,
  SelectedSpanTab,
  Span,
  SpanWithLogs,
  Trace,
  TraceViewSpan,
  TraceWindow,
} from '../types';

const SERVICE_COLORS = [
  '#5B8FF9',
  '#5AD8A6',
  '#F6BD16',
  '#E8684A',
  '#6DC8EC',
  '#9270CA',
  '#FF9D4D',
  '#269A99',
  '#FF99C3',
  '#7A7A7A',
];

const serviceColorMap = new Map<string, string>();

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

export function getServiceColor(serviceName: string): string {
  if (serviceColorMap.has(serviceName)) {
    return serviceColorMap.get(serviceName)!;
  }

  const color = SERVICE_COLORS[serviceColorMap.size % SERVICE_COLORS.length];
  serviceColorMap.set(serviceName, color);
  return color;
}

export function getLogLevelRank(level?: LogLevel | string): number {
  const normalized = (level ?? 'info').toString().toLowerCase();

  if (normalized === 'error') {
    return LOG_LEVEL_RANK.error;
  }

  if (normalized === 'warn' || normalized === 'warning') {
    return LOG_LEVEL_RANK.warn;
  }

  if (normalized === 'debug') {
    return LOG_LEVEL_RANK.debug;
  }

  if (normalized === 'trace') {
    return LOG_LEVEL_RANK.trace;
  }

  return LOG_LEVEL_RANK.info;
}

export function getLogSeverity(logs: LogLine[]): LogSeverity {
  if (logs.length === 0) {
    return 'none';
  }

  let maxRank = -1;
  for (const log of logs) {
    maxRank = Math.max(maxRank, getLogLevelRank(log.level));

    const message = log.line.toLowerCase();
    if (
      message.includes('error') ||
      message.includes('exception') ||
      message.includes('critical') ||
      message.includes('fatal') ||
      message.includes('failed')
    ) {
      return 'error';
    }
  }

  if (maxRank >= LOG_LEVEL_RANK.error) {
    return 'error';
  }

  if (maxRank >= LOG_LEVEL_RANK.warn) {
    return 'warning';
  }

  if (maxRank >= LOG_LEVEL_RANK.info) {
    return 'info';
  }

  return 'debug';
}

function inferErrorFromTags(tags: Record<string, string | number | boolean>): boolean {
  const statusKeys = Object.keys(tags).filter((key) => {
    const normalized = key.toLowerCase();
    return (
      normalized.includes('status') ||
      normalized.includes('status_code') ||
      normalized.includes('status.code')
    );
  });

  for (const key of statusKeys) {
    const value = tags[key];

    if (typeof value === 'number' && value >= 400) {
      return true;
    }

    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      const numeric = Number(value);

      if (
        (Number.isFinite(numeric) && numeric >= 400) ||
        normalized.includes('error') ||
        normalized.includes('fail') ||
        normalized.includes('exception') ||
        normalized.includes('critical')
      ) {
        return true;
      }
    }
  }

  for (const key of Object.keys(tags)) {
    const normalizedKey = key.toLowerCase();
    const value = tags[key];

    if (normalizedKey.includes('error') || normalizedKey.includes('err')) {
      if (value === true) {
        return true;
      }

      if (typeof value === 'string' && value.toLowerCase() === 'true') {
        return true;
      }

      if (typeof value === 'string' && value.toLowerCase().includes('error')) {
        return true;
      }
    }

    if (typeof value === 'string') {
      const normalizedValue = value.toLowerCase();
      if (
        normalizedValue.includes('error') ||
        normalizedValue.includes('fail') ||
        normalizedValue.includes('exception') ||
        normalizedValue.includes('critical')
      ) {
        return true;
      }
    }
  }

  return false;
}

type SpanFailureCandidate = {
  tags: Record<string, string | number | boolean>;
  logs?: Array<
    | LogLine
    | {
        timestamp: number;
        fields: Array<{ key: string; value: string | number | boolean }>;
      }
  >;
};

export function isSpanFailed(span: SpanFailureCandidate): boolean {
  if (!span || !span.tags) {
    return false;
  }

  if (inferErrorFromTags(span.tags)) {
    return true;
  }

  if (!span.logs || span.logs.length === 0) {
    return false;
  }

  for (const log of span.logs) {
    let message = '';
    if ('line' in log && typeof log.line === 'string') {
      message = log.line.toLowerCase();
    } else if ('fields' in log && Array.isArray(log.fields)) {
      message = log.fields
        .map((field) => `${field.key}:${String(field.value)}`)
        .join(' ')
        .toLowerCase();
    }

    if ('level' in log && getLogLevelRank(log.level) >= LOG_LEVEL_RANK.error) {
      return true;
    }

    if (
      message.includes('error') ||
      message.includes('exception') ||
      message.includes('critical') ||
      message.includes('fatal') ||
      message.includes('failed')
    ) {
      return true;
    }
  }

  return false;
}

function parseLogLevel(level?: string): LogLevel {
  if (!level) {
    return 'info';
  }

  const normalized = level.toLowerCase();
  const severityNumber = Number(normalized);

  if (Number.isFinite(severityNumber)) {
    if (severityNumber >= 17) {
      return 'error';
    }

    if (severityNumber >= 13) {
      return 'warn';
    }

    if (severityNumber >= 9) {
      return 'info';
    }

    if (severityNumber >= 5) {
      return 'debug';
    }

    return 'trace';
  }

  if (
    normalized.includes('err') ||
    normalized.includes('fatal') ||
    normalized.includes('critical') ||
    normalized.includes('crit') ||
    normalized === 'panic'
  ) {
    return 'error';
  }

  if (normalized.includes('warn') || normalized.includes('notice')) {
    return 'warn';
  }

  if (normalized.includes('debug')) {
    return 'debug';
  }

  if (normalized.includes('trace') || normalized.includes('verbose')) {
    return 'trace';
  }

  return 'info';
}

function readFieldValue<T>(field: Field, index: number): T | undefined {
  const values = field.values as unknown as ArrayLike<T>;
  return values[index];
}

function getField(frame: DataFrame, names: string[]): Field | undefined {
  return frame.fields.find((field) => {
    const fieldName = field.name?.toLowerCase() ?? '';
    return names.some((name) => fieldName.includes(name.toLowerCase()));
  });
}

function normalizeLabelKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseLabels(labelsValue: unknown): Record<string, string> {
  if (!labelsValue || typeof labelsValue !== 'object') {
    return {};
  }

  const labels: Record<string, string> = {};
  for (const [key, value] of Object.entries(labelsValue as Record<string, unknown>)) {
    if (value === null || value === undefined) {
      continue;
    }
    labels[key] = String(value);
  }
  return labels;
}

function getLabelValue(labels: Record<string, string>, keys: string[]): string | undefined {
  const expected = new Set(keys.map(normalizeLabelKey));

  for (const [key, value] of Object.entries(labels)) {
    if (expected.has(normalizeLabelKey(key))) {
      return value;
    }
  }

  return undefined;
}

function pickPresent(...candidates: unknown[]): unknown {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) {
      continue;
    }

    if (typeof candidate === 'string' && candidate.trim() === '') {
      continue;
    }

    return candidate;
  }

  return undefined;
}

function detectDurationMultiplier(
  startTimeField: Field,
  durationField: Field,
  length: number,
  durationUnit: 'auto' | 'microseconds' | 'milliseconds' | 'seconds'
): number {
  if (durationUnit === 'microseconds') {
    return 1;
  }

  if (durationUnit === 'milliseconds') {
    return 1000;
  }

  if (durationUnit === 'seconds') {
    return 1000000;
  }

  const firstStartTime = Number(readFieldValue(startTimeField, 0));
  if (firstStartTime > 1e16) {
    return 1 / 1000;
  }

  if (firstStartTime > 1e13) {
    return 1;
  }

  if (firstStartTime > 1e10) {
    return 1000;
  }

  const samples: number[] = [];
  for (let i = 0; i < Math.min(length, 50); i++) {
    const value = Number(readFieldValue(durationField, i));
    if (Number.isFinite(value) && value > 0) {
      samples.push(value);
    }
  }

  if (samples.length === 0) {
    return 1;
  }

  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const median = samples.length % 2 === 0 ? (samples[mid - 1] + samples[mid]) / 2 : samples[mid];

  if (median >= 1e9) {
    return 1 / 1000;
  }

  if (median >= 1e6) {
    return 1;
  }

  if (median >= 1e3) {
    return 1000;
  }

  return 1000000;
}

export function parseTraceData(
  frames: DataFrame[],
  durationUnit: 'auto' | 'microseconds' | 'milliseconds' | 'seconds' = 'auto'
): Trace | null {
  const traceFrame = frames.find((frame) => {
    const hasTraceId = frame.fields.some((field) => {
      const name = field.name?.toLowerCase() ?? '';
      return name.includes('traceid') || name.includes('trace_id');
    });

    const hasSpanId = frame.fields.some((field) => {
      const name = field.name?.toLowerCase() ?? '';
      return name.includes('spanid') || name.includes('span_id');
    });

    return hasTraceId && hasSpanId;
  });

  if (!traceFrame) {
    return null;
  }

  const traceIdField = getField(traceFrame, ['traceid', 'trace_id']);
  const spanIdField = getField(traceFrame, ['spanid', 'span_id']);
  const parentSpanIdField = getField(traceFrame, ['parentspanid', 'parent_span_id', 'parentspan']);
  const operationNameField = getField(traceFrame, ['operationname', 'operation_name', 'name']);
  const serviceNameField = getField(traceFrame, ['servicename', 'service_name', 'service']);
  const startTimeField = getField(traceFrame, ['starttime', 'start_time']);
  const durationField = getField(traceFrame, ['duration']);
  const tagsField = getField(traceFrame, ['tags', 'servicetags', 'service_tags', 'attributes']);

  if (!traceIdField || !spanIdField || !startTimeField || !durationField) {
    return null;
  }

  const multiplier = detectDurationMultiplier(startTimeField, durationField, traceFrame.length, durationUnit);

  const spans: Span[] = [];
  for (let i = 0; i < traceFrame.length; i++) {
    const tags: Record<string, string | number | boolean> = {};
    const tagsValue = tagsField ? readFieldValue<unknown>(tagsField, i) : undefined;

    if (Array.isArray(tagsValue)) {
      for (const tag of tagsValue) {
        if (tag && typeof tag === 'object' && 'key' in tag && 'value' in tag) {
          const key = String((tag as { key: unknown }).key);
          const value = (tag as { value: string | number | boolean }).value;
          tags[key] = value;
        }
      }
    } else if (tagsValue && typeof tagsValue === 'object') {
      Object.assign(tags, tagsValue as Record<string, string | number | boolean>);
    }

    const traceId = String(readFieldValue(traceIdField, i) ?? '');
    const spanId = String(readFieldValue(spanIdField, i) ?? '');
    const parentSpanIdRaw = parentSpanIdField ? readFieldValue(parentSpanIdField, i) : undefined;

    spans.push({
      traceId,
      spanId,
      parentSpanId: parentSpanIdRaw ? String(parentSpanIdRaw) : undefined,
      operationName: String(readFieldValue(operationNameField ?? spanIdField, i) ?? 'unknown'),
      serviceName: String(readFieldValue(serviceNameField ?? spanIdField, i) ?? 'unknown'),
      startTime: Number(readFieldValue(startTimeField, i)) * multiplier,
      duration: Number(readFieldValue(durationField, i)) * multiplier,
      tags,
    });
  }

  if (spans.length === 0) {
    return null;
  }

  return buildTraceTree(spans);
}

export function buildTraceTree(spans: Span[]): Trace {
  const spanMap = new Map<string, Span>();
  for (const span of spans) {
    span.children = [];
    spanMap.set(span.spanId, span);
  }

  let rootSpan: Span | undefined;
  const services = new Set<string>();

  for (const span of spans) {
    services.add(span.serviceName);

    if (!span.parentSpanId) {
      if (!rootSpan || span.startTime < rootSpan.startTime) {
        rootSpan = span;
      }
      continue;
    }

    const parent = spanMap.get(span.parentSpanId);
    if (parent) {
      parent.children!.push(span);
      continue;
    }

    if (!rootSpan) {
      rootSpan = span;
    }
  }

  if (!rootSpan) {
    rootSpan = spans[0];
  }

  const assignDepth = (span: Span, depth: number): void => {
    span.depth = depth;
    for (const child of span.children ?? []) {
      assignDepth(child, depth + 1);
    }
  };
  assignDepth(rootSpan, 0);

  const startTime = Math.min(...spans.map((span) => span.startTime));
  const endTime = Math.max(...spans.map((span) => span.startTime + span.duration));

  return {
    traceId: rootSpan.traceId,
    spans,
    rootSpan,
    startTime,
    endTime,
    duration: Math.max(1, endTime - startTime),
    services: Array.from(services),
  };
}

export function parseLogData(
  frames: DataFrame[],
  options?: { lokiTraceIdField?: string; lokiSpanIdField?: string }
): LogLine[] {
  const logs: LogLine[] = [];

  const customTraceField = options?.lokiTraceIdField ?? 'traceId';
  const customSpanField = options?.lokiSpanIdField ?? 'spanId';

  for (const frame of frames) {
    if (frame.length === 0) {
      continue;
    }

    const timeField = frame.fields.find((field) => {
      const name = field.name?.toLowerCase() ?? '';
      return (
        field.type === 'time' ||
        name.includes('time') ||
        name.includes('ts') ||
        name.includes('timestamp')
      );
    });

    const lineField = frame.fields.find((field) => {
      const name = field.name?.toLowerCase() ?? '';
      return (
        name === 'line' ||
        name === 'message' ||
        name === 'body' ||
        name === 'content' ||
        name === 'log'
      );
    });

    if (!timeField || !lineField) {
      continue;
    }

    const labelsField = frame.fields.find((field) => {
      const name = field.name?.toLowerCase() ?? '';
      return name.includes('label');
    });

    const levelField = frame.fields.find((field) => {
      const name = field.name?.toLowerCase() ?? '';
      return name.includes('level') || name.includes('severity');
    });

    const traceIdField = frame.fields.find((field) => {
      const name = field.name?.toLowerCase() ?? '';
      return (
        name === customTraceField ||
        name.includes(customTraceField) ||
        name.includes('traceid') ||
        name.includes('trace_id')
      );
    });

    const spanIdField = frame.fields.find((field) => {
      const name = field.name?.toLowerCase() ?? '';
      return (
        name === customSpanField ||
        name.includes(customSpanField) ||
        name.includes('spanid') ||
        name.includes('span_id')
      );
    });

    for (let i = 0; i < frame.length; i++) {
      const labelsValue = labelsField ? readFieldValue<unknown>(labelsField, i) : undefined;
      const labels = parseLabels(labelsValue);

      const levelRaw = String(
        pickPresent(
          levelField ? readFieldValue(levelField, i) : undefined,
          getLabelValue(labels, [
            'level',
            'detected_level',
            'detectedLevel',
            'severity',
            'severity_text',
            'severityText',
            'severity_number',
            'severityNumber',
            'otel_severity_text',
            'otel.severity_text',
            'otel_severity_number',
            'otel.severity_number',
            'log_level',
            'logLevel',
            'loglevel',
            'lvl',
          ]),
          readFieldValue(lineField, i),
          'info'
        )
      );

      const traceIdValueRaw = traceIdField ? readFieldValue(traceIdField, i) : undefined;
      const spanIdValueRaw = spanIdField ? readFieldValue(spanIdField, i) : undefined;

      const traceIdValue =
        traceIdValueRaw ||
        getLabelValue(labels, [customTraceField, 'trace_id', 'traceId', 'traceid']);

      const spanIdValue =
        spanIdValueRaw || getLabelValue(labels, [customSpanField, 'span_id', 'spanId', 'spanid']);

      const timestamp = Number(readFieldValue(timeField, i));
      const line = String(readFieldValue(lineField, i) ?? '');

      logs.push({
        timestamp,
        line,
        labels,
        level: parseLogLevel(levelRaw),
        traceId: traceIdValue ? String(traceIdValue) : undefined,
        spanId: spanIdValue ? String(spanIdValue) : undefined,
      });
    }
  }

  return logs.sort((a, b) => a.timestamp - b.timestamp);
}

export function flattenSpans(span: Span | undefined): Span[] {
  if (!span) {
    return [];
  }

  const result: Span[] = [span];
  for (const child of span.children ?? []) {
    result.push(...flattenSpans(child));
  }

  return result;
}

export function matchLogsToSpans(trace: Trace, logs: LogLine[]): SpanWithLogs[] {
  const flattenedSpans = flattenSpans(trace.rootSpan);
  if (flattenedSpans.length === 0) {
    return [];
  }

  const logsBySpanId = new Map<string, LogLine[]>();
  const traceOnlyLogsByTraceId = new Map<string, LogLine[]>();

  for (const log of logs) {
    if (log.spanId) {
      const bySpan = logsBySpanId.get(log.spanId) ?? [];
      bySpan.push(log);
      logsBySpanId.set(log.spanId, bySpan);
      continue;
    }

    if (log.traceId) {
      const byTrace = traceOnlyLogsByTraceId.get(log.traceId) ?? [];
      byTrace.push(log);
      traceOnlyLogsByTraceId.set(log.traceId, byTrace);
    }
  }

  return flattenedSpans.map((span) => {
    const directLogs = logsBySpanId.get(span.spanId) ?? [];
    const traceLogs = traceOnlyLogsByTraceId.get(span.traceId) ?? [];

    const start = span.startTime;
    const end = span.startTime + span.duration;
    const buffer = 1000; // 1ms in microseconds

    const fallbackLogs = traceLogs.filter((log) => {
      const logMicros = log.timestamp / 1000;
      return logMicros >= start - buffer && logMicros <= end + buffer;
    });

    const matchedLogs = [...directLogs, ...fallbackLogs].sort((a, b) => a.timestamp - b.timestamp);

    return {
      ...span,
      logs: matchedLogs,
      isExpanded: false,
    };
  });
}

export function formatDuration(microseconds: number): string {
  if (!Number.isFinite(microseconds) || microseconds <= 0) {
    return '0µs';
  }

  if (microseconds < 1000) {
    return `${microseconds.toFixed(0)}µs`;
  }

  if (microseconds < 1000000) {
    return `${(microseconds / 1000).toFixed(2)}ms`;
  }

  return `${(microseconds / 1000000).toFixed(2)}s`;
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp / 1000000);
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function clampWindow(window: TraceWindow, minWidth = 0.02): TraceWindow {
  let start = Number.isFinite(window.start) ? window.start : 0;
  let end = Number.isFinite(window.end) ? window.end : 1;

  if (start > end) {
    const temp = start;
    start = end;
    end = temp;
  }

  start = clampRatio(start);
  end = clampRatio(end);

  if (end - start < minWidth) {
    const center = (start + end) / 2;
    start = center - minWidth / 2;
    end = center + minWidth / 2;
  }

  if (start < 0) {
    end -= start;
    start = 0;
  }

  if (end > 1) {
    start -= end - 1;
    end = 1;
  }

  start = clampRatio(start);
  end = clampRatio(end);

  if (end - start < minWidth) {
    if (start === 0) {
      end = Math.min(1, minWidth);
    } else if (end === 1) {
      start = Math.max(0, 1 - minWidth);
    }
  }

  return {
    start,
    end,
  };
}

export function zoomWindow(window: TraceWindow, factor: number, anchor = 0.5, minWidth = 0.02): TraceWindow {
  const clampedWindow = clampWindow(window, minWidth);
  if (!Number.isFinite(factor) || factor <= 0) {
    return clampedWindow;
  }

  const currentWidth = clampedWindow.end - clampedWindow.start;
  const nextWidth = Math.max(minWidth, Math.min(1, currentWidth * factor));
  const normalizedAnchor = clampRatio(anchor);
  const anchorValue = clampedWindow.start + currentWidth * normalizedAnchor;

  const nextStart = anchorValue - nextWidth * normalizedAnchor;
  const nextEnd = nextStart + nextWidth;

  return clampWindow({ start: nextStart, end: nextEnd }, minWidth);
}

export function panWindow(window: TraceWindow, delta: number): TraceWindow {
  const clampedWindow = clampWindow(window, 0.001);
  const width = clampedWindow.end - clampedWindow.start;

  let start = clampedWindow.start + delta;
  let end = clampedWindow.end + delta;

  if (start < 0) {
    end -= start;
    start = 0;
  }

  if (end > 1) {
    start -= end - 1;
    end = 1;
  }

  return clampWindow({ start, end }, width);
}

function isLogLevelAllowed(level: LogLevel | undefined, minLevel: LogLevelFilter): boolean {
  if (minLevel === 'all') {
    return true;
  }

  return getLogLevelRank(level) >= getLogLevelRank(minLevel);
}

export function buildTraceViewSpans(
  spans: SpanWithLogs[],
  traceStart: number,
  traceDuration: number,
  window: TraceWindow,
  minLogLevel: LogLevelFilter
): TraceViewSpan[] {
  const safeWindow = clampWindow(window);
  const windowStartUs = traceStart + traceDuration * safeWindow.start;
  const windowEndUs = traceStart + traceDuration * safeWindow.end;
  const windowDurationUs = Math.max(1, windowEndUs - windowStartUs);

  return spans.map((span) => {
    const logs = span.logs.filter((log) => isLogLevelAllowed(log.level, minLogLevel));

    const spanStart = span.startTime;
    const spanEnd = span.startTime + span.duration;

    const intersectsWindow = spanEnd >= windowStartUs && spanStart <= windowEndUs;

    const visibleStartUs = Math.max(windowStartUs, spanStart);
    const visibleEndUs = Math.min(windowEndUs, spanEnd);

    const visibleStart = intersectsWindow
      ? clampRatio((visibleStartUs - windowStartUs) / windowDurationUs)
      : 0;
    const visibleEnd = intersectsWindow
      ? clampRatio((visibleEndUs - windowStartUs) / windowDurationUs)
      : 0;

    const failed = isSpanFailed({ tags: span.tags, logs });

    return {
      ...span,
      logs,
      isFailed: failed,
      maxLogSeverity: getLogSeverity(logs),
      visibleStart,
      visibleEnd,
      isVisibleInWindow: intersectsWindow,
    };
  });
}

export function deriveSelectedSpanTabs(
  spans: TraceViewSpan[],
  selectedSpanIds: string[]
): SelectedSpanTab[] {
  const spanMap = new Map<string, TraceViewSpan>();
  for (const span of spans) {
    spanMap.set(span.spanId, span);
  }

  const tabs: SelectedSpanTab[] = [];
  for (const spanId of selectedSpanIds) {
    const span = spanMap.get(spanId);
    if (!span) {
      continue;
    }

    tabs.push({
      spanId,
      title: span.operationName,
      serviceName: span.serviceName,
      isFailed: span.isFailed,
      logCount: span.logs.length,
      logs: span.logs,
      span,
    });
  }

  return tabs;
}

export function buildFailureNavigationIndex(
  failedSpanIds: string[],
  focusedSpanId?: string
): FailureNavigationIndex {
  const orderedFailedSpanIds = Array.from(new Set(failedSpanIds));

  let currentIndex = -1;
  if (focusedSpanId) {
    currentIndex = orderedFailedSpanIds.indexOf(focusedSpanId);
  }

  return {
    orderedFailedSpanIds,
    currentIndex,
    hasPrevious: currentIndex > 0,
    hasNext: currentIndex >= 0 ? currentIndex < orderedFailedSpanIds.length - 1 : orderedFailedSpanIds.length > 0,
  };
}
