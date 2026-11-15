const { test, expect } = require('@playwright/test');

test('workspace drawer remains interactive above its blur scrim', async ({ page }) => {
  const fatal = [];
  page.on('pageerror', error => fatal.push(String(error)));

  await page.goto('/');
  await expect(page.locator('#earthCanvas')).toBeVisible();

  const trigger = page.locator('.portfolio-link[data-open-workspaces]');
  const sidebar = page.locator('#sidebar');
  const scrim = page.locator('#workspaceScrim');

  await trigger.click();
  await expect(sidebar).toHaveClass(/open/);
  await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
  await expect(sidebar).not.toHaveAttribute('inert');
  await expect(scrim).toHaveCSS('opacity', '1');

  // The click must reach the drawer, not the full-screen blur layer.
  await sidebar.locator('.nav-btn[data-page="observatory"]').click();
  await expect(page.locator('[data-view="observatory"]')).toHaveClass(/active/);
  await expect(page.locator('[data-view="observatory"] #worldMap')).toBeVisible();
  await expect(sidebar).not.toHaveClass(/open/);
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  await expect(sidebar).toHaveAttribute('inert', '');
  await expect(page.locator('body')).not.toHaveClass(/workspaces-open/);

  // Escape must also close the drawer and reset every workspace trigger.
  await trigger.click();
  await expect(sidebar).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(sidebar).not.toHaveClass(/open/);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  expect(fatal).toEqual([]);
});

test('Earth model entry remains available from the overview workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#earthCanvas')).toBeVisible();
  await expect(page.locator('.panel-bottom')).toContainText('WGS84 EARTH MODEL');
  await expect(page.locator('#earthReliefToggle')).toBeVisible();
  await expect(page.locator('#earthCloudToggle')).toBeVisible();
  await expect(page.locator('#earthNightToggle')).toBeVisible();
});
