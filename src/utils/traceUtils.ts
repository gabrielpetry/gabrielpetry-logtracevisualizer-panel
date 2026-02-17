import { DataFrame, Field } from '@grafana/data';
import { LogLine, LogSeverity, Span, SpanWithLogs, Trace } from '../types';

/**
 * Service colors for consistent visualization
 */
const SERVICE_COLORS = [
  '#7B61FF', // Purple
  '#3D71D9', // Blue
  '#FF6B6B', // Coral
  '#4ECB71', // Green
  '#FFBE0B', // Yellow
  '#00D4AA', // Teal
  '#FF8042', // Orange
  '#00C9FF', // Cyan
  '#F72585', // Pink
  '#B5179E', // Magenta
];

const serviceColorMap: Map<string, string> = new Map();

export function getServiceColor(serviceName: string): string {
  if (serviceColorMap.has(serviceName)) {
    return serviceColorMap.get(serviceName)!;
  }
  const color = SERVICE_COLORS[serviceColorMap.size % SERVICE_COLORS.length];
  serviceColorMap.set(serviceName, color);
  return color;
}

/**
 * Determine the highest severity level from a list of logs
 */
export function getLogSeverity(logs: LogLine[]): LogSeverity {
  if (!logs || logs.length === 0) {
    return 'none';
  }

  let hasWarning = false;
  let hasInfo = false;
  let hasDebug = false;

  for (const log of logs) {
    const logLine = log.line.toLowerCase();
    const level = log.level?.toLowerCase();

    // Check for error/critical/exception
    if (
      level === 'error' ||
      level === 'critical' ||
      level === 'fatal' ||
      logLine.includes('error') ||
      logLine.includes('exception') ||
      logLine.includes('critical') ||
      logLine.includes('fatal') ||
      logLine.includes('crit')
    ) {
      return 'error'; // Return immediately for errors (highest priority)
    }

    // Check for warnings
    if (level === 'warn' || level === 'warning' || logLine.includes('warn')) {
      hasWarning = true;
    }

    // Check for info
    if (level === 'info') {
      hasInfo = true;
    }

    // Check for debug
    if (level === 'debug' || level === 'trace') {
      hasDebug = true;
    }
  }

  if (hasWarning) {
    return 'warning';
  }

  if (hasInfo) {
    return 'info';
  }

  if (hasDebug) {
    return 'debug';
  }

  // If there are logs but no identified level, default to info
  return 'info';
}

/**
 * Get color for a span based on its log severity
 */
export function getColorBySeverity(
  severity: LogSeverity,
  errorColor: string,
  warningColor: string,
  infoColor: string,
  debugColor: string
): string | null {
  switch (severity) {
    case 'error':
      return errorColor;
    case 'warning':
      return warningColor;
    case 'info':
      return infoColor;
    case 'debug':
      return debugColor;
    case 'none':
      return null; // Fall back to service color
  }
}

/**
 * Parse trace data from Grafana DataFrames (Tempo format)
 */
