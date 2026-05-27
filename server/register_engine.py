#!/usr/bin/env python3
"""
企业预警通(qyyjt.cn) 真实注册引擎 - 纯PIL版(无cv2依赖)
"""

import asyncio
import base64
import json
import math
import random
import requests
import sys
import time
import traceback
from io import BytesIO

from PIL import Image

# 尝试导入 playwright
try:
    from playwright.async_api import async_playwright
    HAS_PLAYWRIGHT = True
    print("[初始化] Playwright 已加载", file=sys.stderr)
except ImportError as e:
    HAS_PLAYWRIGHT = False
    print(f"[初始化错误] Playwright 未安装: {e}", file=sys.stderr)

# ═══════════════════════════════════════════════════════════════════
#  配置
# ═══════════════════════════════════════════════════════════════════

BASE_URL = "https://h5.haozhuma.com"
USERNAME = "todayis0607"
PASSWORD = "Kevinyang6011"
SID = "49827"
QYYJT_URL = "https://www.qyyjt.cn/user/login"
DEFAULT_PASSWORD = "Test1234"

REGIONS = [(20, 20, 110, 100), (140, 20, 220, 100), (20, 110, 110, 190), (140, 110, 220, 190)]


def log(msg):
    print(f"[注册引擎] {msg}", file=sys.stderr)
    sys.stderr.flush()


# ═══════════════════════════════════════════════════════════════════
#  纯PIL验证码识别（无需cv2）
# ═══════════════════════════════════════════════════════════════════

def rgb_to_hsv_pixel(r, g, b):
    """单像素RGB转HSV，返回(h, s, v)"""
    r_, g_, b_ = r / 255.0, g / 255.0, b / 255.0
    mx = max(r_, g_, b_)
    mn = min(r_, g_, b_)
    df = mx - mn
    if mx == mn:
        h = 0
    elif mx == r_:
        h = (60 * ((g_ - b_) / df) + 360) % 360
    elif mx == g_:
        h = (60 * ((b_ - r_) / df) + 120) % 360
    else:
        h = (60 * ((r_ - g_) / df) + 240) % 360
    s = 0 if mx == 0 else df / mx
    return h, s, mx


def find_color_peak(img, x1, y1, x2, y2):
    """在区域中找饱和度最高的点，返回((x,y), color_rgb)"""
    region = img.crop((x1, y1, x2, y2))
    pixels = region.load()
    w, h = region.size
    best_sat, best_pt, best_color = -1, (0, 0), (0, 0, 0)
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y][:3]
            _, s, _ = rgb_to_hsv_pixel(r, g, b)
            if s > best_sat:
                best_sat = s
                best_pt = (x1 + x, y1 + y)
                best_color = (r, g, b)
    return best_pt, best_color


def color_dist(c1, c2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))


def solve_captcha_pil(img, order_img):
    """纯PIL验证码求解"""
    # 在4个区域中找饱和度峰值（图标中心）
    centers, colors = [], []
    for x1, y1, x2, y2 in REGIONS:
        pt, c = find_color_peak(img, x1, y1, x2, y2)
        centers.append(pt)
        colors.append(c)

    # 在order图片的4个等分区域中找饱和度峰值（顺序提示）
    ow, oh = order_img.size
    order_colors = []
    for i in range(4):
        xs = int(ow * (i / 4 + 0.12))
        xe = int(ow * ((i + 1) / 4 - 0.12))
        if xe <= xs:
            xe = xs + 5
        pt, c = find_color_peak(order_img, xs, 0, xe, oh)
        order_colors.append(c)

    # 按顺序匹配颜色
    clicks, used = [], set()
    for oc in order_colors:
        best, bd = None, float("inf")
        for ii, c in enumerate(colors):
            if ii in used:
                continue
            d = color_dist(oc, c)
            if d < bd:
                bd, best = d, ii
        if best is not None:
            clicks.append({"x": centers[best][0], "y": centers[best][1]})
            used.add(best)
    return clicks


