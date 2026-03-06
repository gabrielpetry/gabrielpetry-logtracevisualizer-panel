export type DurationUnit = 'auto' | 'microseconds' | 'milliseconds' | 'seconds';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'trace';
export type LogLevelFilter = 'all' | LogLevel;
export type SpanFilter = 'all' | 'failed';

// Panel options (V2)
export interface SimpleOptions {
  durationUnit?: DurationUnit;
  lokiTraceIdField?: string;
  lokiSpanIdField?: string;
  defaultSpanFilter?: SpanFilter;
  defaultLogLevel?: LogLevelFilter;
  showServiceLegend?: boolean;
  enableExploreLinks?: boolean;
  liveMode?: boolean;
  liveRefreshMs?: number;
}

export type LogSeverity = 'error' | 'warning' | 'info' | 'debug' | 'none';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number; // microseconds
  duration: number; // microseconds
  tags: Record<string, string | number | boolean>;
  logs?: SpanLog[];
  children?: Span[];
  depth?: number;
}

export interface SpanLog {
  timestamp: number;
  fields: Array<{ key: string; value: string | number | boolean }>;
}

export interface LogLine {
  timestamp: number; // nanoseconds
  line: string;
  labels: Record<string, string>;
  level?: LogLevel;
  traceId?: string;
  spanId?: string;
}

export interface Trace {
  traceId: string;
  spans: Span[];
  rootSpan?: Span;
  startTime: number;
  endTime: number;
  duration: number;
  services: string[];
}

export interface SpanWithLogs extends Omit<Span, 'logs'> {
  logs: LogLine[];
  isExpanded: boolean;
}

export interface TraceWindow {
  start: number; // 0..1
  end: number; // 0..1
}

export interface TraceViewSpan extends SpanWithLogs {
  isFailed: boolean;
  maxLogSeverity: LogSeverity;
  visibleStart: number;
  visibleEnd: number;
  isVisibleInWindow: boolean;
}

export interface TraceViewState {
  selectedSpanIds: string[];
  focusedSpanId?: string;
  expandedSpanIds: string[];
  spanFilter: SpanFilter;
  minLogLevel: LogLevelFilter;
  window: TraceWindow;
}

export interface FailureNavigationIndex {
  orderedFailedSpanIds: string[];
  currentIndex: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface SelectedSpanTab {
  spanId: string;
  title: string;
  serviceName: string;
  isFailed: boolean;
  logCount: number;
  logs: LogLine[];
  span: TraceViewSpan;
}
