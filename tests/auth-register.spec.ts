import { test, expect } from './_fixtures';
import type { Page as PWPage, Locator } from '@playwright/test';


async function waitUi(page: PWPage) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(200);
}

async function firstVisible(...candidates: Locator[]): Promise<Locator> {
  for (const loc of candidates) {
    const el = loc.first();
    if (await el.isVisible().catch(() => false)) return el;
    try {
      await el.waitFor({ state: 'visible', timeout: 800 });
      return el;
    } catch {}
  }
  return candidates[0].first();
}

async function emailInput(page: PWPage) {
  return firstVisible(
    page.getByTestId('email'),
    page.getByLabel(/email|e-mail|mejl/i),
    page.getByPlaceholder(/email|e-mail/i),
    page.locator('input[type="email"]'),
    page.locator('input[name="email"]')
  );
}

async function passwordInput(page: PWPage) {
  return firstVisible(
    page.getByTestId('password'),
    page.getByLabel(/password|lozinka/i),
    page.getByPlaceholder(/password|lozinka/i),
    page.locator('input[type="password"]'),
    page.locator('input[name="password"]')
  );
}

async function fullNameInput(page: PWPage) {
  return firstVisible(
    page.getByTestId('full-name'),
    page.getByLabel(/full name|ime.*prezime|ime i prezime|name/i),
    page.getByPlaceholder(/full name|ime|name/i),
    page.locator('input[name="fullName"]'),
    page.locator('input[name="name"]')
  );
}

async function submitButton(page: PWPage) {
  return firstVisible(
    page.getByTestId('register-submit'),
    page.getByRole('button', { name: /register|sign up|sign-up|registr/i }),
    page.locator('button[type="submit"]')
  );
}

async function slowTypeInto(input: Locator, text: string, delay = 120) {
  await input.click({ timeout: 10_000 });
  await input.fill('');
  if (text) await input.type(text, { delay });
}


test.describe('[UI] Registracija (robustno popunjavanje polja)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await waitUi(page);
    await expect(page).toHaveURL(/\/register/);
  });

  test('RG01 - Stranica se učitava (submit vidljiv)', async ({ page }) => {
    const submit = await submitButton(page);
    await expect(submit).toBeVisible();
  });

  test('RG02 - Uspešna registracija → /forms (vizuelno sporo kucanje)', async ({ page }) => {
    const name = await fullNameInput(page);
    const email = await emailInput(page);
    const pass = await passwordInput(page);
    const submit = await submitButton(page);

    const uniq = Date.now();
    await slowTypeInto(name, 'Sandra Test', 120);
    await slowTypeInto(email, `sandra.${uniq}@example.com`, 120);
    await slowTypeInto(pass, 'Test123!', 120);

    await submit.click();
    await expect(page).toHaveURL(/\/forms|\/success|\/login/, { timeout: 8000 });
  });

  test('RG03 - Kratka lozinka → poruka greške', async ({ page }) => {
    const name = await fullNameInput(page);
    const email = await emailInput(page);
    const pass = await passwordInput(page);
    const submit = await submitButton(page);

    await slowTypeInto(name, 'Short Pass User', 120);
    await slowTypeInto(email, `short.${Date.now()}@example.com`, 120);
    await slowTypeInto(pass, '123', 120);

    await submit.click();
    await waitUi(page);
    await expect(page.getByText(/password|lozinka|short|kratka/i)).toBeVisible({ timeout: 4000 });
  });

  test('RG04 - Email bez @ → poruka greške', async ({ page }) => {
    const name = await fullNameInput(page);
    const email = await emailInput(page);
    const pass = await passwordInput(page);
    const submit = await submitButton(page);

    await slowTypeInto(name, 'Email Invalid', 120);
    await slowTypeInto(email, 'neispravanEmail', 120);
    await slowTypeInto(pass, 'Test123!', 120);

    await submit.click();
    await waitUi(page);
    await expect(page.getByText(/email|invalid|nevažeća|pogrešan/i)).toBeVisible({ timeout: 4000 });
  });

  test('RG05 - Prazna polja → required greške', async ({ page }) => {
    const submit = await submitButton(page);
    await submit.click();
    await expect(page.getByText(/required|obavezno/i)).toBeVisible({ timeout: 4000 });
  });
});