# ═══════════════════════════════════════════════════════════════════
#  豪猪网登录
# ═══════════════════════════════════════════════════════════════════

def haozhuma_login():
    for attempt in range(1, 6):
        s = requests.Session()
        s.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "Referer": f"{BASE_URL}/login.php",
        })
        try:
            td = s.get(f"{BASE_URL}/time.php", timeout=30).json()
            if "token" not in td:
                continue

            cd = s.post(f"{BASE_URL}/Verificationcode.php",
                        json={"token": td["token"], "timestamp": td["timestamp"]},
                        timeout=30).json()

            img = Image.open(BytesIO(base64.b64decode(cd["image_data"]))).convert("RGB")
            order_img = Image.open(BytesIO(base64.b64decode(cd["order"]))).convert("RGB")
            clicks = solve_captcha_pil(img, order_img)

            result = s.post(f"{BASE_URL}/login.php",
                          json={"clicks": clicks, "captcha_id": cd["captcha_id"],
                                "username": USERNAME, "password": PASSWORD},
                          timeout=30).json()

            if result.get("code") == 0:
                log(f"豪猪网登录成功 (尝试{attempt})")
                return s, result
            else:
                log(f"登录尝试{attempt}失败: {result.get('msg')}")
        except Exception as e:
            log(f"登录尝试{attempt}异常: {e}")
            continue
    return None, {"code": -1, "msg": "登录失败"}


# ═══════════════════════════════════════════════════════════════════
#  豪猪网 API
# ═══════════════════════════════════════════════════════════════════

def get_phone(session, token):
    resp = session.get(f"https://api.dwtmcp.cn/sms/?api=getPhone&token={token}&sid={SID}", timeout=30)
    return resp.json()


def read_sms(session, token, phone, max_retries=12):
    for i in range(max_retries):
        resp = session.get(f"https://api.dwtmcp.cn/sms/?api=getMessage&token={token}&sid={SID}&phone={phone}", timeout=30)
        data = resp.json()
        log(f"读短信 {i+1}/{max_retries}: code={data.get('code')}, yzm={data.get('yzm')}")

        if data.get("code") == "0" and data.get("yzm") and str(data["yzm"]) != "0":
            return str(data["yzm"])
        time.sleep(3)
    return None


def cancel_recv(session, token, phone):
    try:
        session.get(f"https://api.dwtmcp.cn/sms/?api=cancelRecv&token={token}&sid={SID}&phone={phone}", timeout=10)
    except:
        pass


# ═══════════════════════════════════════════════════════════════════
#  预警通浏览器自动化
# ═══════════════════════════════════════════════════════════════════

async def trigger_sms(page, phone):
    log("预警通: 打开登录页")
    await page.goto(QYYJT_URL, wait_until="domcontentloaded", timeout=15000)
    await asyncio.sleep(2)

    log("预警通: 点击验证码登录标签")
    await page.click("text=验证码登录/注册")
    await asyncio.sleep(0.5)

    log("预警通: 输入手机号")
    await page.fill('input[placeholder*="手机号"]', phone)
    await asyncio.sleep(0.3)

    log("预警通: 勾选协议")
    checkbox = await page.query_selector('input[type="checkbox"]')
    if checkbox:
        is_checked = await checkbox.is_checked()
        if not is_checked:
            await checkbox.click()
            await asyncio.sleep(0.2)

    log("预警通: 点击获取验证码")
    await page.click('button:has-text("获取验证码")')
    await asyncio.sleep(5)


