#!/usr/bin/env python3
"""
批量注册压力测试 - 10轮
结果保存到 batch_results.json
"""
import json
import subprocess
import sys
import time
import random

results = []

for i in range(1, 11):
    print(f"\n{'='*50}")
    print(f"第 {i}/10 轮注册")
    print(f"{'='*50}")

    try:
        proc = subprocess.run(
            [sys.executable, "server/register_engine.py", "--single"],
            capture_output=True,
            text=True,
            timeout=120,
            cwd="/mnt/agents/output/app"
        )

        # 从stderr提取日志
        for line in proc.stderr.splitlines():
            if "[注册引擎]" in line:
                print(line)

        # 从stdout解析JSON结果
        try:
            result = json.loads(proc.stdout.strip().splitlines()[-1])
        except:
            result = {"success": False, "error": "无法解析输出", "raw": proc.stdout[:500]}

        result["round"] = i
        result["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
        results.append(result)

        status = "成功" if result.get("success") else f"失败: {result.get('error', '未知')}"
        phone = result.get("phone", "N/A")
        print(f"\n第{i}轮结果: {status} | 手机号: {phone}")

    except subprocess.TimeoutExpired:
        print(f"第{i}轮: 超时")
        results.append({"round": i, "success": False, "error": "超时", "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")})
    except Exception as e:
        print(f"第{i}轮: 异常 - {e}")
        results.append({"round": i, "success": False, "error": str(e), "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")})

    # 保存中间结果
    with open("batch_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 轮间间隔（最后1轮不需要间隔）
    if i < 10:
        wait = random.uniform(10, 20)
        print(f"等待 {wait:.1f} 秒后下一轮...")
        time.sleep(wait)

# 最终统计
success_count = sum(1 for r in results if r.get("success"))
print(f"\n{'='*50}")
print(f"压力测试完成: {success_count}/10 成功")
print(f"结果已保存到 batch_results.json")
print(f"{'='*50}")

# 打印成功账号
print("\n成功注册的账号:")
for r in results:
    if r.get("success"):
        print(f"  第{r['round']}轮: {r['phone']} / {r.get('password', 'Test1234')} | {r.get('remark', '')}")
