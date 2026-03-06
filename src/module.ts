import { PanelPlugin } from '@grafana/data';
import { SimpleOptions } from './types';
import { SimplePanel } from './components/SimplePanel';

export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions((builder) => {
  return builder
    .addRadio({
      path: 'durationUnit',
      name: 'Duration unit',
      description: 'Unit of the duration field in trace data.',
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
      description: 'Field name in Loki logs containing trace ID.',
      defaultValue: 'traceId',
    })
    .addTextInput({
      path: 'lokiSpanIdField',
      name: 'Loki span ID field',
      description: 'Field name in Loki logs containing span ID.',
      defaultValue: 'spanId',
    })
    .addRadio({
      path: 'defaultSpanFilter',
      name: 'Default span filter',
      description: 'Initial span filter shown in the toolbar.',
      defaultValue: 'all',
      settings: {
        options: [
          { value: 'all', label: 'All spans' },
          { value: 'failed', label: 'Failed spans only' },
        ],
      },
    })
    .addRadio({
      path: 'defaultLogLevel',
      name: 'Default log level filter',
      description: 'Initial minimum log level for correlated logs.',
      defaultValue: 'all',
      settings: {
        options: [
          { value: 'all', label: 'All logs' },
          { value: 'error', label: 'Error' },
          { value: 'warn', label: 'Warn' },
          { value: 'info', label: 'Info' },
          { value: 'debug', label: 'Debug' },
          { value: 'trace', label: 'Trace' },
        ],
      },
    })
    .addBooleanSwitch({
      path: 'showServiceLegend',
      name: 'Show service legend',
      description: 'Display service color legend above the timeline list.',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'enableExploreLinks',
      name: 'Enable Explore links',
      description: 'Show actions that open selected span/log context in Grafana Explore.',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'liveMode',
      name: 'Live mode (auto refresh)',
      description: 'Automatically refresh queries at a fixed interval.',
      defaultValue: false,
    })
    .addNumberInput({
      path: 'liveRefreshMs',
      name: 'Live refresh interval (ms)',
      description: 'Refresh interval used when Live mode is enabled.',
      defaultValue: 5000,
      settings: {
        integer: true,
        min: 1000,
        max: 60000,
        step: 1000,
      },
      showIf: (config) => config.liveMode,
    });
});
