#!/usr/bin/env python3
"""
Express 后端调用的 Python wrapper
通过 stdout JSON 通信
"""

import asyncio
import json
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from register_engine import register_single, register_batch, HAS_PLAYWRIGHT


async def run_single():
    """注册单个账号"""
    if not HAS_PLAYWRIGHT:
        return {"success": False, "error": "playwright 未安装，请运行: pip install playwright && python -m playwright install chromium"}

    result = await register_single(human_like=True)
    return result


async def run_batch(count):
    """批量注册"""
    if not HAS_PLAYWRIGHT:
        return [{"success": False, "error": "playwright 未安装"}]

    results = await register_batch(count=count, human_like=True)
    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--single", action="store_true", help="注册单个")
    parser.add_argument("--batch", type=int, default=0, help="批量注册")
    args = parser.parse_args()

    if args.single:
        result = asyncio.run(run_single())
        print(json.dumps(result, ensure_ascii=False))
    elif args.batch > 0:
        results = asyncio.run(run_batch(args.batch))
        print(json.dumps(results, ensure_ascii=False))
    else:
        # 测试模式
        print(json.dumps({"status": "ok", "playwright": HAS_PLAYWRIGHT}, ensure_ascii=False))
