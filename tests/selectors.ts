import { Page, FrameLocator, Locator } from '@playwright/test';

export async function waitAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(200);
}

function mergedLoginLocator(root: Page | FrameLocator) {
  const email = root.locator([
    '[data-testid="email"]',
    'input[name="email"]',
    'input[placeholder*="email" i]',
    'input[type="email"]'
  ].join(', '));
  const password = root.locator([
    '[data-testid="password"]',
    'input[name="password"]',
    'input[placeholder*="password" i]',
    'input[placeholder*="lozinka" i]',
    'input[type="password"]'
  ].join(', '));
  const submit = root.locator([
    '[data-testid="login-submit"]',
    'button:has-text("Login")',
    'button:has-text("Prijava")',
    'button:has-text("Sign in")',
    'button[type="submit"]'
  ].join(', '));
  return { email, password, submit };
}

async function getLoginRoot(page: Page): Promise<Page | FrameLocator> {
  const plain = mergedLoginLocator(page);
  if (await plain.email.first().isVisible().catch(() => false)) return page;

  const iframes = await page.locator('iframe').count();
  for (let i = 0; i < iframes; i++) {
    const frame = page.frameLocator(`iframe >> nth=${i}`);
    const loc = mergedLoginLocator(frame);
    if (await loc.email.first().isVisible().catch(() => false)) return frame;
  }
  return page;
}

export async function safeLogin(page: Page, emailValue: string, passValue: string) {
  await waitAppReady(page);
  const root = await getLoginRoot(page);
  const { email, password, submit } = mergedLoginLocator(root);

  await email.first().fill(emailValue, { timeout: 10_000 });
  await password.first().fill(passValue, { timeout: 10_000 });
  await submit.first().click({ timeout: 10_000 });
}

export function searchInput(page: Page): Locator {
  return page.locator([
    '[data-testid="search-input"]',
    'input[placeholder*="Search" i]',
    'input[placeholder*="Pretraga" i]',
    'input[type="search"]',
    'input[name="q"]'
  ].join(', '));
}
export function formsList(page: Page): Locator {
  return page.locator([
    '[data-testid="forms-list"]',
    '[role="list"]',
    '.forms-list',
    '.cards'
  ].join(', '));
}
export function formCards(page: Page): Locator {
  return page.locator([
    '[data-testid="form-card"]',
    '.form-card',
    '[role="listitem"]',
    '.card'
  ].join(', '));
}
