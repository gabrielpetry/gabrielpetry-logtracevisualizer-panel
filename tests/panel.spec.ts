import { expect, test } from '@grafana/plugin-e2e';

test('shows empty trace state when no trace data is returned', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });

  await expect(panelEditPage.panel.locator).toContainText('No trace data available');
});

test('exposes V2 panel options in custom options editor', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });

  const options = panelEditPage.getCustomOptions('Log-Trace-Visualizer');

  await expect(options.getSwitch('Show service legend')).toBeVisible();
  await expect(options.getSwitch('Enable Explore links')).toBeVisible();
});
