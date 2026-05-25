/**
 * 企业预警通注册引擎 - 纯浏览器自动化版
 */
const { chromium } = require('playwright');

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

// 登录豪猪网
async function loginHaozhu(context) {
  const page = await context.newPage();
  try {
    console.log('[豪猪网] 打开登录页...');
    await page.goto('https://h5.haozhuma.com/login.php', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    // 关闭移动端提示
    try {
      const closeTip = page.locator('button:has-text("继续使用")').first;
      if (await closeTip.isVisible()) await closeTip.click();
    } catch {}

    await page.locator('input[type="text"]').first.fill(HAOZHU_USER);
    await page.locator('input[type="password"]').first.fill(HAOZHU_PASS);
    await sleep(500);

    await page.locator('button:has-text("登入")').first.click();
    await sleep(3000);

    // 检查是否需要验证码
    try {
      const captcha = page.locator('canvas').first;
      if (await captcha.isVisible()) {
        console.log('[豪猪网] 遇到验证码，刷新重试...');
        await page.reload({ waitUntil: 'networkidle' });
        await sleep(2000);
        await page.locator('input[type="text"]').first.fill(HAOZHU_USER);
        await page.locator('input[type="password"]').first.fill(HAOZHU_PASS);
        await sleep(500);
        await page.locator('button:has-text("登入")').first.click();
        await sleep(3000);
      }
    } catch {}

    const url = page.url();
    const success = !url.includes('login');
    await page.close();
    return success;
  } catch (err) {
    console.error('[豪猪网] 登录异常:', err.message);
    await page.close();
    return false;
  }
}

// 从豪猪网获取手机号
async function getPhoneFromHaozhu(context) {
  const page = await context.newPage();
  try {
    await page.goto('https://h5.haozhuma.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    // 点击取号
    try {
      const quhao = page.locator('text=取号, a:has-text("取号"), button:has-text("取号")').first;
      if (await quhao.isVisible()) await quhao.click();
    } catch {}
    await sleep(1000);

    // 选择项目
    try {
      const select = page.locator('select').first;
      if (await select.isVisible()) {
        await select.selectOption(PROJECT_ID);
        await sleep(1000);
      }
    } catch {}

    // 点击获取
    try {
      const getBtn = page.locator('button:has-text("获取"), button:has-text("取号")').first;
      if (await getBtn.isVisible()) await getBtn.click();
    } catch {}
    await sleep(2000);

    // 提取手机号
    const bodyText = await page.locator('body').textContent();
    const match = bodyText.match(/1\d{10}/);
    await page.close();
    return match ? match[0] : null;
  } catch (err) {
    console.error('[豪猪网] 取号异常:', err.message);
    await page.close();
    return null;
  }
}

// 从豪猪网获取短信验证码
async function getMessageFromHaozhu(context, phone) {
  const page = await context.newPage();
  try {
    for (let i = 0; i < 12; i++) {
      if (isCancelled) break;
      await page.goto('https://h5.haozhuma.com/', { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);

      const bodyText = await page.locator('body').textContent();

      // 查找包含该手机号的短信中的6位验证码
      if (bodyText.includes(phone)) {
        const codeMatch = bodyText.match(/(\d{6})/);
        if (codeMatch) {
          await page.close();
          return codeMatch[1];
        }
      }

      await sleep(5000);
    }
    await page.close();
    return null;
  } catch (err) {
    await page.close();
    return null;
  }
}

// 在预警通注册
async function registerOnQyyjt(context, phone, code) {
  const page = await context.newPage();
  try {
    await page.goto('https://www.qyyjt.cn/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    await page.locator('input[placeholder*="手机号"], input[type="tel"]').first.fill(phone);
    await sleep(500);

    // 发送验证码
    try {
      const sendBtn = page.locator('button:has-text("获取"), .send-code-btn').first;
      if (await sendBtn.isVisible()) await sendBtn.click();
      await sleep(2000);
    } catch {}

    // 处理图形验证码
    try {
      const captcha = page.locator('img[src*="captcha"], .captcha-img').first;
      if (await captcha.isVisible()) {
        await page.reload({ waitUntil: 'networkidle' });
        await sleep(1500);
        await page.locator('input[placeholder*="手机号"]').first.fill(phone);
        await sleep(500);
        const sendBtn2 = page.locator('button:has-text("获取"), .send-code-btn').first;
        if (await sendBtn2.isVisible()) await sendBtn2.click();
        await sleep(2000);
      }
    } catch {}

    // 输入短信验证码
    await page.locator('input[placeholder*="验证码"], input[name="code"]').first.fill(code);
    await sleep(500);

    // 提交登录
    await page.locator('button:has-text("登录"), button:has-text("注册"), button[type="submit"]').first.click();
    await sleep(3000);

    const url = page.url();
    if (url.includes('login')) {
      await page.close();
      return { success: false, error: '登录失败' };
    }

    // 设置密码
    const password = genPwd();
    try {
      const pwdInput = page.locator('input[placeholder*="密码"], input[type="password"]').first;
      if (await pwdInput.isVisible()) {
        await pwdInput.fill(password);
        await sleep(500);
        const confirm = page.locator('button:has-text("确认"), button:has-text("设置"), button[type="submit"]').first;
        if (await confirm.isVisible()) await confirm.click();
        await sleep(2000);
      }
    } catch {}

    await page.close();
    return { success: true, password };
  } catch (err) {
    await page.close();
    return { success: false, error: err.message };
  }
}

// 主入口
async function startRegistration(count, onProgress, onComplete) {
  isCancelled = false;
  const accounts = [];
  let successCount = 0;

  onProgress({ current: 0, total: count, step: '准备注册', detail: `共 ${count} 个`,
    log: { time: now(), message: `启动浏览器自动化注册 ${count} 个`, type: 'info' }
  });

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // 登录豪猪网
    onProgress({ current: 0, total: count, step: '登录豪猪网', detail: '登录中...',
      log: { time: now(), message: '正在登录豪猪网...', type: 'info' }
    });

    const loggedIn = await loginHaozhu(context);
    if (!loggedIn) {
      onProgress({ current: 0, total: count, step: '登录失败', detail: '豪猪网登录失败',
        log: { time: now(), message: '豪猪网登录失败', type: 'error' }
      });
      await browser.close();
      onComplete(0, []);
      return;
    }

    onProgress({ current: 0, total: count, step: '登录成功', detail: '豪猪网登录成功',
      log: { time: now(), message: '豪猪网登录成功', type: 'success' }
    });

    // 逐个注册
    for (let i = 0; i < count; i++) {
      if (isCancelled) break;
      const idx = i + 1;

      onProgress({ current: i, total: count, step: '获取手机号', detail: `账号 ${idx}/${count}`,
        log: { time: now(), message: `获取第 ${idx} 个手机号...`, type: 'info' }
      });

      const phone = await getPhoneFromHaozhu(context);
      if (!phone) {
        onProgress({ current: i, total: count, step: '取号失败', detail: `账号 ${idx} 失败`,
          log: { time: now(), message: `账号 ${idx} 获取手机号失败`, type: 'warning' }
        });
        continue;
      }

      onProgress({ current: i, total: count, step: '等待短信', detail: `账号 ${idx}/${count}: ${phone}`,
        log: { time: now(), message: `手机号 ${phone}，等待短信...`, type: 'info' }
      });

      const code = await getMessageFromHaozhu(context, phone);
      if (!code) {
        onProgress({ current: i, total: count, step: '短信超时', detail: `账号 ${idx} 超时`,
          log: { time: now(), message: `账号 ${idx} 短信超时`, type: 'warning' }
        });
        continue;
      }

      onProgress({ current: i, total: count, step: '注册中', detail: `账号 ${idx}/${count}`,
        log: { time: now(), message: `验证码 ${code}，正在预警通注册...`, type: 'info' }
      });

      const result = await registerOnQyyjt(context, phone, code);

      if (result.success) {
        successCount++;
        accounts.push({ phone, password: result.password, status: 'success' });
        onProgress({
          current: idx, total: count, step: '注册成功', detail: `账号 ${idx} 成功`,
          log: { time: now(), message: `账号 ${idx} 成功: ${phone}`, type: 'success' },
          account: { phone, password: result.password, status: 'success', remark: `批量注册-${idx}` }
        });
      } else {
        accounts.push({ phone, password: '', status: 'failed' });
        onProgress({ current: idx, total: count, step: '注册失败', detail: `账号 ${idx}: ${result.error}`,
          log: { time: now(), message: `账号 ${idx} 失败: ${result.error}`, type: 'error' }
        });
      }

      if (i < count - 1) await sleep(3000);
    }

    await browser.close();
  } catch (err) {
    onProgress({ current: successCount, total: count, step: '异常', detail: err.message,
      log: { time: now(), message: `错误: ${err.message}`, type: 'error' }
    });
  }

  onProgress({ current: count, total: count, step: '完成', detail: `成功 ${successCount}/${count}`,
    log: { time: now(), message: `完成，成功 ${successCount}/${count} 个`, type: 'success' }
  });

  onComplete(successCount, accounts);
}

module.exports = {
  startBrowserRegistration: startRegistration,
  cancelRegistration: () => { isCancelled = true; },
  resetCancel: () => { isCancelled = false; }
};
