import { test, expect } from './_fixtures';
import type { Page as PWPage, Locator } from '@playwright/test';


async function waitUi(page: PWPage) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

async function firstVisible(...candidates: Locator[]): Promise<Locator> {
  for (const loc of candidates) {
    const el = loc.first();
    if (await el.isVisible().catch(() => false)) return el;
    try {
      await el.waitFor({ state: 'visible', timeout: 1200 });
      return el;
    } catch {}
  }
  return candidates[0].first();
}

async function slowTypeInto(input: Locator, text: string, delay = 220) {
  await input.click({ timeout: 10_000 });
  await input.press('ControlOrMeta+a').catch(() => {});
  await input.press('Delete').catch(() => {});
  if (text) await input.type(text, { delay });
}

async function expectSomeValidationError(page: PWPage) {
  const invalid = await page.locator('input:invalid, textarea:invalid, select:invalid').count().catch(() => 0);
  if (invalid > 0) {
    expect(invalid).toBeGreaterThan(0);
    return;
  }
  const alertVisible =
    await page.getByRole('alert').first().isVisible().catch(() => false) ||
    await page.locator('[aria-invalid="true"]').first().isVisible().catch(() => false);
  if (alertVisible) {
    expect(alertVisible).toBeTruthy();
    return;
  }
  await expect(page.getByText(/invalid|nevažeć|pogrešn|required|obavezno|format|unauthorized|401/i))
    .toBeVisible({ timeout: 4000 });
}

async function onForms(page: PWPage) {
  const ok =
    /\/forms/.test(page.url()) ||
    (await page.getByText(/forms|formulari|pretraga/i).isVisible().catch(() => false)) ||
    (await page.getByText('All Types Demo Form').isVisible().catch(() => false)) ||
    (await page.getByText(/^Druga$/).isVisible().catch(() => false)) ||
    (await page.getByText(/^Moja forma$/).isVisible().catch(() => false));
  return !!ok;
}


async function emailInput(page: PWPage) {
  return firstVisible(
    page.getByTestId('email'),
    page.getByPlaceholder(/email|e-mail/i),
    page.locator('input[type="email"]'),
    page.locator('input[name="email"]')
  );
}
async function passwordInput(page: PWPage) {
  return firstVisible(
    page.getByTestId('password'),
    page.getByPlaceholder(/password|lozinka/i),
    page.locator('input[type="password"]'),
    page.locator('input[name="password"]')
  );
}
async function loginButton(page: PWPage) {
  return firstVisible(
    page.getByTestId('login-submit'),
    page.getByRole('button', { name: /login|log in|sign in|prijav/i }),
    page.locator('button[type="submit"]')
  );
}

async function fullNameInput(page: PWPage) {
  return firstVisible(
    page.getByTestId('full-name'),
    page.getByPlaceholder(/full name|ime|name/i),
    page.locator('input[name="fullName"]'),
    page.locator('input[name="name"]')
  );
}
async function registerButton(page: PWPage) {
  return firstVisible(
    page.getByTestId('register-submit'),
    page.getByRole('button', { name: /register|sign up|registr/i }),
    page.locator('button[type="submit"]')
  );
}


const EXISTING_USER = { email: 'guest@example.com', password: 'Guest123!' };


test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/register').catch(() => {});
  await waitUi(page);

  try {
    const name = await fullNameInput(page);
    const email = await emailInput(page);
    const pass = await passwordInput(page);
    const regBtn = await registerButton(page);

    await slowTypeInto(name, 'Guest Account', 150);
    await slowTypeInto(email, EXISTING_USER.email, 150);
    await slowTypeInto(pass, EXISTING_USER.password, 150);
    await regBtn.click().catch(() => {});
    await waitUi(page);
  } catch {
  }

  await ctx.close();
});