async def complete_registration(page, phone, sms_code, password=DEFAULT_PASSWORD):
    # 复用trigger_sms后的同一页面
    log("预警通: 在当前页面输入验证码")

    phone_input = await page.query_selector('input[placeholder*="手机号"]')
    if phone_input:
        await phone_input.fill(phone)
        await asyncio.sleep(0.3)

    checkbox = await page.query_selector('input[type="checkbox"]')
    if checkbox and not await checkbox.is_checked():
        await checkbox.click()
        await asyncio.sleep(0.2)

    log(f"预警通: 输入验证码 {sms_code}")
    await page.fill('input[placeholder*="请输入验证码"]', sms_code)
    await asyncio.sleep(0.5)

    # 尝试多种方式点击登录按钮
    log("预警通: 点击登录")
    login_selectors = [
        'button:has-text("登录")',
        'button:has-text("登 录")',
        'button.login-btn',
        'button[type="submit"]',
        'button.ant-btn-primary',
        'button:has-text("立即登录")',
        'button:has-text("确认")',
    ]
    clicked = False
    for sel in login_selectors:
        try:
            elem = await page.query_selector(sel)
            if elem and await elem.is_visible():
                await elem.click()
                clicked = True
                log(f"预警通: 使用选择器 {sel} 点击成功")
                break
        except:
            continue
    if not clicked:
        await page.evaluate('document.querySelectorAll("button")[document.querySelectorAll("button").length-1].click()')
        log("预警通: 使用JS点击最后一个按钮")
    await asyncio.sleep(3)

    # 等待页面响应
    await asyncio.sleep(2)

    content = await page.content()
    url = page.url
    log(f"预警通: 当前URL={url}")

    # 多重登录成功检测
    has_token = await page.evaluate("""() => {
const tk = localStorage.getItem('a_tk') || localStorage.getItem('token') || localStorage.getItem('accessToken');
return !!tk;
}""")
    log(f"预警通: localStorage有token={has_token}")

    user_elements = await page.evaluate("""() => {
const indicators = ['[class*="logout"]','[class*="user-name"]','[class*="avatar"]','[class*="user-info"]','.ant-dropdown-trigger','[class*="header-right"]'];
for (const sel of indicators) { if (document.querySelector(sel)) return sel; }
return null;
}""")
    log(f"预警通: 用户元素={user_elements}")

    error_msg = await page.evaluate("""() => {
const el = document.querySelector('.ant-message-error, .ant-notification-notice-message, [class*="error"]');
return el ? el.textContent : null;
}""")
    if error_msg:
        log(f"预警通: 检测到错误消息: {error_msg}")

    has_set_pwd = await page.evaluate("""() => {
return document.body.innerText.includes('设置密码') ||
document.body.innerText.includes('请设置密码') ||
document.body.innerText.includes('设置登录密码') ||
document.querySelector('input[placeholder*="设置密码"], input[placeholder*="新密码"]') !== null;
}""")
    log(f"预警通: 需要设置密码={has_set_pwd}")

    login_success = has_token or user_elements

    if has_set_pwd:
        log("预警通: 新用户，需要设置密码")
        pwd_inputs = await page.query_selector_all('input[type="password"]')
        if len(pwd_inputs) >= 2:
            await pwd_inputs[0].fill(password)
            await asyncio.sleep(0.3)
            await pwd_inputs[1].fill(password)
            await asyncio.sleep(0.3)
            confirm_selectors = [
                'button:has-text("确认")',
                'button:has-text("确定")',
                'button:has-text("完成")',
                'button:has-text("提交")',
                'button[type="submit"]',
                'button.ant-btn-primary',
            ]
            for sel in confirm_selectors:
                try:
                    btn = await page.query_selector(sel)
                    if btn and await btn.is_visible():
                        await btn.click()
                        log(f"预警通: 使用 {sel} 提交密码")
                        break
                except:
                    continue
            await asyncio.sleep(2)
        return "registered_new", password

    elif login_success:
        log("预警通: 登录成功（通过token或用户元素确认）")
        await asyncio.sleep(1)
        still_need_pwd = await page.evaluate("""() => {
return document.body.innerText.includes('设置密码') ||
document.querySelector('input[type="password"]') !== null;
}""")
        if still_need_pwd:
            log("预警通: 登录后出现密码设置弹窗")
            pwd_inputs = await page.query_selector_all('input[type="password"]')
            if len(pwd_inputs) >= 1:
                for inp in pwd_inputs:
                    await inp.fill(password)
                    await asyncio.sleep(0.3)
                confirm_btns = ['button:has-text("确认")', 'button:has-text("确定")', 'button:has-text("完成")', 'button.ant-btn-primary']
                for sel in confirm_btns:
                    try:
                        btn = await page.query_selector(sel)
                        if btn and await btn.is_visible():
                            await btn.click()
                            log(f"预警通: 使用 {sel} 提交密码")
                            break
                    except:
                        continue
                await asyncio.sleep(2)
            return "registered_new", password
        return "login_existing", password

    elif error_msg:
        return f"error: {error_msg}", None

    else:
        log(f"预警通: 登录后页面内容前500字: {content[:500]}")
        return "unknown", None


