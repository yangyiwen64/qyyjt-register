/**
 * 企业预警通(qyyjt.cn) 注册流程
 * 使用 Playwright 进行浏览器自动化
 */
import { chromium } from 'playwright';
import { getPhone, getMessage, addBlacklist, checkConfig } from './haozhu.js';
// 取消标记
let isCancelled = false;
/**
 * 设置取消标记
 */
export function cancelRegistration() {
    isCancelled = true;
    console.log('[注册] 收到取消信号');
}
/**
 * 重置取消标记
 */
export function resetCancel() {
    isCancelled = false;
}
/**
 * 主注册入口
 */
export async function startRegistration(options) {
    const { count, onProgress, onComplete } = options;
    if (!checkConfig()) {
        onProgress({
            current: 0, total: count, step: '配置错误', detail: '豪猪网Token未配置',
            log: { time: now(), message: '错误：豪猪网Token未配置，请在环境变量中设置 HAOZHU_TOKEN', type: 'error' }
        });
        onComplete(0, []);
        return;
    }
    resetCancel();
    const accounts = [];
    let successCount = 0;
    onProgress({
        current: 0, total: count, step: '准备注册', detail: `共 ${count} 个账号待注册`,
        log: { time: now(), message: `开始批量注册，目标数量: ${count}`, type: 'info' }
    });
    // 串行处理（逐个注册更稳定）
    for (let i = 0; i < count; i++) {
        if (isCancelled) {
            onProgress({
                current: i, total: count, step: '已取消', detail: '注册已取消',
                log: { time: now(), message: `注册已取消，成功 ${successCount}/${count} 个`, type: 'warning' }
            });
            break;
        }
        const idx = i + 1;
        const result = await registerSingle(idx, count, onProgress);
        accounts.push({
            phone: result.phone,
            password: result.password,
            status: result.success ? 'success' : 'failed'
        });
        if (result.success) {
            successCount++;
            onProgress({
                current: idx, total: count, step: '注册成功', detail: `账号 ${idx}/${count} 注册成功`,
                log: { time: now(), message: `账号 ${idx}/${count} 注册成功: ${result.phone}`, type: 'success' },
                account: { phone: result.phone, password: result.password, status: 'success', remark: `批量注册-窗口${idx}` }
            });
        }
        else {
            onProgress({
                current: idx, total: count, step: '注册失败', detail: `账号 ${idx}/${count} 失败: ${result.error}`,
                log: { time: now(), message: `账号 ${idx}/${count} 失败: ${result.error}`, type: 'error' }
            });
        }
        // 每个账号间隔2秒，避免过快
        if (i < count - 1 && !isCancelled) {
            await sleep(2000);
        }
    }
    onProgress({
        current: count, total: count, step: '注册完成', detail: `成功注册 ${successCount} 个账号`,
        log: { time: now(), message: `批量注册完成，成功 ${successCount}/${count} 个`, type: 'success' }
    });
    onComplete(successCount, accounts);
}
/**
 * 注册单个账号
 */
