import { PanelPlugin } from '@grafana/data';
import { SimpleOptions } from './types';
import { SimplePanel } from './components/SimplePanel';

export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions((builder) => {
  return builder
    .addBooleanSwitch({
      path: 'showDuration',
      name: 'Show duration',
      description: 'Display duration for each span',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'showServiceColors',
      name: 'Show service colors',
      description: 'Color-code spans by service',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'collapsedByDefault',
      name: 'Collapse logs by default',
      description: 'Whether log panels should be collapsed initially',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'colorizeByLogLevel',
      name: 'Colorize by log level',
      description: 'Override span colors based on log severity (error, warning, info)',
      defaultValue: false,
    })
    .addColorPicker({
      path: 'errorColor',
      name: 'Error color',
      description: 'Color for spans with ERROR, CRITICAL, or EXCEPTION logs',
      defaultValue: '#F2495C',
      showIf: (config) => config.colorizeByLogLevel,
    })
    .addColorPicker({
      path: 'warningColor',
      name: 'Warning color',
      description: 'Color for spans with WARNING or WARN logs',
      defaultValue: '#FF9830',
      showIf: (config) => config.colorizeByLogLevel,
    })
    .addColorPicker({
      path: 'infoColor',
      name: 'Info color',
      description: 'Color for spans with INFO logs (no errors or warnings)',
      defaultValue: '#73BF69',
      showIf: (config) => config.colorizeByLogLevel,
    })
    .addColorPicker({
      path: 'debugColor',
      name: 'Debug color',
      description: 'Color for spans with DEBUG logs only',
      defaultValue: '#A352CC',
      showIf: (config) => config.colorizeByLogLevel,
    })
    .addRadio({
      path: 'durationUnit',
      name: 'Duration unit',
      description: 'Unit of the duration field in your trace data (or Auto-detect)',
      defaultValue: 'auto',
      settings: {
        options: [
          { value: 'auto', label: 'Auto-detect' },
          { value: 'microseconds', label: 'Microseconds (µs)' },
          { value: 'milliseconds', label: 'Milliseconds (ms)' },
          { value: 'seconds', label: 'Seconds (s)' },
        ],
      },
    })
    .addTextInput({
      path: 'lokiTraceIdField',
      name: 'Loki trace ID field',
      description: 'Field name in Loki logs containing the trace ID',
      defaultValue: 'traceId',
    })
    .addTextInput({
      path: 'lokiSpanIdField',
      name: 'Loki span ID field',
      description: 'Field name in Loki logs containing the span ID',
      defaultValue: 'spanId',
    });
});