export function parseTraceData(
  frames: DataFrame[],
  durationUnit: 'auto' | 'microseconds' | 'milliseconds' | 'seconds' = 'auto'
): Trace | null {
  // Find the trace frame
  const traceFrame = frames.find((frame) => {
    const hasTraceId = frame.fields.some(
      (f) =>
        f.name?.toLowerCase().includes('traceid') ||
        f.name?.toLowerCase().includes('trace_id') ||
        f.name?.toLowerCase().includes('traceid')
    );
    const hasSpanId = frame.fields.some(
      (f) =>
        f.name?.toLowerCase().includes('spanid') ||
        f.name?.toLowerCase().includes('span_id') ||
        f.name?.toLowerCase().includes('spanid')
    );
    return hasTraceId && hasSpanId;
  });

  if (!traceFrame) {
    console.log('No trace frame found');
    return null;
  }

  console.log('Found trace frame');
  console.log('Trace frame fields:', traceFrame.fields.map((f) => ({ name: f.name, type: f.type })));

  const getField = (names: string[]): Field | undefined => {
    return traceFrame.fields.find((f) => names.some((n) => f.name?.toLowerCase().includes(n.toLowerCase())));
  };

  const traceIdField = getField(['traceid', 'trace_id']);
  const spanIdField = getField(['spanid', 'span_id']);
  const parentSpanIdField = getField(['parentspanid', 'parent_span_id', 'parentSpanId']);
  const operationNameField = getField(['operationname', 'operation_name', 'name']);
  const serviceNameField = getField(['servicename', 'service_name', 'service']);
  const startTimeField = getField(['starttime', 'start_time', 'startTime']);
  const durationField = getField(['duration']);
  const tagsField = getField(['tags', 'servicetags', 'service_tags']);

  if (!traceIdField || !spanIdField || !startTimeField || !durationField) {
    console.log('Missing required fields for trace parsing');
    return null;
  }

  const spans: Span[] = [];
  const length = traceFrame.length;

  // Determine multiplier for duration unit. If 'auto', detect from sample values.
  let durationMultiplier = 1;
  let detectedUnit: string | null = null;
  if (durationUnit === 'auto') {
    try {
      const samples: number[] = [];
      for (let i = 0; i < Math.min(50, length); i++) {
        const v = Number(durationField.values[i]);
        if (isFinite(v) && v > 0) samples.push(v);
      }
      if (samples.length > 0) {
        samples.sort((a, b) => a - b);
        const mid = Math.floor(samples.length / 2);
        const median = samples.length % 2 === 1 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2;
        // Heuristics based on magnitude
        if (median >= 1e9) {
          detectedUnit = 'nanoseconds';
          durationMultiplier = 1 / 1000; // ns -> µs
        } else if (median >= 1e6) {
          detectedUnit = 'microseconds';
          durationMultiplier = 1; // µs
        } else if (median >= 1e3) {
          detectedUnit = 'milliseconds';
          durationMultiplier = 1000; // ms -> µs
        } else {
          detectedUnit = 'seconds';
          durationMultiplier = 1000000; // s -> µs
        }
        console.log('parseTraceData: auto-detected duration unit=', detectedUnit, 'median=', median);
      }
    } catch (e) {
      // fallback
      durationMultiplier = 1;
    }
  } else {
    if (durationUnit === 'milliseconds') durationMultiplier = 1000;
    if (durationUnit === 'seconds') durationMultiplier = 1000000;
    detectedUnit = durationUnit;
  }

  for (let i = 0; i < length; i++) {
    const tags: Record<string, string | number | boolean> = {};

    // Parse tags if available
    if (tagsField) {
      const tagsValue = tagsField.values[i];
      if (Array.isArray(tagsValue)) {
        tagsValue.forEach((tag: { key: string; value: string | number | boolean }) => {
          tags[tag.key] = tag.value;
        });
      } else if (tagsValue && typeof tagsValue === 'object') {
        Object.assign(tags, tagsValue);
      }
    }

    spans.push({
      traceId: String(traceIdField.values[i]),
      spanId: String(spanIdField.values[i]),
      parentSpanId: parentSpanIdField ? String(parentSpanIdField.values[i] || '') : undefined,
      operationName: operationNameField ? String(operationNameField.values[i] || 'unknown') : 'unknown',
      serviceName: serviceNameField ? String(serviceNameField.values[i] || 'unknown') : 'unknown',
      startTime: Number(startTimeField.values[i]) * durationMultiplier,
      duration: Number(durationField.values[i]) * durationMultiplier,
      tags,
    });
  }

  // Debug: log sample raw and converted durations to help diagnose unit issues
  try {
    const sampleCount = Math.min(5, spans.length);
    const rawSamples: number[] = [];
    const convertedSamples: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      rawSamples.push(Number(durationField.values[i]));
      convertedSamples.push(Number(durationField.values[i]) * durationMultiplier);
    }
    console.log('parseTraceData: durationUnit=', durationUnit, 'multiplier=', durationMultiplier);
    console.log('parseTraceData: raw durations sample=', rawSamples, 'converted (µs)=', convertedSamples);
  } catch (e) {
    // ignore logging errors
  }

  if (spans.length === 0) {
    console.log('No spans found');
    return null;
  }

  console.log('Parsed', spans.length, 'spans');
  return buildTraceTree(spans);
}

/**
 * Build a trace tree from flat spans
 */
