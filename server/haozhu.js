/**
 * 豪猪网 API 客户端
 * 服务：api.dwtmcp.cn
 */
const API_BASE = 'http://api.dwtmcp.cn/api';
// 用户配置（从环境变量读取）
const TOKEN = process.env.HAOZHU_TOKEN || '';
const PROJECT_ID = process.env.HAOZHU_PROJECT || '106936';
const SPECIAL = process.env.HAOZHU_SPECIAL || '6bfc9';
/**
 * 获取手机号
 * @param num 获取数量（豪猪网默认返回1个）
 */
export async function getPhone() {
    try {
        const url = `${API_BASE}/get_phone?token=${TOKEN}&project=${PROJECT_ID}&special=${SPECIAL}`;
        const res = await fetch(url, { timeout: 10000 });
        const json = await res.json();
        if (json.code === 200 && json.data) {
            // data 可能是字符串或数组
            const phones = Array.isArray(json.data) ? json.data : [json.data];
            return phones[0]?.toString() || null;
        }
        console.error('[豪猪网] 获取手机号失败:', json.msg);
        return null;
    }
    catch (err) {
        console.error('[豪猪网] 获取手机号异常:', err.message);
        return null;
    }
}
/**
 * 获取短信验证码
 * @param phone 手机号
 * @param retryCount 重试次数
 * @param retryInterval 重试间隔(ms)
 */
export async function getMessage(phone, retryCount = 12, retryInterval = 5000) {
    for (let i = 0; i < retryCount; i++) {
        try {
            const url = `${API_BASE}/get_message?token=${TOKEN}&project=${PROJECT_ID}&phone=${phone}`;
            const res = await fetch(url, { timeout: 10000 });
            const json = await res.json();
            if (json.code === 200 && json.data) {
                const content = json.data.toString();
                // 提取6位数字验证码
                const match = content.match(/(\d{6})/);
                if (match) {
                    console.log(`[豪猪网] 手机号 ${phone} 收到验证码: ${match[1]}`);
                    return match[1];
                }
            }
            console.log(`[豪猪网] 等待短信... (${i + 1}/${retryCount})`);
            await sleep(retryInterval);
        }
        catch (err) {
            console.error('[豪猪网] 获取短信异常:', err.message);
            await sleep(retryInterval);
        }
    }
    console.error(`[豪猪网] 手机号 ${phone} 获取验证码超时`);
    return null;
}
/**
 * 将手机号加入黑名单（释放号码）
 * @param phone 手机号
 */
export async function addBlacklist(phone) {
    try {
        const url = `${API_BASE}/add_blacklist?token=${TOKEN}&project=${PROJECT_ID}&phone=${phone}`;
        const res = await fetch(url, { timeout: 10000 });
        const json = await res.json();
        return json.code === 200;
    }
    catch (err) {
        console.error('[豪猪网] 拉黑异常:', err.message);
        return false;
    }
}
/**
 * 取消手机号（释放回池）
 * @param phone 手机号
 */
export async function cancelPhone(phone) {
    try {
        const url = `${API_BASE}/cancel?token=${TOKEN}&project=${PROJECT_ID}&phone=${phone}`;
        const res = await fetch(url, { timeout: 10000 });
        const json = await res.json();
        return json.code === 200;
    }
    catch (err) {
        console.error('[豪猪网] 取消号码异常:', err.message);
        return false;
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// 导出配置检查函数
export function checkConfig() {
    if (!TOKEN) {
        console.error('[豪猪网] 错误：未设置 HAOZHU_TOKEN 环境变量');
        return false;
    }
    console.log('[豪猪网] 配置检查通过');
    return true;
}
export { TOKEN, PROJECT_ID, SPECIAL };
