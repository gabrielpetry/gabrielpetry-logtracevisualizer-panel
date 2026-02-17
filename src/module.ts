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
