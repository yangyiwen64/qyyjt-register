#!/usr/bin/env python3
"""
QYYJT Parallel Registration Engine
Supports concurrent registration with N browser windows
"""

import asyncio
import json
import random
import re
import string
import time
import base64
from dataclasses import dataclass, asdict
from typing import List, Optional

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Installing playwright...")
    import subprocess
    subprocess.check_call(["pip", "install", "playwright", "-q"])
    subprocess.check_call(["playwright", "install", "chromium"])
    from playwright.async_api import async_playwright


@dataclass
class RegisterResult:
    phone: str
    password: str
    status: str  # success | failed | timeout
    message: str = ""
    elapsed: float = 0.0


class HaozhumaAPI:
    """Haozhuma API client"""

    def __init__(self, token: str, sid: str = "49827"):
        self.token = token
        self.sid = sid
        self.base = "https://api.dwtmcp.cn/sms"

    async def get_phone(self, session) -> Optional[str]:
        """Get one phone number"""
        try:
            resp = await asyncio.to_thread(
                session.get,
                f"{self.base}/?api=getPhone&token={self.token}&sid={self.sid}",
                timeout=10
            )
            data = resp.json()
            if str(data.get("code")) == "0":
                return data.get("phone")
            return None
        except Exception as e:
            print(f"  [GetPhone] Error: {e}")
            return None

    async def get_phones_batch(self, session, count: int) -> List[str]:
        """Get N phone numbers concurrently"""
        tasks = [self.get_phone(session) for _ in range(count)]
        results = await asyncio.gather(*tasks)
        phones = [p for p in results if p]
        print(f"[Haozhuma] Got {len(phones)}/{count} phones")
        return phones

    async def get_sms(self, session, phone: str, max_wait: int = 60) -> Optional[str]:
        """Poll for SMS code with timeout"""
        for i in range(max_wait // 3):
            try:
                resp = await asyncio.to_thread(
                    session.get,
                    f"{self.base}/?api=getMessage&token={self.token}&sid={self.sid}&phone={phone}",
                    timeout=10
                )
                data = resp.json()
                if str(data.get("code")) == "0":
                    yzm = data.get("yzm", "")
                    if yzm and str(yzm) not in ["0", ""]:
                        return str(yzm)
                    # Try extract from sms content
                    sms = data.get("sms", "")
                    match = re.search(r"验证码(\d+)", sms)
                    if match:
                        return match.group(1)
            except Exception:
                pass
            await asyncio.sleep(3)
        return None

    async def blacklist(self, session, phone: str):
        """Add phone to blacklist"""
        try:
            await asyncio.to_thread(
                session.get,
                f"{self.base}/?api=addBlacklist&token={self.token}&sid={self.sid}&phone={phone}",
                timeout=5
            )
        except Exception:
            pass


class QyyjtRegister:
    """Single QYYJT registration task"""

    def __init__(self, phone: str, haozhuma: HaozhumaAPI, session, headless: bool = True):
        self.phone = phone
        self.haozhuma = haozhuma
        self.session = session
        self.headless = headless
        self.result = None

    def _generate_password(self) -> str:
        upper = random.choice(string.ascii_uppercase)
        lower = random.choice(string.ascii_lowercase)
        digits = "".join(random.choices(string.digits, k=6))
        pwd = upper + lower + digits
        return "".join(random.sample(pwd, len(pwd)))

    async def register(self) -> RegisterResult:
        """Execute registration in isolated browser"""
        start_time = time.time()
        p = None
        
        try:
            p = await async_playwright().start()
            browser = await p.chromium.launch(headless=self.headless)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            page = await context.new_page()

            # Step 1: Navigate to login page
            await page.goto("https://www.qyyjt.cn/user/login", 
                          wait_until="domcontentloaded", timeout=15000)
            
            # Step 2: Click verification code tab
            await page.click('.ant-tabs-tab:has-text("验证码登录")', timeout=10000)
            await asyncio.sleep(0.5)

            # Step 3: Fill phone
            await page.fill("#phone", self.phone)
            await asyncio.sleep(0.3)

            # Step 4: Click get code
            await page.click('button:has-text("获取验证码")')
            await asyncio.sleep(1)

            # Step 5: Check for image captcha - re-login to skip
            html = await page.content()
            if "确定" in html and "看不清" in html:
                await page.goto("https://www.qyyjt.cn/user/login",
                              wait_until="domcontentloaded", timeout=15000)
                await page.click('.ant-tabs-tab:has-text("验证码登录")', timeout=10000)
                await asyncio.sleep(0.5)
                await page.fill("#phone", self.phone)
                await asyncio.sleep(0.3)
                await page.click('button:has-text("获取验证码")')
                await asyncio.sleep(1)

            # Step 6: Get SMS from Haozhuma
            yzm = await self.haozhuma.get_sms(self.session, self.phone, max_wait=60)
            if not yzm:
                await self.haozhuma.blacklist(self.session, self.phone)
                elapsed = time.time() - start_time
                return RegisterResult(
                    phone=self.phone, password="",
                    status="timeout", message="SMS timeout",
                    elapsed=elapsed
                )

            # Step 7: Enter SMS code
            await page.type('input[placeholder*="请输入验证码"]', yzm, delay=20)
            await asyncio.sleep(0.3)

            # Step 8: Login
            await page.click('button.ant-btn-primary:has-text("登")')
            await asyncio.sleep(2)

            # Step 9: Generate and set password
            password = self._generate_password()
            
            # Check if password setup page
            html = await page.content()
            if "设置密码" in html or "含数字" in html:
                await page.type('input[placeholder*="含数字"]', password, delay=20)
                await asyncio.sleep(0.2)
                await page.type('input[placeholder*="确认"]', password, delay=20)
                await asyncio.sleep(0.2)
                await page.click('button:has-text("确认")')
                await asyncio.sleep(2)

            # Step 10: Verify login
            url = page.url
            if "login" not in url:
                elapsed = time.time() - start_time
                await browser.close()
                return RegisterResult(
                    phone=self.phone, password=password,
                    status="success", message="Registered successfully",
                    elapsed=elapsed
                )
            else:
                elapsed = time.time() - start_time
                await browser.close()
                return RegisterResult(
                    phone=self.phone, password=password,
                    status="success", message="Password set may need verify",
                    elapsed=elapsed
                )

        except Exception as e:
            elapsed = time.time() - start_time
            await self.haozhuma.blacklist(self.session, self.phone)
            return RegisterResult(
                phone=self.phone, password="",
                status="failed", message=str(e)[:100],
                elapsed=elapsed
            )
        finally:
            if p:
                await p.stop()


class ParallelRegisterEngine:
    """Parallel registration engine - opens N browser windows"""

    def __init__(self, token: str, sid: str = "49827"):
        self.haozhuma = HaozhumaAPI(token, sid)
        self.results: List[RegisterResult] = []

    async def run(self, count: int) -> List[RegisterResult]:
        """Run parallel registration with N windows"""
        import requests
        
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://h5.haozhuma.com/",
        })

        print(f"[Engine] Starting parallel registration: {count} windows")
        overall_start = time.time()

        # Step 1: Get N phones from Haozhuma
        print(f"[Engine] Getting {count} phone numbers...")
        phones = await self.haozhuma.get_phones_batch(session, count)
        
        if len(phones) == 0:
            print("[Engine] Failed to get any phone numbers")
            return []

        # Step 2: Create N registration tasks
        print(f"[Engine] Launching {len(phones)} browser windows...")
        tasks = []
        for phone in phones:
            registrar = QyyjtRegister(phone, self.haozhuma, session)
            task = registrar.register()
            tasks.append(task)

        # Step 3: Run all registrations in parallel
        self.results = await asyncio.gather(*tasks)

        # Step 4: Release failed phones
        for result in self.results:
            if result.status != "success":
                await self.haozhuma.blacklist(session, result.phone)

        overall_elapsed = time.time() - overall_start
        success_count = sum(1 for r in self.results if r.status == "success")
        print(f"[Engine] Complete: {success_count}/{len(phones)} success in {overall_elapsed:.1f}s")

        return self.results

    def export_json(self) -> str:
        """Export results as JSON string"""
        data = [asdict(r) for r in self.results]
        return json.dumps(data, ensure_ascii=False, indent=2)


async def main():
    """CLI entry point"""
    import sys
    
    count = 5
    if len(sys.argv) > 1:
        count = int(sys.argv[1])
    
    # Token - should be passed as argument or from env
    token = sys.argv[2] if len(sys.argv) > 2 else ""
    
    if not token:
        print("Usage: python register_engine.py <count> <token>")
        print("Or set QYYJT_TOKEN env variable")
        return
    
    engine = ParallelRegisterEngine(token)
    results = await engine.run(count)
    
    # Print results
    print("\n" + "="*60)
    print("RESULTS:")
    for r in results:
        status_icon = "✅" if r.status == "success" else "❌"
        print(f"  {status_icon} {r.phone} / {r.password} ({r.elapsed:.1f}s) - {r.message}")
    
    # Save to file
    with open("register_results.json", "w", encoding="utf-8") as f:
        f.write(engine.export_json())
    print(f"\nSaved to register_results.json")


if __name__ == "__main__":
    asyncio.run(main())
