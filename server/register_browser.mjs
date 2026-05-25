import { chromium } from 'playwright';

const HAOZHU_USER = 'todayis0607';
const HAOZHU_PASS = 'Kevinyang6011';
const PROJECT_ID = '49827';

let isCancelled = false;

function now() { return new Date().toLocaleTimeString('zh-CN'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function genPwd() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 8; i++) p += c[Math.floor(Math.random() * c.length)];
  return p;
}

async function loginHaozhu(context) {
  const page = await context.newPage();
  try {
    await page.goto('https://h5.haozhuma.com/login.php', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    try { const tip = page.locator('button:has-text("继续使用")').first; if (await tip.isVisible()) await tip.click(); } catch {}
    await page.locator('input[type="text"]').first.fill(HAOZHU_USER);
    await page.locator('input[type="password"]').first.fill(HAOZHU_PASS);
    await sleep(500);
    await page.locator('button:has-text("登入")').first.click();
    await sleep(3000);
    try {
      const captcha = page.locator('canvas').first;
      if (await captcha.isVisible()) {
        await page.reload({ waitUntil: 'networkidle' });
        await sleep(2000);
        await page.locator('input[type="text"]').first.fill(HAOZHU_USER);
        await page.locator('input[type="password"]').first.fill(HAOZHU_PASS);
        await sleep(500);
        await page.locator('button:has-text("登入")').first.click();
        await sleep(3000);
      }
    } catch {}
    const success = !page.url().includes('login');
    await page.close();
    return success;
  } catch (e) { await page.close(); return false; }
}

async function getPhoneFromHaozhu(context) {
  const page = await context.newPage();
  try {
    await page.goto('https://h5.haozhuma.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    try { const btn = page.locator('text=取号').first; if (await btn.isVisible()) await btn.click(); } catch {}
    await sleep(1000);
    try { const sel = page.locator('select').first; if (await sel.isVisible()) { await sel.selectOption(PROJECT_ID); await sleep(1000); } } catch {}
    try { const btn = page.locator('button:has-text("获取")').first; if (await btn.isVisible()) await btn.click(); } catch {}
    await sleep(2000);
    const text = await page.locator('body').textContent();
    const match = text.match(/1\d{10}/);
    await page.close();
    return match ? match[0] : null;
  } catch (e) { await page.close(); return null; }
}

async function getMessageFromHaozhu(context, phone) {
  const page = await context.newPage();
  try {
    for (let i = 0; i < 12; i++) {
      if (isCancelled) break;
      await page.goto('https://h5.haozhuma.com/', { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);
      const text = await page.locator('body').textContent();
      if (text.includes(phone)) { const m = text.match(/(\d{6})/); if (m) { await page.close(); return m[1]; } }
      await sleep(5000);
    }
    await page.close();
    return null;
  } catch (e) { await page.close(); return null; }
}

async function registerOnQyyjt(context, phone, code) {
  const page = await context.newPage();
  try {
    await page.goto('https://www.qyyjt.cn/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await page.locator('input[placeholder*="手机号"], input[type="tel"]').first.fill(phone);
    await sleep(500);
    try { const btn = page.locator('button:has-text("获取")').first; if (await btn.isVisible()) await btn.click(); await sleep(2000); } catch {}
    try {
      const cap = page.locator('img[src*="captcha"]').first;
      if (await cap.isVisible()) {
        await page.reload({ waitUntil: 'networkidle' }); await sleep(1500);
        await page.locator('input[placeholder*="手机号"]').first.fill(phone); await sleep(500);
        const btn2 = page.locator('button:has-text("获取")').first;
        if (await btn2.isVisible()) await btn2.click(); await sleep(2000);
      }
    } catch {}
    await page.locator('input[placeholder*="验证码"], input[name="code"]').first.fill(code);
    await sleep(500);
    await page.locator('button:has-text("登录"), button[type="submit"]').first.click();
    await sleep(3000);
    if (page.url().includes('login')) { await page.close(); return { success: false, error: '登录失败' }; }
    const pwd = genPwd();
    try {
      const pi = page.locator('input[placeholder*="密码"], input[type="password"]').first;
      if (await pi.isVisible()) { await pi.fill(pwd); await sleep(500); const c = page.locator('button:has-text("确认"), button[type="submit"]').first; if (await c.isVisible()) await c.click(); await sleep(2000); }
    } catch {}
    await page.close();
    return { success: true, password: pwd };
  } catch (e) { await page.close(); return { success: false, error: e.message }; }
}

export async function startBrowserRegistration(count, onProgress, onComplete) {
  isCancelled = false;
  let successCount = 0;
  const accounts = [];
  onProgress({ current: 0, total: count, step: '准备注册', detail: `共 ${count} 个`, log: { time: now(), message: `启动浏览器自动化注册 ${count} 个`, type: 'info' } });
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
    await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

    onProgress({ current: 0, total: count, step: '登录豪猪网', detail: '登录中...', log: { time: now(), message: '登录豪猪网...', type: 'info' } });
    const ok = await loginHaozhu(context);
    if (!ok) { onProgress({ current: 0, total: count, step: '登录失败', detail: '豪猪网登录失败', log: { time: now(), message: '豪猪网登录失败', type: 'error' } }); await browser.close(); onComplete(0, []); return; }
    onProgress({ current: 0, total: count, step: '登录成功', detail: '豪猪网登录成功', log: { time: now(), message: '豪猪网登录成功', type: 'success' } });

    for (let i = 0; i < count; i++) {
      if (isCancelled) break;
      const idx = i + 1;
      onProgress({ current: i, total: count, step: '获取手机号', detail: `账号 ${idx}/${count}`, log: { time: now(), message: `获取第 ${idx} 个手机号...`, type: 'info' } });
      const phone = await getPhoneFromHaozhu(context);
      if (!phone) { onProgress({ current: i, total: count, step: '取号失败', detail: `账号 ${idx} 失败`, log: { time: now(), message: `账号 ${idx} 取号失败`, type: 'warning' } }); continue; }
      onProgress({ current: i, total: count, step: '等待短信', detail: `账号 ${idx}: ${phone}`, log: { time: now(), message: `手机号 ${phone}，等待短信...`, type: 'info' } });
      const code = await getMessageFromHaozhu(context, phone);
      if (!code) { onProgress({ current: i, total: count, step: '短信超时', detail: `账号 ${idx} 超时`, log: { time: now(), message: `账号 ${idx} 短信超时`, type: 'warning' } }); continue; }
      onProgress({ current: i, total: count, step: '注册中', detail: `账号 ${idx}/${count}`, log: { time: now(), message: `验证码 ${code}，正在预警通注册...`, type: 'info' } });
      const result = await registerOnQyyjt(context, phone, code);
      if (result.success) {
        successCount++; accounts.push({ phone, password: result.password, status: 'success' });
        onProgress({ current: idx, total: count, step: '注册成功', detail: `账号 ${idx} 成功`, log: { time: now(), message: `账号 ${idx} 成功: ${phone}`, type: 'success' }, account: { phone, password: result.password, status: 'success', remark: `批量注册-${idx}` } });
      } else {
        accounts.push({ phone, password: '', status: 'failed' });
        onProgress({ current: idx, total: count, step: '注册失败', detail: `账号 ${idx}: ${result.error}`, log: { time: now(), message: `账号 ${idx} 失败: ${result.error}`, type: 'error' } });
      }
      if (i < count - 1) await sleep(3000);
    }
    await browser.close();
  } catch (e) {
    onProgress({ current: successCount, total: count, step: '异常', detail: e.message, log: { time: now(), message: `错误: ${e.message}`, type: 'error' } });
  }
  onProgress({ current: count, total: count, step: '完成', detail: `成功 ${successCount}/${count}`, log: { time: now(), message: `完成，成功 ${successCount}/${count} 个`, type: 'success' } });
  onComplete(successCount, accounts);
}

export const cancelRegistration = () => { isCancelled = true; };
export const resetCancel = () => { isCancelled = false; };
