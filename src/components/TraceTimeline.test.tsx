import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TraceTimeline } from './TraceTimeline';
import { buildTraceTree } from '../utils/traceUtils';
import { LoadingState } from '@grafana/data';
import { LogLine, Span } from '../types';

function createTraceFixture() {
  const spans: Span[] = [
    {
      traceId: 'trace-1',
      spanId: 'root',
      operationName: 'GET /api/orders',
      serviceName: 'gateway',
      startTime: 1_000_000,
      duration: 10_000,
      tags: {
        'http.status_code': 200,
      },
    },
    {
      traceId: 'trace-1',
      spanId: 'child-ok',
      parentSpanId: 'root',
      operationName: 'select_orders',
      serviceName: 'orders-db',
      startTime: 1_001_000,
      duration: 2_000,
      tags: {
        'db.system': 'postgresql',
      },
    },
    {
      traceId: 'trace-1',
      spanId: 'child-fail',
      parentSpanId: 'root',
      operationName: 'publish_event',
      serviceName: 'event-bus',
      startTime: 1_004_000,
      duration: 2_500,
      tags: {
        'http.status_code': 500,
      },
    },
  ];

  const trace = buildTraceTree(spans);

  const logs: LogLine[] = [
    {
      timestamp: 1_001_500_000,
      line: 'orders fetched',
      labels: {},
      level: 'info',
      traceId: 'trace-1',
      spanId: 'child-ok',
    },
    {
      timestamp: 1_004_200_000,
      line: 'kafka publish failed',
      labels: {},
      level: 'error',
      traceId: 'trace-1',
      spanId: 'child-fail',
    },
  ];

  return { trace, logs };
}

function getRowElement(spanId: string): HTMLElement {
  const row = document.querySelector(`[data-span-id="${spanId}"] > div`);
  if (!row || !(row instanceof HTMLElement)) {
    throw new Error(`Span row not found for ${spanId}`);
  }
  return row;
}

describe('TraceTimeline', () => {
  test('expanded span shows nested attributes pills and logs inline', () => {
    const { trace, logs } = createTraceFixture();

    render(
      <TraceTimeline
        trace={trace}
        logs={logs}
        width={1200}
        height={700}
        defaultSpanFilter="all"
        defaultLogLevel="all"
        showServiceLegend
        enableExploreLinks={false}
      />
    );

    fireEvent.click(getRowElement('child-fail'));

    const details = document.querySelector('[data-testid="trace-span-details"][data-span-id="child-fail"]');
    expect(details).not.toBeNull();
    expect(screen.getByText('http.status_code=500')).not.toBeNull();
    expect(screen.getByText('kafka publish failed')).not.toBeNull();
  });

  test('span rows expose explicit tree depth for hierarchy readability', () => {
    const { trace, logs } = createTraceFixture();

    render(
      <TraceTimeline
        trace={trace}
        logs={logs}
        width={1200}
        height={700}
        defaultSpanFilter="all"
        defaultLogLevel="all"
        showServiceLegend
        enableExploreLinks={false}
      />
    );

    const rootRow = document.querySelector('[data-span-id="root"] > div');
    const childRow = document.querySelector('[data-span-id="child-fail"] > div');

    expect(rootRow?.getAttribute('aria-level')).toEqual('1');
    expect(childRow?.getAttribute('aria-level')).toEqual('2');
    expect(document.querySelector('[data-span-id="child-fail"][data-depth="1"]')).not.toBeNull();
  });

  test('failed-only toggle and next failure navigation expand failed span details', () => {
    const { trace, logs } = createTraceFixture();

    render(
      <TraceTimeline
        trace={trace}
        logs={logs}
        width={1200}
        height={700}
        defaultSpanFilter="all"
        defaultLogLevel="all"
        showServiceLegend
        enableExploreLinks={false}
      />
    );

    fireEvent.click(screen.getByTestId('trace-failed-toggle'));

    expect(document.querySelector('[data-span-id="child-fail"]')).not.toBeNull();
    expect(document.querySelector('[data-span-id="child-ok"]')).toBeNull();

    fireEvent.click(screen.getByTestId('trace-failure-next'));
    const details = document.querySelector('[data-testid="trace-span-details"][data-span-id="child-fail"]');
    expect(details).not.toBeNull();
  });

  test('timeline zoom/pan controls update marker labels and fit resets range', () => {
    const { trace, logs } = createTraceFixture();

    render(
      <TraceTimeline
        trace={trace}
        logs={logs}
        width={1200}
        height={700}
        defaultSpanFilter="all"
        defaultLogLevel="all"
        showServiceLegend
        enableExploreLinks={false}
      />
    );

    const marker0Before = screen.getByTestId('trace-marker-0').textContent;

    fireEvent.click(screen.getByTestId('trace-window-zoom-in'));
    const marker0AfterZoom = screen.getByTestId('trace-marker-0').textContent;
    expect(marker0AfterZoom).not.toEqual(marker0Before);

    fireEvent.click(screen.getByTestId('trace-window-pan-right'));
    const marker0AfterPan = screen.getByTestId('trace-marker-0').textContent;
    expect(marker0AfterPan).not.toEqual(marker0AfterZoom);

    fireEvent.click(screen.getByTestId('trace-window-fit'));
    const marker0AfterFit = screen.getByTestId('trace-marker-0').textContent;
    expect(marker0AfterFit).toEqual(marker0Before);
  });

  test('shows live indicator when live mode is enabled', () => {
    const { trace, logs } = createTraceFixture();

    render(
      <TraceTimeline
        trace={trace}
        logs={logs}
        width={1200}
        height={700}
        defaultSpanFilter="all"
        defaultLogLevel="all"
        showServiceLegend
        enableExploreLinks={false}
        liveMode
        liveRefreshMs={5000}
        dataState={LoadingState.Loading}
      />
    );

    expect(screen.getByTestId('trace-live-indicator').textContent).toEqual('Refreshing…');
  });

  test('can start and stop live mode from toolbar button', () => {
    const { trace, logs } = createTraceFixture();

    render(
      <TraceTimeline
        trace={trace}
        logs={logs}
        width={1200}
        height={700}
        defaultSpanFilter="all"
        defaultLogLevel="all"
        showServiceLegend
        enableExploreLinks={false}
        liveMode={false}
        liveRefreshMs={5000}
        dataState={LoadingState.Loading}
      />
    );

    expect(screen.getByTestId('trace-live-indicator').textContent).toEqual('Live off');

    fireEvent.click(screen.getByTestId('trace-live-toggle'));
    expect(screen.getByTestId('trace-live-indicator').textContent).toEqual('Refreshing…');

    fireEvent.click(screen.getByTestId('trace-live-toggle'));
    expect(screen.getByTestId('trace-live-indicator').textContent).toEqual('Live off');
  });
});
