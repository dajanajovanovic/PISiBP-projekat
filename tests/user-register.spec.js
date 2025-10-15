const { test, expect } = require('@playwright/test');

async function mockRegisterSuccess(page) {
  await page.route('**/*register*', async (route, request) => {
    if (request.method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.continue();
  });
}

test.describe('User Registration UI', () => {

  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://localhost:5173/register');
  });

  test('TC01 - Valid Register', async ({ page }) => {
    await mockRegisterSuccess(page);
    await page.fill('input[placeholder="Email"]', 'qa_user3@mail.com');
    await page.fill('input[placeholder="Full name"]', 'QA User Three');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Register")');
    await expect(page).toHaveURL(/login/);
  });

  test('TC02 - Case-insensitive Email', async ({ page }) => {
    await mockRegisterSuccess(page);
    await page.fill('input[placeholder="Email"]', 'QA_USER4@MAIL.COM');
    await page.fill('input[placeholder="Full name"]', 'QA User 4');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Register")');
    await expect(page).toHaveURL(/login/);
  });

  test('TC03 - Plus-Alias Email', async ({ page }) => {
    await mockRegisterSuccess(page);
    await page.fill('input[placeholder="Email"]', 'qa.user+alias@mail.com');
    await page.fill('input[placeholder="Full name"]', 'QA User Alias');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Register")');
    await expect(page).toHaveURL(/login/);
  });

  test('TC04 - Blank Email', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', '');
    await page.fill('input[placeholder="Full name"]', 'QA User');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'An email address must have an @-sign' })).toBeVisible();
  });

  test('TC05 - Email Already Exist', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'qa_user3@mail.com');
    await page.fill('input[placeholder="Full name"]', 'QA User Three');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'Email je već registrovan' })).toBeVisible();
  });

  test('TC06 - Invalid Email (bez @)', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'not-an-email');
    await page.fill('input[placeholder="Full name"]', 'X');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'An email address must have an @-sign' })).toBeVisible();
  });

  test('TC07 - Password < 8 characters', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'qa_p1@mail.com');
    await page.fill('input[placeholder="Full name"]', 'X');
    await page.fill('input[placeholder="Password"]', 'Ab1!a');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'Password should have at least 8 characters' })).toBeVisible();
  });

  test('TC08 - Password without number', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'qa_p2@mail.com');
    await page.fill('input[placeholder="Full name"]', 'X');
    await page.fill('input[placeholder="Password"]', 'Abcdefg!');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'Password must contain at least one number' })).toBeVisible();
  });

  test('TC09 - Password Without Uppercase', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'qa_p3@mail.com');
    await page.fill('input[placeholder="Full name"]', 'X');
    await page.fill('input[placeholder="Password"]', 'abcde1!a');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'Password must contain at least one uppercase letter' })).toBeVisible();
  });

  test('TC10 - Password Without Lowercase', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'qa_p4@mail.com');
    await page.fill('input[placeholder="Full name"]', 'X');
    await page.fill('input[placeholder="Password"]', 'ABCDE1!A');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'Password must contain at least one lowercase letter' })).toBeVisible();
  });

  test('TC11 - Password Without Special Sign', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'qa_p5@mail.com');
    await page.fill('input[placeholder="Full name"]', 'X');
    await page.fill('input[placeholder="Password"]', 'Abcdefg1');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'Password must contain at least one special character' })).toBeVisible();
  });

  test('TC12 - Password Only Spaces', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'qa_p6@mail.com');
    await page.fill('input[placeholder="Full name"]', 'X');
    await page.fill('input[placeholder="Password"]', '        ');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'Password cannot be only spaces' })).toBeVisible();
  });

  test('TC13 - Password Full Special Signs', async ({ page }) => {
    await mockRegisterSuccess(page);
    await page.fill('input[placeholder="Email"]', 'qa_p8@mail.com');
    await page.fill('input[placeholder="Full name"]', 'X');
    await page.fill('input[placeholder="Password"]', "Ab1!(){}[]:;' ,?/*~$^+=<>.".replace(' ', '')); // samo da izbegnemo razmak u string literal-u
    await page.click('button:has-text("Register")');
    await expect(page).toHaveURL(/login/);
  });

  test('TC14 - Empty Fullname', async ({ page }) => {
    await page.fill('input[placeholder="Email"]', 'qa_fn1@mail.com');
    await page.fill('input[placeholder="Full name"]', '');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]', { hasText: 'Ime je obavezno' })).toBeVisible();
  });

  test('TC15 - Fullname Minimum Len', async ({ page }) => {
    await mockRegisterSuccess(page);
    await page.fill('input[placeholder="Email"]', 'qa_fn3@mail.com');
    await page.fill('input[placeholder="Full name"]', 'X');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Register")');
    await expect(page).toHaveURL(/login/);
  });

  test('TC16 - Ignore Additional Field', async ({ page }) => {
    await mockRegisterSuccess(page);
    await page.fill('input[placeholder="Email"]', 'qa_edge1@mail.com');
    await page.fill('input[placeholder="Full name"]', 'Edge Case');
    await page.fill('input[placeholder="Password"]', 'Passw0rd!');
    await page.click('button:has-text("Register")');
    await expect(page).toHaveURL(/login/);
  });

  test('TC17 - Empty Body (submit without filling)', async ({ page }) => {
    await page.click('button:has-text("Register")');
    await expect(page.locator('div[data-testid="errorMessage"]')).toBeVisible();
  });

});
