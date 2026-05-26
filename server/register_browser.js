/**
 * 企业预警通注册引擎 - 纯浏览器自动化版
 * 不用API，直接用Playwright操作豪猪网后台取号
 */
import { chromium } from 'playwright';
// 豪猪网登录信息
const HAOZHU_USER = 'todayis0607';
const HAOZHU_PASS = 'Kevinyang6011';
const PROJECT_ID = '49827';
// 取消标记
let isCancelled = false;
let activeContext = null;
export function cancelRegistration() {
    isCancelled = true;
}
export function resetCancel() {
    isCancelled = false;
}
function now() { return new Date().toLocaleTimeString('zh-CN'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function genPwd() {
    const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 8; i++)
        p += c[Math.floor(Math.random() * c.length)];
    return p;
}
/**
 * 登录豪猪网
 */
async function loginHaozhu(context) {
    const page = await context.newPage();
    try {
        console.log('[豪猪网] 打开登录页...');
        await page.goto('https://h5.haozhuma.com/login.php', { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);
        // 关闭移动端提示
        const closeTip = page.locator('button:has-text("继续使用")').first;
        if (await closeTip.isVisible().catch(() => false))
            await closeTip.click();
        // 输入用户名密码
        await page.locator('input[type="text"]').first.fill(HAOZHU_USER);
        await page.locator('input[type="password"]').first.fill(HAOZHU_PASS);
        await sleep(500);
        // 点击登录
        const loginBtn = page.locator('button:has-text("登入")').first;
        await loginBtn.click();
        await sleep(3000);
        // 检查是否有验证码
        const captcha = page.locator('canvas').first;
        if (await captcha.isVisible().catch(() => false)) {
            console.log('[豪猪网] 需要验证码，刷新重试...');
            await page.reload({ waitUntil: 'networkidle' });
            await sleep(2000);
            await page.locator('input[type="text"]').first.fill(HAOZHU_USER);
            await page.locator('input[type="password"]').first.fill(HAOZHU_PASS);
            await sleep(500);
            await page.locator('button:has-text("登入")').first.click();
            await sleep(3000);
        }
        const url = page.url();
        if (url.includes('login')) {
            console.log('[豪猪网] 登录失败，仍在登录页');
            await page.close();
            return false;
        }
        console.log('[豪猪网] 登录成功');
        await page.close();
        return true;
    }
    catch (err) {
        console.error('[豪猪网] 登录异常:', err.message);
        await page.close();
        return false;
    }
}
/**
 * 从豪猪网获取手机号（浏览器自动化）
 */
async function getPhoneFromHaozhu(context) {
    const page = await context.newPage();
    try {
        console.log('[豪猪网] 打开取号页...');
        await page.goto('https://h5.haozhuma.com/', { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);
        // 查找"取号"按钮或链接
        const quhaoBtn = page.locator('text=取号, a:has-text("取号"), button:has-text("取号"), .quhao, .get-phone').first;
        if (await quhaoBtn.isVisible().catch(() => false)) {
            await quhaoBtn.click();
            await sleep(2000);
        }
        // 查找项目选择
        const projectSelect = page.locator('select, .project-select, [placeholder*="项目"]').first;
        if (await projectSelect.isVisible().catch(() => false)) {
            await projectSelect.selectOption(PROJECT_ID);
            await sleep(1000);
        }
        // 查找并点击获取手机号按钮
        const getPhoneBtn = page.locator('button:has-text("获取"), button:has-text("取号"), .get-phone-btn, a:has-text("获取手机号")').first;
        if (await getPhoneBtn.isVisible().catch(() => false)) {
            await getPhoneBtn.click();
            await sleep(2000);
        }
        // 从页面提取手机号
        const phoneText = await page.locator('.phone, .phone-number, [class*="phone"], text=/1\\d{10}/').first.textContent().catch(() => '');
        const phoneMatch = phoneText.match(/1\d{10}/);
        if (phoneMatch) {
            console.log(`[豪猪网] 获取手机号: ${phoneMatch[0]}`);
            await page.close();
            return phoneMatch[0];
        }
        // 尝试从页面任何文本中提取手机号
        const bodyText = await page.locator('body').textContent().catch(() => '');
        const bodyMatch = bodyText.match(/1\d{10}/);
        if (bodyMatch) {
            console.log(`[豪猪网] 从页面提取手机号: ${bodyMatch[0]}`);
            await page.close();
            return bodyMatch[0];
        }
        console.log('[豪猪网] 未找到手机号');
        await page.close();
        return null;
    }
    catch (err) {
        console.error('[豪猪网] 取号异常:', err.message);
        await page.close();
        return null;
    }
}
/**
 * 从豪猪网获取短信验证码（浏览器自动化）
 */
async function getMessageFromHaozhu(context, phone) {
    const page = await context.newPage();
    try {
        for (let i = 0; i < 12; i++) {
            if (isCancelled)
                break;
            console.log(`[豪猪网] 等待短信... (${i + 1}/12)`);
            await page.goto('https://h5.haozhuma.com/', { waitUntil: 'networkidle', timeout: 30000 });
            await sleep(2000);
            // 查找短信内容
            const bodyText = await page.locator('body').textContent().catch(() => '');
            // 查找包含该手机号的短信
            const smsPattern = new RegExp(`${phone}.*?\\d{6}`);
            const smsMatch = bodyText.match(smsPattern);
            if (smsMatch) {
                const codeMatch = smsMatch[0].match(/\d{6}/);
                if (codeMatch) {
                    console.log(`[豪猪网] 收到验证码: ${codeMatch[0]}`);
                    await page.close();
                    return codeMatch[0];
                }
            }
            // 查找任何6位数字作为验证码
            const codeMatch = bodyText.match(/(\d{6})/);
            if (codeMatch && bodyText.includes(phone)) {
                console.log(`[豪猪网] 收到验证码: ${codeMatch[0]}`);
                await page.close();
                return codeMatch[0];
            }
            await sleep(5000);
        }
        console.log('[豪猪网] 短信获取超时');
        await page.close();
        return null;
    }
    catch (err) {
        console.error('[豪猪网] 读短信异常:', err.message);
        await page.close();
        return null;
    }
}
/**
 * 在预警通注册单个账号
 */
async function registerOnQyyjt(context, phone, code) {
    const page = await context.newPage();
    try {
        console.log('[预警通] 打开登录页...');
        await page.goto('https://www.qyyjt.cn/login.html', { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);
        // 输入手机号
        await page.locator('input[placeholder*="手机号"], input[type="tel"], input[name="mobile"]').first.fill(phone);
        await sleep(500);
        // 点击发送验证码
        const sendBtn = page.locator('button:has-text("获取"), button:has-text("发送"), .send-code-btn, #sendCodeBtn').first;
        if (await sendBtn.isVisible().catch(() => false)) {
            await sendBtn.click();
            await sleep(2000);
        }
        // 处理图形验证码（如果出现）
        const captchaImg = page.locator('img[src*="captcha"], .captcha-img, #captchaImg').first;
        if (await captchaImg.isVisible().catch(() => false)) {
            console.log('[预警通] 发现图形验证码，刷新...');
            await page.reload({ waitUntil: 'networkidle' });
            await sleep(1500);
            await page.locator('input[placeholder*="手机号"]').first.fill(phone);
            await sleep(500);
            const sendBtn2 = page.locator('button:has-text("获取"), .send-code-btn').first;
            if (await sendBtn2.isVisible().catch(() => false)) {
                await sendBtn2.click();
                await sleep(2000);
            }
        }
        // 输入短信验证码
        const codeInput = page.locator('input[placeholder*="验证码"], input[name="code"], input[name="smsCode"]').first;
        await codeInput.fill(code);
        await sleep(500);
        // 提交登录
        const loginBtn = page.locator('button:has-text("登录"), button:has-text("注册"), button[type="submit"], .login-btn').first;
        await loginBtn.click();
        await sleep(3000);
        // 检查结果
        const url = page.url();
        if (url.includes('login') && (await page.content()).includes('错误')) {
            return { success: false, error: '登录失败' };
        }
        // 设置密码
        const password = genPwd();
        const pwdInput = page.locator('input[placeholder*="密码"], input[type="password"], input[name="password"]').first;
        if (await pwdInput.isVisible().catch(() => false)) {
            await pwdInput.fill(password);
            await sleep(500);
            const confirmBtn = page.locator('button:has-text("确认"), button:has-text("设置"), button:has-text("保存"), button[type="submit"]').first;
            if (await confirmBtn.isVisible().catch(() => false)) {
                await confirmBtn.click();
                await sleep(2000);
            }
        }
        await page.close();
        return { success: true, password };
    }
    catch (err) {
        console.error('[预警通] 注册异常:', err.message);
        await page.close();
        return { success: false, error: err.message };
    }
}
/**
 * 主注册入口
 */
export async function startBrowserRegistration(count, onProgress, onComplete) {
    isCancelled = false;
    const accounts = [];
    let successCount = 0;
    onProgress({
        current: 0, total: count, step: '准备注册', detail: `共 ${count} 个账号`,
        log: { time: now(), message: `启动浏览器自动化注册，目标: ${count}`, type: 'info' }
    });
    try {
        const browser = await chromium.launch({
            headless: true,
            args: ['--disable-blink-features=AutomationControlled']
        });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        activeContext = context;
        // 注入反检测脚本
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        });
        // 1. 登录豪猪网
        onProgress({ current: 0, total: count, step: '登录豪猪网', detail: '正在登录豪猪网...',
            log: { time: now(), message: '正在登录豪猪网...', type: 'info' }
        });
        const loginSuccess = await loginHaozhu(context);
        if (!loginSuccess) {
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
        // 2. 逐个注册
        for (let i = 0; i < count; i++) {
            if (isCancelled) {
                onProgress({ current: i, total: count, step: '已取消', detail: '注册已取消',
                    log: { time: now(), message: `注册已取消，成功 ${successCount}/${count} 个`, type: 'warning' }
                });
                break;
            }
            const idx = i + 1;
            // 获取手机号
            onProgress({ current: i, total: count, step: '获取手机号', detail: `账号 ${idx}/${count}: 获取手机号`,
                log: { time: now(), message: `正在获取第 ${idx} 个手机号...`, type: 'info' }
            });
            const phone = await getPhoneFromHaozhu(context);
            if (!phone) {
                onProgress({ current: i, total: count, step: '取号失败', detail: `账号 ${idx}/${count}: 获取手机号失败`,
                    log: { time: now(), message: `账号 ${idx} 获取手机号失败，跳过`, type: 'warning' }
                });
                continue;
            }
            onProgress({ current: i, total: count, step: '发送验证码', detail: `账号 ${idx}/${count}: 触发短信验证码`,
                log: { time: now(), message: `手机号 ${phone}，触发短信发送...`, type: 'info' }
            });
            // 获取短信验证码
            const code = await getMessageFromHaozhu(context, phone);
            if (!code) {
                onProgress({ current: i, total: count, step: '验证码超时', detail: `账号 ${idx}/${count}: 短信超时`,
                    log: { time: now(), message: `账号 ${idx} 短信验证码超时`, type: 'warning' }
                });
                continue;
            }
            onProgress({ current: i, total: count, step: '注册中', detail: `账号 ${idx}/${count}: 正在预警通注册`,
                log: { time: now(), message: `验证码 ${code}，正在预警通注册...`, type: 'info' }
            });
            // 在预警通注册
            const result = await registerOnQyyjt(context, phone, code);
            if (result.success) {
                successCount++;
                accounts.push({ phone, password: result.password || genPwd(), status: 'success' });
                onProgress({
                    current: idx, total: count, step: '注册成功', detail: `账号 ${idx}/${count} 注册成功`,
                    log: { time: now(), message: `账号 ${idx} 成功: ${phone}`, type: 'success' },
                    account: { phone, password: result.password || genPwd(), status: 'success', remark: `批量注册-窗口${idx}` }
                });
            }
            else {
                accounts.push({ phone, password: '', status: 'failed' });
                onProgress({ current: idx, total: count, step: '注册失败', detail: `账号 ${idx}/${count}: ${result.error}`,
                    log: { time: now(), message: `账号 ${idx} 失败: ${result.error}`, type: 'error' }
                });
            }
            if (i < count - 1)
                await sleep(3000);
        }
        await browser.close();
        activeContext = null;
    }
    catch (err) {
        console.error('[注册] 异常:', err.message);
        onProgress({ current: successCount, total: count, step: '注册出错', detail: err.message,
            log: { time: now(), message: `错误: ${err.message}`, type: 'error' }
        });
    }
    onProgress({ current: count, total: count, step: '注册完成', detail: `成功注册 ${successCount} 个`,
        log: { time: now(), message: `批量注册完成，成功 ${successCount}/${count} 个`, type: 'success' }
    });
    onComplete(successCount, accounts);
}
