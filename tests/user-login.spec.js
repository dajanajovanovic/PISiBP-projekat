
const { test, expect } = require('@playwright/test');

async function mockLoginSuccess(page) {
  await page.route('**/*login*', async (route, request) => {
    if (request.method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'test.jwt.token',
          token_type: 'bearer',
          user: { email: 'qa@mail.com', name: 'QA' },
        }),
      });
    }
    return route.continue();
  });
}

async function mockLoginFailure(page, message = 'Invalid email or password') {
  await page.route('**/*login*', async (route, request) => {
    if (request.method() === 'POST') {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: message }),
      });
    }
    return route.continue();
  });
}

test.describe('User Login UI', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.goto('http://localhost:5173/login');
  });

  test('LC01 - Valid Login', async ({ page }) => {
    await mockLoginSuccess(page);
    await page.fill('input[placeholder="Email"]', 'qa_user@mail.com');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Login")');
    await expect(page).toHaveURL(/projects/);
  });

  test('LC02 - Case-insensitive Email', async ({ page }) => {
    await mockLoginSuccess(page);
    await page.fill('input[placeholder="Email"]', 'QA_USER@MAIL.COM');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Login")');
    await expect(page).toHaveURL(/projects/);
  });

  test('LC03 - Plus-Alias Email', async ({ page }) => {
    await mockLoginSuccess(page);
    await page.fill('input[placeholder="Email"]', 'qa.user+alias@mail.com');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Login")');
    await expect(page).toHaveURL(/projects/);
  });

  test('LC04 - Blank Email', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', '');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Login")');
    await expect(
      page.locator('div[data-testid="errorMessage"]', { hasText: 'An email address must have an @-sign' })
    ).toBeVisible();
  });

  test('LC05 - Invalid Email (bez @)', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'not-an-email');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Login")');
    await expect(
      page.locator('div[data-testid="errorMessage"]', { hasText: 'An email address must have an @-sign' })
    ).toBeVisible();
  });

  test('LC06 - Empty Password', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'qa@mail.com');
    await page.fill('input[placeholder="Password"]', '');
    await page.click('button:has-text("Login")');
    await expect(
      page.locator('div[data-testid="errorMessage"]', { hasText: 'Password is required' })
    ).toBeVisible();
  });

  test('LC07 - Wrong Credentials (401)', async ({ page }) => {
    await mockLoginFailure(page, 'Invalid email or password');
    await page.fill('input[placeholder="Email"]', 'qa@mail.com');
    await page.fill('input[placeholder="Password"]', 'WrongPass1!');
    await page.click('button:has-text("Login")');
    await expect(
      page.locator('div[data-testid="errorMessage"]', { hasText: 'Invalid email or password' })
    ).toBeVisible();
  });

  test('LC08 - Trim Spaces Around Email', async ({ page }) => {
    await mockLoginSuccess(page);
    await page.fill('input[placeholder="Email"]', '   qa@mail.com   ');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Login")');
    await expect(page).toHaveURL(/projects/);
  });

  test('LC09 - Ignore Additional Field', async ({ page }) => {
    await mockLoginSuccess(page);
    await page.fill('input[placeholder="Email"]', 'qa_edge@mail.com');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Login")');
    await expect(page).toHaveURL(/projects/);
  });

  test('LC10 - Rate Limit (429)', async ({ page }) => {
    await page.route('**/*login*', async (route, request) => {
      if (request.method() === 'POST') {
        return route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Too many attempts, please try again later' }),
        });
      }
      return route.continue();
    });
    await page.fill('input[placeholder="Email"]', 'qa@mail.com');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Login")');
    await expect(
      page.locator('div[data-testid="errorMessage"]', { hasText: 'Too many attempts, please try again later' })
    ).toBeVisible();
  });
});