test.describe('[UI] Registracija + Login (E2E i klasični testovi)', () => {
  test('LG00 - (E2E) Registracija novog korisnika pa login', async ({ page }) => {
    const UNIQUE_EMAIL = `e2e.${Date.now()}@example.com`;
    const PASSWORD = 'Test123!';
    const FULLNAME = 'Sandra E2E';

    // Registracija
    await page.goto('/register');
    await waitUi(page);

    const name = await fullNameInput(page);
    const email = await emailInput(page);
    const pass = await passwordInput(page);
    const regBtn = await registerButton(page);

    await slowTypeInto(name, FULLNAME, 200);
    await slowTypeInto(email, UNIQUE_EMAIL, 200);
    await slowTypeInto(pass, PASSWORD, 200);
    await regBtn.click();
    await waitUi(page);

    // Ako nije redirect na /forms, idi na /login
    if (!/\/forms/.test(page.url())) {
      await page.goto('/login');
      await waitUi(page);
    }

    // Login istim nalozima
    const liEmail = await emailInput(page);
    const liPass = await passwordInput(page);
    const liBtn = await loginButton(page);

    await slowTypeInto(liEmail, UNIQUE_EMAIL, 220);
    await page.waitForTimeout(300);
    await slowTypeInto(liPass, PASSWORD, 220);
    await page.waitForTimeout(300);
    await liBtn.click();
    await waitUi(page);

    expect(await onForms(page)).toBeTruthy();
  });

  test('LG01 - Stranica /login se učitava (polja + dugme vidljivi)', async ({ page }) => {
    await page.goto('/login');
    await waitUi(page);
    await expect(await emailInput(page)).toBeVisible();
    await expect(await passwordInput(page)).toBeVisible();
    await expect(await loginButton(page)).toBeVisible();
  });

  test('LG02 - Uspešan login vodi na /forms', async ({ page }) => {
    await page.goto('/login');
    await waitUi(page);

    const email = await emailInput(page);
    const pass = await passwordInput(page);
    const submit = await loginButton(page);

    await slowTypeInto(email, EXISTING_USER.email, 240);
    await page.waitForTimeout(350);
    await slowTypeInto(pass, EXISTING_USER.password, 240);
    await page.waitForTimeout(350);
    await submit.click();
    await waitUi(page);

    expect(await onForms(page)).toBeTruthy();
  });

  test('LG03 - Pogrešna lozinka ostavlja na /login i prikazuje poruku', async ({ page }) => {
    await page.goto('/login');
    await waitUi(page);

    const email = await emailInput(page);
    const pass = await passwordInput(page);
    const submit = await loginButton(page);

    await slowTypeInto(email, EXISTING_USER.email, 200);
    await slowTypeInto(pass, 'Wrong123!', 200);
    await submit.click();
    await waitUi(page);

    await expect(page).toHaveURL(/\/login/);
    await expectSomeValidationError(page);
  });

  test('LG04 - Nevalidan email (bez @) daje validacionu poruku', async ({ page }) => {
    await page.goto('/login');
    await waitUi(page);

    const email = await emailInput(page);
    const pass = await passwordInput(page);
    const submit = await loginButton(page);

    await slowTypeInto(email, 'neispravanEmail', 200);
    await slowTypeInto(pass, EXISTING_USER.password, 200);
    await submit.click();
    await waitUi(page);

    await expect(page).toHaveURL(/\/login/);
    await expectSomeValidationError(page);
  });

  test('LG05 - Prazna polja → required poruke', async ({ page }) => {
    await page.goto('/login');
    await waitUi(page);
    const submit = await loginButton(page);
    await submit.click();
    await waitUi(page);

    await expect(page).toHaveURL(/\/login/);
    await expectSomeValidationError(page);
  });

  test('LG06 - Samo email popunjen, lozinka prazna → poruka o lozinci', async ({ page }) => {
    await page.goto('/login');
    await waitUi(page);

    const email = await emailInput(page);
    const submit = await loginButton(page);

    await slowTypeInto(email, EXISTING_USER.email, 200);
    await submit.click();
    await waitUi(page);

    await expect(page).toHaveURL(/\/login/);
    await expectSomeValidationError(page);
  });
});