export function buildTraceTree(spans: Span[]): Trace {
  const spanMap = new Map<string, Span>();
  spans.forEach((span) => {
    span.children = [];
    spanMap.set(span.spanId, span);
  });

  let rootSpan: Span | undefined;
  const services = new Set<string>();

  spans.forEach((span) => {
    services.add(span.serviceName);

    if (!span.parentSpanId || span.parentSpanId === '') {
      rootSpan = span;
    } else {
      const parent = spanMap.get(span.parentSpanId);
      if (parent) {
        parent.children!.push(span);
      } else {
        // Orphan span becomes a potential root
        if (!rootSpan) {
          rootSpan = span;
        }
      }
    }
  });

  // If no root found, use the first span
  if (!rootSpan && spans.length > 0) {
    rootSpan = spans[0];
  }

  // Calculate depths
  const calculateDepth = (span: Span, depth: number) => {
    span.depth = depth;
    span.children?.forEach((child) => calculateDepth(child, depth + 1));
  };

  if (rootSpan) {
    calculateDepth(rootSpan, 0);
  }

  // Calculate trace timing
  const startTime = Math.min(...spans.map((s) => s.startTime));
  const endTime = Math.max(...spans.map((s) => s.startTime + s.duration));

  return {
    traceId: rootSpan?.traceId || spans[0].traceId,
    spans,
    rootSpan,
    startTime,
    endTime,
    duration: endTime - startTime,
    services: Array.from(services),
  };
}

/**
 * Parse log data from Grafana DataFrames (Loki format)
 */
