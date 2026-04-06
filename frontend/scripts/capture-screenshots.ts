import { chromium, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'guide-screenshots');
const VIEWPORT = { width: 1440, height: 900 };
const TEST_USER = { email: 'guide@example.com', password: 'TestPassword123!', name: 'Guide User' };

// ── Helpers ──────────────────────────────────────────────────
async function shot(page: Page, filename: string, opts?: { fullPage?: boolean; element?: string; delay?: number }) {
  await page.waitForTimeout(opts?.delay ?? 600);
  const fp = path.join(OUTPUT_DIR, filename);
  if (opts?.element) {
    const el = await page.$(opts.element);
    if (el) { await el.screenshot({ path: fp }); return; }
  }
  await page.screenshot({ path: fp, fullPage: opts?.fullPage ?? false });
}

async function hideSidebar(page: Page) {
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (aside) (aside as HTMLElement).style.display = 'none';
    const flex = aside?.parentElement;
    if (flex) (flex as HTMLElement).style.display = 'block';
    const main = document.querySelector('main');
    if (main) { (main as HTMLElement).style.width = '100%'; (main as HTMLElement).style.maxWidth = '100%'; }
  });
  await page.waitForTimeout(200);
}

async function clickBtn(page: Page, text: string, timeout = 5000) {
  try {
    const btn = page.locator(`button:has-text("${text}")`).first();
    await btn.waitFor({ timeout });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  } catch { console.warn(`    ⚠ Button "${text}" not found`); }
}

async function ensureLoggedIn(page: Page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  if (page.url().includes('/login')) {
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await page.waitForTimeout(1000);
  }
}

function createTestData(): string {
  const dir = path.join(OUTPUT_DIR, 'test-data');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'kpi_scorecard_q1.csv'), [
    'KPI Name,Category,Target,Actual,Unit,Status,Trend',
    'Revenue,Financial,50000000,52300000,SAR,Green,Up',
    'Net Profit Margin,Financial,18,16.5,%,Amber,Up',
    'Customer NPS,Customer,50,55,Score,Green,Up',
    'Customer Retention,Customer,90,92,%,Green,Stable',
    'Employee Satisfaction,People,4.0,3.7,Score /5,Amber,Stable',
    'Attrition Rate,People,8,10.2,%,Red,Down',
    'System Uptime,Operations,99.9,99.95,%,Green,Up',
    'Avg Ticket Resolution,Operations,4,5.2,Hours,Red,Down',
    'Project On-Time Delivery,Operations,85,78,%,Red,Down',
    'Training Completion,People,80,76,%,Amber,Up',
  ].join('\n'));
  return dir;
}

let presId: string | null = null;

async function freshPresentation(page: Page): Promise<string> {
  await ensureLoggedIn(page);
  await clickBtn(page, 'New Presentation');
  await page.waitForTimeout(3000);
  const m = page.url().match(/\/presentation\/([^/]+)/);
  if (m) { presId = m[1]; return presId; }
  throw new Error('Could not create presentation');
}

