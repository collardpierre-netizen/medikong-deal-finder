import { chromium, devices } from 'playwright';

const pages = ['/','/catalogue','/marques','/categories','/promotions','/panier','/mes-rfq'];
const base = 'https://medikong-deal-finder.lovable.app';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 5'] });
const page = await ctx.newPage();

for (const p of pages) {
  try {
    await page.goto(base + p, { waitUntil: 'networkidle', timeout: 25000 });
  } catch(e) { console.log(p, 'NAV ERR', e.message); continue; }
  await page.waitForTimeout(800);
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const out = [];
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && r.width < 4000) {
        let parent = el.parentElement;
        let scrolling = false;
        while (parent) {
          const s = getComputedStyle(parent);
          if (['auto','scroll','hidden'].includes(s.overflowX) && parent.scrollWidth > parent.clientWidth) { scrolling = true; break; }
          parent = parent.parentElement;
        }
        if (!scrolling) {
          out.push({ tag: el.tagName, cls: (el.className||'').toString().slice(0,120), right: Math.round(r.right), w: Math.round(r.width) });
        }
      }
    });
    return { vw, sw, top: out.slice(0, 20) };
  });
  console.log('\n===', p, '===');
  console.log(JSON.stringify(result, null, 2));
}
await browser.close();
