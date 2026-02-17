// Panel options
export interface SimpleOptions {
  showDuration: boolean;
  showServiceColors: boolean;
  collapsedByDefault: boolean;
  colorizeByLogLevel: boolean;
  errorColor: string;
  warningColor: string;
  infoColor: string;
  debugColor: string;
  lokiTraceIdField: string;
  lokiSpanIdField: string;
  durationUnit?: 'auto' | 'microseconds' | 'milliseconds' | 'seconds';
}

// Log severity levels for coloring
export type LogSeverity = 'error' | 'warning' | 'info' | 'debug' | 'none';

// Span represents a single span in a trace
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

// SpanLog represents a log entry within a span
export interface SpanLog {
  timestamp: number;
  fields: Array<{ key: string; value: string | number | boolean }>;
}

// LogLine from Loki
export interface LogLine {
  timestamp: number; // nanoseconds
  line: string;
  labels: Record<string, string>;
  level?: 'info' | 'warn' | 'error' | 'debug' | 'trace';
  traceId?: string;
  spanId?: string;
}

// Trace is a collection of spans
export interface Trace {
  traceId: string;
  spans: Span[];
  rootSpan?: Span;
  startTime: number;
  endTime: number;
  duration: number;
  services: string[];
}

// Combined view state - omits original logs from Span and uses LogLine[] instead
export interface SpanWithLogs extends Omit<Span, 'logs'> {
  logs: LogLine[];
  isExpanded: boolean;
}