// Wait for LLM generation to finish by polling for loading indicators
async function waitForGeneration(page: Page, maxMs = 120000) {
  const start = Date.now();
  // Initial wait to let generation start
  await page.waitForTimeout(3000);
  while (Date.now() - start < maxMs) {
    const spinners = await page.$$('.animate-spin, [class*="shimmer"], [class*="skeleton"]');
    // Check if a generate/generating button is still showing loading state
    const generatingBtn = await page.$('button:has-text("Generating"), button:has-text("generating")');
    if (spinners.length === 0 && !generatingBtn) break;
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(1000);
}

// ── Screenshot definitions ───────────────────────────────────
interface Shot { name: string; filename: string; capture: (page: Page) => Promise<void> }

const SHOTS: Shot[] = [
  // ═══════════════ AUTH ═══════════════
  {
    name: 'Login Page',
    filename: '01_login.png',
    capture: async (page) => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await shot(page, '01_login.png');
    },
  },
  {
    name: 'Login Filled',
    filename: '01_login_filled.png',
    capture: async (page) => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await page.fill('#email', 'ahmad.rashid@kpmg.com');
      await page.fill('#password', 'SecurePass123');
      await shot(page, '01_login_filled.png', { delay: 300 });
    },
  },

  // ═══════════════ DASHBOARD ═══════════════
  {
    name: 'Dashboard',
    filename: '02_dashboard.png',
    capture: async (page) => {
      await ensureLoggedIn(page);
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await shot(page, '02_dashboard.png', { delay: 1500 });
    },
  },

  // ═══════════════ STEP 1: INPUT ═══════════════
  {
    name: 'Step 1 — Empty',
    filename: '03_step1_empty.png',
    capture: async (page) => {
      await freshPresentation(page);
      await page.goto(`${BASE_URL}/presentation/${presId}/step1`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await hideSidebar(page);
      await shot(page, '03_step1_empty.png');
    },
  },
  {
    name: 'Step 1 — Prompt Filled',
    filename: '03_step1_prompt.png',
    capture: async (page) => {
      const ta = page.locator('textarea').first();
      await ta.fill(
        'Create a Q1 2026 KPI Scorecard presentation for the Board of Directors.\n\n' +
        '1. Executive summary of overall organizational performance\n' +
        '2. KPIs by category: Financial, Customer, Operations, People\n' +
        '3. RAG status (Red/Amber/Green) for each KPI\n' +
        '4. Compare actual vs target with trends vs previous month\n' +
        '5. Highlight 3 critical Red KPIs needing intervention\n' +
        '6. Recommended actions for Q2 2026'
      );
      await shot(page, '03_step1_prompt.png', { delay: 500 });
    },
  },
  {
    name: 'Step 1 — File Uploaded',
    filename: '03_step1_uploaded.png',
    capture: async (page) => {
      const dataDir = createTestData();
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(path.join(dataDir, 'kpi_scorecard_q1.csv'));
      await shot(page, '03_step1_uploaded.png', { delay: 2000 });
    },
  },
  {
    name: 'Step 1 — Configured',
    filename: '03_step1_complete.png',
    capture: async (page) => {
      // Set audience
      const audienceSel = page.locator('select').first();
      try { await audienceSel.selectOption({ label: 'Board/C-Suite' }); } catch {}
      // Set tone — click "Formal" card
      try {
        const formalCard = page.locator('button:has-text("Formal")').first();
        await formalCard.click();
      } catch {}
      // Set language — click "English"
      try {
        const engCard = page.locator('button:has-text("English")').first();
        await engCard.click();
      } catch {}
      await shot(page, '03_step1_complete.png', { delay: 500 });
    },
  },

  // ═══════════════ STEP 2: PLANNING ═══════════════
  {
    name: 'Step 2 — Before Generate',
    filename: '04_step2_before.png',
    capture: async (page) => {
      await clickBtn(page, 'Proceed to Planning');
      await page.waitForTimeout(2000);
      // May redirect to step2 or stay; navigate explicitly
      if (!page.url().includes('step2')) {
        await page.goto(`${BASE_URL}/presentation/${presId}/step2`, { waitUntil: 'networkidle' });
      }
      await page.waitForTimeout(1500);
      await hideSidebar(page);
      await shot(page, '04_step2_before.png');
    },
  },
  {
    name: 'Step 2 — Generating',
    filename: '04_step2_generating.png',
    capture: async (page) => {
      await clickBtn(page, 'Generate Plan');
      await page.waitForTimeout(2500);
      await shot(page, '04_step2_generating.png');
    },
  },
  {
    name: 'Step 2 — Plan Generated',
    filename: '04_step2_plan.png',
    capture: async (page) => {
      await waitForGeneration(page, 90000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, '04_step2_plan.png', { delay: 500 });
    },
  },
  {
    name: 'Step 2 — Plan Full Page',
    filename: '04_step2_plan_full.png',
    capture: async (page) => {
      await shot(page, '04_step2_plan_full.png', { fullPage: true });
    },
  },

  // ═══════════════ STEP 3: CONTENT ═══════════════
  {
    name: 'Step 3 — Before Generate',
    filename: '05_step3_before.png',
    capture: async (page) => {
      await clickBtn(page, 'Approve Plan');
      await page.waitForTimeout(2000);
      if (!page.url().includes('step3')) {
        await page.goto(`${BASE_URL}/presentation/${presId}/step3`, { waitUntil: 'networkidle' });
      }
      await page.waitForTimeout(1500);
      await hideSidebar(page);
      await shot(page, '05_step3_before.png');
    },
  },
  {
    name: 'Step 3 — Generating',
    filename: '05_step3_generating.png',
    capture: async (page) => {
      await clickBtn(page, 'Generate Content');
      await page.waitForTimeout(8000);
      await shot(page, '05_step3_generating.png');
    },
  },
  {
    name: 'Step 3 — Content Complete',
    filename: '05_step3_complete.png',
    capture: async (page) => {
      await waitForGeneration(page, 180000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, '05_step3_complete.png', { delay: 1000 });
    },
  },
  {
    name: 'Step 3 — Full Page',
    filename: '05_step3_full.png',
    capture: async (page) => {
      await shot(page, '05_step3_full.png', { fullPage: true });
    },
  },

  // ═══════════════ STEP 4: DESIGN ═══════════════
  {
    name: 'Step 4 — Design',
    filename: '06_step4_design.png',
    capture: async (page) => {
      await clickBtn(page, 'Approve Content');
      await page.waitForTimeout(2000);
      if (!page.url().includes('step4')) {
        await page.goto(`${BASE_URL}/presentation/${presId}/step4`, { waitUntil: 'networkidle' });
      }
      await page.waitForTimeout(3000);
      await hideSidebar(page);
      await shot(page, '06_step4_design.png', { delay: 1000 });
    },
  },

  // ═══════════════ STEP 5: EXPORT ═══════════════
  {
    name: 'Step 5 — Export',
    filename: '07_step5_export.png',
    capture: async (page) => {
      await clickBtn(page, 'Export Presentation');
      await page.waitForTimeout(2000);
      if (!page.url().includes('step5')) {
        await page.goto(`${BASE_URL}/presentation/${presId}/step5`, { waitUntil: 'networkidle' });
      }
      await page.waitForTimeout(2000);
      await hideSidebar(page);
      await shot(page, '07_step5_export.png');
    },
  },

  // ═══════════════ SETTINGS ═══════════════
  {
    name: 'Settings — LLM',
    filename: '08_settings_llm.png',
    capture: async (page) => {
      await page.goto(`${BASE_URL}/settings/llm`, { waitUntil: 'networkidle' });
      await shot(page, '08_settings_llm.png', { delay: 1500 });
    },
  },
  {
    name: 'Settings — Prompts',
    filename: '08_settings_prompts.png',
    capture: async (page) => {
      await page.goto(`${BASE_URL}/settings/prompts`, { waitUntil: 'networkidle' });
      await shot(page, '08_settings_prompts.png', { delay: 1500 });
    },
  },
  {
    name: 'Settings — Templates',
    filename: '08_settings_templates.png',
    capture: async (page) => {
      await page.goto(`${BASE_URL}/settings/templates`, { waitUntil: 'networkidle' });
      await shot(page, '08_settings_templates.png', { delay: 1500 });
    },
  },

  // ═══════════════ GUIDE PAGE ═══════════════
  {
    name: 'User Guide',
    filename: '10_guide_page.png',
    capture: async (page) => {
      await page.goto(`${BASE_URL}/guide`, { waitUntil: 'networkidle' });
      await shot(page, '10_guide_page.png', { delay: 1500 });
    },
  },
];

// ── Main ─────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: 'en-US' });
  const page = await context.newPage();

  console.log('Screenshot capture starting...\n');

  // Setup auth
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 5000 });
    console.log('  Logged in.\n');
  } catch {
    console.log('  Login failed, registering...');
    try {
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
      await page.fill('#name', TEST_USER.name);
      await page.fill('#email', TEST_USER.email);
      await page.fill('#password', TEST_USER.password);
      const cf = await page.$('#confirmPassword');
      if (cf) await cf.fill(TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard**', { timeout: 10000 });
      console.log('  Registered.\n');
    } catch (e: any) { console.error('  Auth failed:', e.message?.slice(0, 100)); }
  }

  let ok = 0, fail = 0;
  for (const s of SHOTS) {
    process.stdout.write(`  ${s.name}... `);
    try {
      await s.capture(page);
      console.log(`\u2713 ${s.filename}`);
      ok++;
    } catch (err: any) {
      console.log(`\u2717 ${err.message?.slice(0, 80)}`);
      fail++;
      try { await page.screenshot({ path: path.join(OUTPUT_DIR, `ERROR_${s.filename}`) }); } catch {}
    }
  }

  await browser.close();
  console.log(`\nDone: ${ok} ok, ${fail} failed. Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);
