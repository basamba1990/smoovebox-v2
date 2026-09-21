import { test, expect } from '@playwright/test';

const email = process.env.E2E_EMAIL || process.env.TEST_EMAIL;
const password = process.env.E2E_PASSWORD || process.env.TEST_PASSWORD;

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, 'E2E_EMAIL et E2E_PASSWORD sont requis.');

  await page.goto(process.env.PLAYWRIGHT_START_URL || '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/($|spotbulle-home)/);
  await expect(page.locator('.lumi-wheel')).toBeVisible();
});

test('un swipe tactile horizontal fait tourner Lumi vers le secteur suivant', async ({ page }) => {
  const wheel = page.locator('.lumi-wheel');
  const sectors = page.locator('.lumi-wheel-sectors');
  const selection = page.locator('.selection-pill');
  const urlBefore = page.url();
  const transformBefore = await sectors.evaluate((element) => getComputedStyle(element).transform);

  await expect(selection).toHaveText('Missions');
  await expect(wheel).toHaveCSS('touch-action', 'pan-y');

  await wheel.dispatchEvent('pointerdown', {
    bubbles: true,
    pointerId: 101,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: 260,
    clientY: 300,
  });
  await wheel.dispatchEvent('pointermove', {
    bubbles: true,
    pointerId: 101,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 180,
    clientY: 300,
  });
  await wheel.dispatchEvent('pointerup', {
    bubbles: true,
    pointerId: 101,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: 180,
    clientY: 300,
  });

  await expect(selection).toHaveText('Profil');
  await expect.poll(async () => sectors.evaluate((element) => getComputedStyle(element).transform)).not.toBe(transformBefore);
  await expect(page).toHaveURL(urlBefore);
});

test('un swipe tactile inverse revient au secteur précédent sans navigation parasite', async ({ page }) => {
  const wheel = page.locator('.lumi-wheel');
  const sectors = page.locator('.lumi-wheel-sectors');
  const selection = page.locator('.selection-pill');
  const urlBefore = page.url();

  await wheel.dispatchEvent('pointerdown', {
    bubbles: true,
    pointerId: 102,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: 180,
    clientY: 300,
  });
  await wheel.dispatchEvent('pointermove', {
    bubbles: true,
    pointerId: 102,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 260,
    clientY: 300,
  });
  await wheel.dispatchEvent('pointerup', {
    bubbles: true,
    pointerId: 102,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: 260,
    clientY: 300,
  });

  await expect(selection).toHaveText('Portfolio');
  await expect(page).toHaveURL(urlBefore);

  const transform = await sectors.evaluate((element) => getComputedStyle(element).transform);
  expect(transform).not.toBe('none');
});
