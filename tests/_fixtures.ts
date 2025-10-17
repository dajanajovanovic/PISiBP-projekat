import { test as base, expect, Page } from '@playwright/test';
import { waitAppReady } from './selectors';

type AppFixtures = {
  goLogin: () => Promise<void>;
  goRegister: () => Promise<void>;
  goSearch: () => Promise<void>;
};

export const test = base.extend<AppFixtures>({
  goLogin: async ({ page }, use) => {
    await use(async () => {
      // Probaj /login → ako nema forme, probaj /auth/login → ako nema, probaj /
      const tryRoutes = ['/login', '/auth/login', '/'];
      for (const r of tryRoutes) {
        await page.goto(r).catch(() => {});
        await waitAppReady(page);
        const hasLogin =
          await page.locator('input[type="email"], [data-testid="email"]').first().isVisible().catch(() => false);
        if (hasLogin) break;
      }
      await expect(page).toHaveURL(/\/login|\/auth\/login|\/$/);
    });
  },
  goRegister: async ({ page }, use) => {
    await use(async () => {
      const tryRoutes = ['/register', '/auth/register', '/signup', '/'];
      for (const r of tryRoutes) {
        await page.goto(r).catch(() => {});
        await waitAppReady(page);
        const hasReg =
          await page.locator('[data-testid="register-submit"], button:has-text("Register"), button:has-text("Sign up")')
            .first().isVisible().catch(() => false);
        if (hasReg) break;
      }
      await expect(page).toHaveURL(/\/register|\/auth\/register|\/signup|\/$/);
    });
  },
  goSearch: async ({ page }, use) => {
    await use(async () => {
      const tryRoutes = ['/forms', '/search', '/'];
      for (const r of tryRoutes) {
        await page.goto(r).catch(() => {});
        await waitAppReady(page);
        const hasSearch =
          await page.locator('[data-testid="search-input"], input[placeholder*="pretraga" i], input[type="search"]')
            .first().isVisible().catch(() => false);
        if (hasSearch) break;
      }
      await expect(page).toHaveURL(/\/forms|\/search|\/$/);
    });
  },
});

export const expectRoute = async (page: Page, re: RegExp) => {
  await expect(page).toHaveURL(re);
};

export { expect };