async function registerSingle(idx, total, onProgress) {
    let context = null;
    let phone = '';
    try {
        // Step 1: 获取手机号
        onProgress({ current: idx - 1, total, step: '获取手机号', detail: `账号 ${idx}/${total}：获取手机号`,
            log: { time: now(), message: `正在获取第 ${idx} 个手机号...`, type: 'info' }
        });
        phone = await getPhone() || '';
        if (!phone) {
            return { phone: '', password: '', success: false, error: '获取手机号失败' };
        }
        console.log(`[注册] 获取到手机号: ${phone}`);
        // Step 2: 连接预警通
        onProgress({ current: idx - 1, total, step: '连接预警通', detail: `账号 ${idx}/${total}：连接企业预警通`,
            log: { time: now(), message: `手机号已获取 ${phone}，连接预警通...`, type: 'info' }
        });
        context = await chromium.launchPersistentContext('/tmp/qyyjt_ctx_' + Date.now(), {
            headless: true,
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0',
        });
        const page = context.pages()[0] || await context.newPage();
        // Step 3: 打开预警通注册/登录页面
        onProgress({ current: idx - 1, total, step: '打开登录页', detail: `账号 ${idx}/${total}：打开预警通登录页`,
            log: { time: now(), message: '正在打开企业预警通登录页...', type: 'info' }
        });
        await page.goto('https://www.qyyjt.cn/login.html', { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(1500);
        // 检查是否已登录（如果有cookie）
        const currentUrl = page.url();
        if (currentUrl.includes('userInfo') || currentUrl.includes('home')) {
            console.log('[注册] 检测到已登录状态，尝试登出');
            await page.goto('https://www.qyyjt.cn/login.html', { waitUntil: 'networkidle' });
            await sleep(1000);
        }
        // Step 4: 输入手机号
        onProgress({ current: idx - 1, total, step: '输入手机号', detail: `账号 ${idx}/${total}：输入手机号`,
            log: { time: now(), message: `输入手机号: ${phone}`, type: 'info' }
        });
        const phoneInput = await page.locator('input[placeholder*="手机号"], input[type="tel"], input[name="mobile"]').first();
        if (!phoneInput) {
            throw new Error('未找到手机号输入框');
        }
        await phoneInput.fill(phone);
        await sleep(500);
        // Step 5: 请求图形验证码
        onProgress({ current: idx - 1, total, step: '图形验证码', detail: `账号 ${idx}/${total}：处理图形验证码`,
            log: { time: now(), message: '请求图形验证码...', type: 'info' }
        });
        // 点击发送验证码按钮（可能触发图形验证码）
        const sendCodeBtn = page.locator('button:has-text("获取"), button:has-text("发送"), a:has-text("获取"), .send-code-btn, #sendCodeBtn').first();
        if (sendCodeBtn) {
            await sendCodeBtn.click();
            await sleep(2000);
        }
        // Step 6: 检查是否需要图形验证码
        const captchaImg = await page.locator('img[src*="captcha"], img[src*="verify"], .captcha-img, #captchaImg, .verification-code-img').first();
        if (captchaImg && await captchaImg.isVisible().catch(() => false)) {
            console.log('[注册] 发现图形验证码，需要处理');
            onProgress({ current: idx - 1, total, step: '图形验证码', detail: `账号 ${idx}/${total}：需要手动输入图形验证码`,
                log: { time: now(), message: '发现图形验证码，尝试自动识别...', type: 'warning' }
            });
            // 尝试获取图形验证码图片并识别（简化处理）
            // 实际环境中可能需要调用打码平台
            // 这里采用策略：如果检测到图形验证码，尝试刷新页面跳过
            await page.reload({ waitUntil: 'networkidle' });
            await sleep(1500);
            // 重新输入手机号
            const phoneInput2 = await page.locator('input[placeholder*="手机号"], input[type="tel"], input[name="mobile"]').first();
            if (phoneInput2) {
                await phoneInput2.fill(phone);
                await sleep(500);
            }
            // 再次点击发送
            const sendCodeBtn2 = page.locator('button:has-text("获取"), button:has-text("发送"), a:has-text("获取"), .send-code-btn, #sendCodeBtn').first();
            if (sendCodeBtn2) {
                await sendCodeBtn2.click();
                await sleep(2000);
            }
        }
        // Step 7: 发送短信验证码
        onProgress({ current: idx - 1, total, step: '发送短信', detail: `账号 ${idx}/${total}：触发短信验证码`,
            log: { time: now(), message: '触发短信验证码发送...', type: 'info' }
        });
        // Step 8: 等待并获取短信验证码
        onProgress({ current: idx - 1, total, step: '等待短信', detail: `账号 ${idx}/${total}：等待短信验证码`,
            log: { time: now(), message: '等待豪猪网接收短信验证码（最多60秒）...', type: 'info' }
        });
        const smsCode = await getMessage(phone, 12, 5000);
        if (!smsCode) {
            // 短信超时，释放号码
            await addBlacklist(phone);
            throw new Error('短信验证码获取超时');
        }
        // Step 9: 输入短信验证码
        onProgress({ current: idx - 1, total, step: '输入验证码', detail: `账号 ${idx}/${total}：输入短信验证码`,
            log: { time: now(), message: `收到验证码: ${smsCode}，提交登录...`, type: 'info' }
        });
        const codeInput = await page.locator('input[placeholder*="验证码"], input[placeholder*="code"], input[name="code"], input[name="smsCode"]').first();
        if (codeInput) {
            await codeInput.fill(smsCode);
            await sleep(500);
        }
        // Step 10: 提交登录/注册
        const loginBtn = page.locator('button:has-text("登录"), button:has-text("注册"), button[type="submit"], .login-btn, #loginBtn').first();
        if (loginBtn) {
            await loginBtn.click();
            await sleep(3000);
        }
        // Step 11: 检查结果
        const url = page.url();
        const pageContent = await page.content();
        if (url.includes('login.html') && (pageContent.includes('错误') || pageContent.includes('失败'))) {
            throw new Error('登录/注册失败');
        }
        // 生成随机密码
        const password = generatePassword();
        // 尝试设置密码（如果需要）
        try {
            const pwdInput = await page.locator('input[placeholder*="密码"], input[type="password"], input[name="password"]').first();
            if (pwdInput && await pwdInput.isVisible().catch(() => false)) {
                await pwdInput.fill(password);
                await sleep(500);
                const confirmBtn = page.locator('button:has-text("确认"), button:has-text("设置"), button:has-text("保存"), button[type="submit"]').first();
                if (confirmBtn) {
                    await confirmBtn.click();
                    await sleep(2000);
                }
            }
        }
        catch {
            // 密码设置步骤可选，不影响注册成功
        }
        // 清理
        await context.close().catch(() => { });
        onProgress({ current: idx, total, step: '注册成功', detail: `账号 ${idx}/${total} 完成`,
            log: { time: now(), message: `账号 ${idx}/${total} 注册完成: ${phone}`, type: 'success' },
            account: { phone, password, status: 'success', remark: `批量注册-窗口${idx}` }
        });
        return { phone, password, success: true };
    }
    catch (err) {
        console.error(`[注册] 账号 ${idx} 失败:`, err.message);
        // 清理浏览器
        if (context) {
            await context.close().catch(() => { });
        }
        // 释放失败的号码
        if (phone) {
            await addBlacklist(phone).catch(() => { });
        }
        return { phone, password: '', success: false, error: err.message };
    }
}
/**
 * 验证单个账号（一举两得法）
 */
export async function verifyAccount(phone, password) {
    let context = null;
    try {
        context = await chromium.launchPersistentContext('/tmp/qyyjt_verify_' + Date.now(), {
            headless: true,
            viewport: { width: 1280, height: 720 },
        });
        const page = context.pages()[0] || await context.newPage();
        await page.goto('https://www.qyyjt.cn/login.html', { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(1500);
        // 输入手机号
        const phoneInput = await page.locator('input[placeholder*="手机号"], input[type="tel"], input[name="mobile"]').first();
        if (phoneInput)
            await phoneInput.fill(phone);
        // 发送验证码
        const sendBtn = page.locator('button:has-text("获取"), button:has-text("发送"), .send-code-btn').first();
        if (sendBtn)
            await sendBtn.click();
        // 获取验证码
        const code = await getMessage(phone, 10, 5000);
        if (!code) {
            await context.close().catch(() => { });
            return false;
        }
        // 输入验证码
        const codeInput = await page.locator('input[placeholder*="验证码"], input[name="code"]').first();
        if (codeInput)
            await codeInput.fill(code);
        // 登录
        const loginBtn = page.locator('button:has-text("登录"), button[type="submit"]').first();
        if (loginBtn)
            await loginBtn.click();
        await sleep(3000);
        const url = page.url();
        const success = !url.includes('login.html');
        await context.close().catch(() => { });
        return success;
    }
    catch (err) {
        console.error('[验证] 失败:', err.message);
        if (context)
            await context.close().catch(() => { });
        return false;
    }
}
// 辅助函数
function generatePassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
        pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function now() {
    return new Date().toLocaleTimeString('zh-CN');
}
