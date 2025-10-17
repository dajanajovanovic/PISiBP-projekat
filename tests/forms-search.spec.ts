import { test, expect } from './_fixtures';
import { safeLogin, searchInput } from './selectors';
import type { Page as PWPage } from '@playwright/test';

async function waitUiStable(page: PWPage) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(200);
}

async function doSearch(page: PWPage, query: string) {
  await searchInput(page).click({ timeout: 10_000 });
  await searchInput(page).fill('');
  if (query) await searchInput(page).type(query, { delay: 100 });
  await searchInput(page).press('Enter').catch(() => {});
  await waitUiStable(page);
}

test.describe('[UI] Pretraga formi po nazivu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forms').catch(() => {});
    if (!(await searchInput(page).isVisible().catch(() => false))) {
      await page.goto('/login').catch(() => {});
      await safeLogin(page, 'guest@example.com', 'Guest123!');
      await page.goto('/forms').catch(() => {});
    }
    await expect(searchInput(page)).toBeVisible({ timeout: 10_000 });
    await waitUiStable(page);
  });

  test('FS01 - Inicijalni load prikazuje poznate naslove', async ({ page }) => {
    await expect(page.getByText('All Types Demo Form')).toBeVisible();
    await expect(page.getByText(/^Druga$/)).toBeVisible();
    await expect(page.getByText(/^Moja forma$/)).toBeVisible();
  });

  test('FS02 - "demo" → All Types Demo Form', async ({ page }) => {
    await doSearch(page, 'demo');
    await expect(page.getByText('All Types Demo Form')).toBeVisible();
  });

  test('FS03 - "druga" → Druga', async ({ page }) => {
    await doSearch(page, 'druga');
    await expect(page.getByText(/^Druga$/)).toBeVisible();
  });

  test('FS04 - "moja" → Moja forma', async ({ page }) => {
    await doSearch(page, 'moja');
    await expect(page.getByText(/^Moja forma$/)).toBeVisible();
  });

  test('FS05 - Case-insensitive (DRUGA == druga)', async ({ page }) => {
    await doSearch(page, 'DRUGA');
    await expect(page.getByText(/^Druga$/)).toBeVisible();
    await doSearch(page, 'druga');
    await expect(page.getByText(/^Druga$/)).toBeVisible();
  });

  test('FS06 - Trim razmaka ("   moja   " → Moja forma)', async ({ page }) => {
    await doSearch(page, '   moja   ');
    await expect(page.getByText(/^Moja forma$/)).toBeVisible();
  });

  test('FS07 - Prazan upit vraća početni set', async ({ page }) => {
    await doSearch(page, '');
    await expect(page.getByText('All Types Demo Form')).toBeVisible();
    await expect(page.getByText(/^Druga$/)).toBeVisible();
    await expect(page.getByText(/^Moja forma$/)).toBeVisible();
  });

  test('FS08 - Ne postoji rezultat (poruka ili prazan set)', async ({ page }) => {
    await doSearch(page, 'NemaOvogNaziva12345');
    const noResultsMsg = page.getByText(/no results|nema rezultata|0 results/i);
    const noneKnownVisible =
      !(await page.getByText('All Types Demo Form').isVisible().catch(() => false)) &&
      !(await page.getByText(/^Druga$/).isVisible().catch(() => false)) &&
      !(await page.getByText(/^Moja forma$/).isVisible().catch(() => false));
    if (await noResultsMsg.isVisible().catch(() => false)) {
      await expect(noResultsMsg).toBeVisible();
    } else {
      expect(noneKnownVisible).toBeTruthy();
    }
  });

  test('FS09 - Debounce/stabilnost pri brzom kucanju do "moja"', async ({ page }) => {
    await searchInput(page).fill('');
    await searchInput(page).type('mo');
    await searchInput(page).type('ja');
    await searchInput(page).press('Enter').catch(() => {});
    await waitUiStable(page);
    await expect(page.getByText(/^Moja forma$/)).toBeVisible();
  });
});
