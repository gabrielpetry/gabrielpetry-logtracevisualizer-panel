# Log & Trace Visualizer Panel for Grafana

A Grafana panel plugin that correlates Tempo spans and Loki logs in one view.

## V2 Highlights

- Single scrollable span list with gantt bars
- Inline nested span details (logs + metadata pills) on expand
- Failure-first workflow with failed-only toggle and next/previous failed span navigation
- Timeline controls for fit, zoom, and pan
- Optional "Open in Explore" actions for span and log context

## Data Requirements

Use panel queries that return:

1. Trace spans (Tempo)
2. Optional logs (Loki) with trace/span identifiers

The panel automatically matches logs to spans using:

- direct span ID match when available
- fallback trace ID + timestamp window match when span ID is missing

## Clean-Break V2 Options

This release is a **clean break** from V1 panel options.

Active options:

- `durationUnit`
- `lokiTraceIdField`
- `lokiSpanIdField`
- `defaultSpanFilter` (`all` or `failed`)
- `defaultLogLevel` (`all`, `error`, `warn`, `info`, `debug`, `trace`)
- `showServiceLegend`
- `enableExploreLinks`
- `liveMode`
- `liveRefreshMs`

`liveMode` uses Grafana dashboard refresh events under the hood (panel-driven auto refresh), and the header shows live/refresh state.
You can also start/stop live refresh at runtime from the panel toolbar with the `Start live` / `Stop live` button, without changing saved panel settings.

Removed V1 options:

- `collapsedByDefault`
- `colorizeByLogLevel`
- `errorColor`, `warningColor`, `infoColor`, `debugColor`
- `spanFilter` (replaced by `defaultSpanFilter`)
- `minLogLevel` (replaced by `defaultLogLevel`)
- `showRelatedLogs`

## Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm run test:ci
```

Run local Grafana with Docker:

```bash
npm run server
```

Run Playwright e2e tests:

```bash
npm run e2e
```

## Notes

- Plugin ID and plugin type are unchanged.
- If `plugin.json` is updated in a future change, restart Grafana server to pick up metadata changes.