export function parseLogData(
  frames: DataFrame[],
  options?: { lokiTraceIdField?: string; lokiSpanIdField?: string }
): LogLine[] {
  const logs: LogLine[] = [];

  for (const frame of frames) {
    // Skip frames that don't have the right structure
    if (frame.length === 0) {
      continue;
    }

    // Log frame info for debugging
    console.log('🔍 Frame analysis:');
    console.log('  Frame length:', frame.length);
    console.log('  Frame fields:', frame.fields.map((f) => ({ name: f.name, type: f.type })));
    console.log('  Custom field names - trace:', options?.lokiTraceIdField, ', span:', options?.lokiSpanIdField);

    // Try to find time field with multiple possible names
    const timeField = frame.fields.find(
      (f) =>
        f.name?.toLowerCase().includes('time') ||
        f.name?.toLowerCase().includes('ts') ||
        f.name?.toLowerCase().includes('timestamp') ||
        f.type === 'time'
    );

    // Try to find log message field with multiple possible names
    const lineField = frame.fields.find(
      (f) =>
        f.name?.toLowerCase() === 'line' ||
        f.name?.toLowerCase() === 'message' ||
        f.name?.toLowerCase() === 'body' ||
        f.name?.toLowerCase() === 'content' ||
        f.name?.toLowerCase() === 'log'
    );

    // Try to find labels field
    const labelsField = frame.fields.find((f) => f.name?.toLowerCase().includes('label'));

    // Log labels structure for debugging
    if (labelsField && frame.length > 0) {
      console.log('  Labels at index 0:', labelsField.values[0]);
    }

    // Try to find level/severity
    const levelField = frame.fields.find((f) => {
      const name = f.name?.toLowerCase();
      return name?.includes('level') || name?.includes('severity');
    });

    // Try to find trace ID - exact match first, then partial
    const customTraceIdField = options?.lokiTraceIdField || 'traceId';
    const traceIdField = frame.fields.find((f) => {
      const name = f.name?.toLowerCase();
      const customName = customTraceIdField.toLowerCase();
      // Exact match first
      return name === customName || name?.includes(customName) || name?.includes('traceid') || name?.includes('trace_id') || name?.includes('traceId');
    });

    // Try to find span ID - exact match first, then partial
    const customSpanIdField = options?.lokiSpanIdField || 'spanId';
    const spanIdField = frame.fields.find((f) => {
      const name = f.name?.toLowerCase();
      const customName = customSpanIdField.toLowerCase();
      // Exact match first
      return name === customName || name?.includes(customName) || name?.includes('spanid') || name?.includes('span_id') || name?.includes('spanId');
    });

    console.log('  ✅ Found fields:');
    console.log('    - timeField:', timeField?.name);
    console.log('    - lineField:', lineField?.name);
    console.log('    - labelsField:', labelsField?.name);
    console.log('    - traceIdField:', traceIdField?.name);
    console.log('    - spanIdField:', spanIdField?.name);

    if (!timeField || !lineField) {
      console.log('Skipping frame - missing time or line field');
      continue;
    }

    console.log('Processing log frame with', frame.length, 'entries');

    for (let i = 0; i < frame.length; i++) {
      const labels: Record<string, string> = {};

      if (labelsField) {
        const labelsValue = labelsField.values[i];
        if (labelsValue && typeof labelsValue === 'object') {
          Object.assign(labels, labelsValue);
        }
      }

      const level = levelField?.values[i] as string | undefined;
      let traceIdValue = traceIdField ? String(traceIdField.values[i] || '') : undefined;
      let spanIdValue = spanIdField ? String(spanIdField.values[i] || '') : undefined;

      // If trace ID not found as separate field, try to extract from labels
      if (!traceIdValue && labels) {
        traceIdValue = labels['trace_id'] || labels['traceId'] || labels['traceid'] || labels[customTraceIdField];
      }

      // If span ID not found as separate field, try to extract from labels
      if (!spanIdValue && labels) {
        spanIdValue = labels['span_id'] || labels['spanId'] || labels['spanid'] || labels[customSpanIdField];
      }

      // Log first few entries for debugging
      if (i < 2) {
        console.log(`  Log entry ${i}:`, {
          traceId: traceIdValue,
          spanId: spanIdValue,
          line: String(lineField.values[i] || '').substring(0, 50),
          labels,
        });
      }

      logs.push({
        timestamp: Number(timeField.values[i]),
        line: String(lineField.values[i] || ''),
        labels,
        level: parseLogLevel(level || labels.level),
        traceId: traceIdValue,
        spanId: spanIdValue,
      });
    }
  }

  console.log('Parsed', logs.length, 'logs total');
  return logs.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Parse log level from string
 */
function parseLogLevel(level?: string): LogLine['level'] {
  if (!level) {
    return 'info';
  }
  const l = level.toLowerCase();
  if (l.includes('err') || l.includes('fatal') || l.includes('critical')) {
    return 'error';
  }
  if (l.includes('warn')) {
    return 'warn';
  }
  if (l.includes('debug')) {
    return 'debug';
  }
  if (l.includes('trace')) {
    return 'trace';
  }
  return 'info';
}

/**
 * Match logs to spans based on timing and trace/span IDs
 */
export function matchLogsToSpans(trace: Trace, logs: LogLine[]): SpanWithLogs[] {
  const flattenedSpans = flattenSpans(trace.rootSpan!);

  console.log('🔗 Matching logs to spans:');
  console.log('  Total spans:', flattenedSpans.length);
  console.log('  Total logs:', logs.length);
  console.log('  Trace ID:', trace.traceId);

  // Show sample spans
  if (flattenedSpans.length > 0) {
    console.log('  Sample span 0:', {
      traceId: flattenedSpans[0].traceId,
      spanId: flattenedSpans[0].spanId,
      operation: flattenedSpans[0].operationName,
    });
  }

  // Show sample logs
  if (logs.length > 0) {
    console.log('  Sample log 0:', {
      traceId: logs[0].traceId,
      spanId: logs[0].spanId,
      line: logs[0].line.substring(0, 50),
    });
  }

  return flattenedSpans.map((span) => {
    const matchingLogs = logs.filter((log) => {
      // If log has spanId, match directly
      if (log.spanId && log.spanId === span.spanId) {
        return true;
      }

      // If log has traceId but no spanId, check time window
      if (log.traceId && log.traceId === span.traceId) {
        // Convert nanoseconds to microseconds for comparison (Loki uses ns, Tempo uses µs)
        const logTimeMicro = log.timestamp / 1000;
        const spanStart = span.startTime;
        const spanEnd = span.startTime + span.duration;

        // Add small buffer for timing discrepancies
        const buffer = 1000; // 1ms buffer
        return logTimeMicro >= spanStart - buffer && logTimeMicro <= spanEnd + buffer;
      }

      return false;
    });

    if (matchingLogs.length > 0) {
      console.log(`  ✅ Span ${span.spanId}: ${matchingLogs.length} logs matched`);
    }

    return {
      ...span,
      logs: matchingLogs,
      isExpanded: false,
    };
  });
}

/**
 * Flatten spans tree into array maintaining hierarchy order
 */
export function flattenSpans(span: Span | undefined): Span[] {
  if (!span) {
    return [];
  }

  const result: Span[] = [span];
  if (span.children) {
    span.children.forEach((child) => {
      result.push(...flattenSpans(child));
    });
  }
  return result;
}

/**
 * Format duration from microseconds to human readable
 */
export function formatDuration(microseconds: number): string {
  if (microseconds < 1000) {
    return `${microseconds.toFixed(0)}µs`;
  }
  if (microseconds < 1000000) {
    return `${(microseconds / 1000).toFixed(2)}ms`;
  }
  return `${(microseconds / 1000000).toFixed(2)}s`;
}

/**
 * Format timestamp to readable time
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp / 1000); // Convert from µs to ms
  return date.toISOString().split('T')[1].replace('Z', '');
}

/**
 * Generate mock trace data for testing
 */
export function generateMockTrace(): Trace {
  const traceId = 'abc123def456';
  const now = Date.now() * 1000; // Convert to microseconds

  const spans: Span[] = [
    {
      traceId,
      spanId: 'span-001',
      operationName: 'HTTP GET /api/users',
      serviceName: 'api-gateway',
      startTime: now,
      duration: 150000, // 150ms
      tags: { 'http.method': 'GET', 'http.status_code': 200 },
      depth: 0,
      children: [],
    },
    {
      traceId,
      spanId: 'span-002',
      parentSpanId: 'span-001',
      operationName: 'authenticate',
      serviceName: 'auth-service',
      startTime: now + 5000,
      duration: 25000, // 25ms
      tags: { 'user.authenticated': true },
      depth: 1,
      children: [],
    },
    {
      traceId,
      spanId: 'span-003',
      parentSpanId: 'span-001',
      operationName: 'SELECT * FROM users',
      serviceName: 'user-service',
      startTime: now + 35000,
      duration: 80000, // 80ms
      tags: { 'db.type': 'postgresql', 'db.statement': 'SELECT' },
      depth: 1,
      children: [],
    },
    {
      traceId,
      spanId: 'span-004',
      parentSpanId: 'span-003',
      operationName: 'cache.get',
      serviceName: 'cache-service',
      startTime: now + 40000,
      duration: 5000, // 5ms
      tags: { 'cache.hit': false },
      depth: 2,
      children: [],
    },
    {
      traceId,
      spanId: 'span-005',
      parentSpanId: 'span-003',
      operationName: 'db.query',
      serviceName: 'postgres',
      startTime: now + 50000,
      duration: 60000, // 60ms
      tags: { 'db.rows_affected': 42 },
      depth: 2,
      children: [],
    },
    {
      traceId,
      spanId: 'span-006',
      parentSpanId: 'span-001',
      operationName: 'serialize response',
      serviceName: 'api-gateway',
      startTime: now + 120000,
      duration: 25000, // 25ms
      tags: { 'response.size': 1024 },
      depth: 1,
      children: [],
    },
  ];

  // Build the tree
  const spanMap = new Map<string, Span>();
  spans.forEach((s) => {
    s.children = [];
    spanMap.set(s.spanId, s);
  });

  spans.forEach((s) => {
    if (s.parentSpanId) {
      const parent = spanMap.get(s.parentSpanId);
      if (parent) {
        parent.children!.push(s);
      }
    }
  });

  return {
    traceId,
    spans,
    rootSpan: spans[0],
    startTime: now,
    endTime: now + 150000,
    duration: 150000,
    services: ['api-gateway', 'auth-service', 'user-service', 'cache-service', 'postgres'],
  };
}

/**
 * Generate mock log data for testing
 */
export function generateMockLogs(trace: Trace): LogLine[] {
  const logs: LogLine[] = [];

  const flatSpans = flattenSpans(trace.rootSpan);

  flatSpans.forEach((span) => {
    // Add 1-3 logs per span
    const numLogs = Math.floor(Math.random() * 3) + 1;
    const spanStartNs = span.startTime * 1000;
    const spanDurationNs = span.duration * 1000;

    for (let i = 0; i < numLogs; i++) {
      const offset = (spanDurationNs / (numLogs + 1)) * (i + 1);
      const levels: Array<LogLine['level']> = ['info', 'debug', 'warn', 'error'];
      const level = levels[Math.floor(Math.random() * 4)];

      const messages: Record<string, string[]> = {
        info: [
          `Processing request for ${span.operationName}`,
          `Operation completed successfully`,
          `Handling span ${span.spanId}`,
        ],
        debug: [
          `Entering ${span.operationName}`,
          `Debug context: service=${span.serviceName}`,
          `Span attributes: ${JSON.stringify(span.tags)}`,
        ],
        warn: [
          `Slow operation detected in ${span.serviceName}`,
          `Rate limit approaching threshold`,
          `Retry attempt #2 for ${span.operationName}`,
        ],
        error: [
          `Failed to process ${span.operationName}`,
          `Connection timeout to upstream`,
          `Error in ${span.serviceName}: Resource not found`,
        ],
      };

      const messageOptions = messages[level || 'info'];
      const message = messageOptions[Math.floor(Math.random() * messageOptions.length)];

      logs.push({
        timestamp: spanStartNs + offset,
        line: `[${new Date((spanStartNs + offset) / 1000000).toISOString()}] ${level?.toUpperCase()} ${span.serviceName}: ${message}`,
        labels: {
          service: span.serviceName,
          level: level || 'info',
        },
        level,
        traceId: span.traceId,
        spanId: span.spanId,
      });
    }
  });

  return logs.sort((a, b) => a.timestamp - b.timestamp);
}
