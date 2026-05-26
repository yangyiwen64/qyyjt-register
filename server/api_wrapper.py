#!/usr/bin/env python3
"""
Express 后端调用的 Python wrapper
"""

import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from register_engine import register_single, HAS_PLAYWRIGHT


async def run_single():
    """注册单个账号"""
    if not HAS_PLAYWRIGHT:
        return {"success": False, "error": "playwright未安装"}
    result = await register_single()
    return result


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--single", action="store_true")
    parser.add_argument("--batch", type=int, default=0)
    args = parser.parse_args()

    if args.single:
        result = asyncio.run(run_single())
        print(json.dumps(result, ensure_ascii=False))
    elif args.batch > 0:
        results = []
        for i in range(args.batch):
            result = asyncio.run(run_single())
            results.append(result)
        print(json.dumps(results, ensure_ascii=False))
    else:
        print(json.dumps({"status": "ok", "playwright": HAS_PLAYWRIGHT}, ensure_ascii=False))