# ═══════════════════════════════════════════════════════════════════
#  主注册流程
# ═══════════════════════════════════════════════════════════════════

async def register_single(password=DEFAULT_PASSWORD):
    if not HAS_PLAYWRIGHT:
        return {"success": False, "error": "playwright未安装"}

    result = {"success": False, "phone": "", "password": "", "status": "", "remark": ""}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="zh-CN",
        )
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});window.chrome={runtime:{}};")
        page = await context.new_page()

        try:
            # 步骤1: 登录豪猪网
            log("步骤1: 登录豪猪网")
            session, login_result = haozhuma_login()
            if not session:
                result["error"] = login_result.get("msg", "豪猪网登录失败")
                return result
            token = login_result["token"]

            # 步骤2: 获取手机号
            log("步骤2: 获取手机号")
            phone_data = get_phone(session, token)
            if phone_data.get("code") != "0" or not phone_data.get("phone"):
                if "token" in phone_data.get("msg", "").lower():
                    session, login_result = haozhuma_login()
                    token = login_result["token"]
                    phone_data = get_phone(session, token)
                if phone_data.get("code") != "0" or not phone_data.get("phone"):
                    result["error"] = phone_data.get("msg", "取号失败")
                    return result

            phone = phone_data["phone"]
            result["phone"] = phone
            log(f"手机号: {phone}")

            # 步骤3: 触发短信
            log("步骤3: 预警通触发短信")
            await trigger_sms(page, phone)

            # 步骤4: 读短信
            log("步骤4: 读取短信")
            sms_code = read_sms(session, token, phone)
            if not sms_code:
                result["error"] = "短信超时"
                cancel_recv(session, token, phone)
                return result
            log(f"验证码: {sms_code}")

            # 步骤5: 完成注册
            log("步骤5: 预警通注册")
            status, pwd = await complete_registration(page, phone, sms_code, password)

            if status == "registered_new":
                result.update({"success": True, "password": pwd, "status": "success", "remark": "新用户注册"})
            elif status == "login_existing":
                result.update({"success": True, "password": password, "status": "success", "remark": "已有用户"})
            else:
                result["error"] = f"状态未知: {status}"

            # 步骤6: 释放
            log("步骤6: 释放手机号")
            cancel_recv(session, token, phone)

        except Exception as e:
            result["error"] = f"异常: {str(e)}"
            log(f"异常: {traceback.format_exc()}")
        finally:
            await context.close()
            await browser.close()

    return result


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--single", action="store_true")
    parser.add_argument("--batch", type=int, default=0)
    args = parser.parse_args()

    if args.single:
        r = asyncio.run(register_single())
        print(json.dumps(r, ensure_ascii=False))
    elif args.batch > 0:
        results = []
        for i in range(args.batch):
            log(f"\n===== 账号 {i+1}/{args.batch} =====")
            r = asyncio.run(register_single())
            results.append(r)
            if i < args.batch - 1:
                time.sleep(random.uniform(10, 30))
        print(json.dumps(results, ensure_ascii=False))
    else:
        print(json.dumps({"status": "ok", "playwright": HAS_PLAYWRIGHT}, ensure_ascii=False))
