#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dsh 插件项目脚手架：把 assets/plugin-skeleton 复制到目标目录并替换占位符。

用法:
    python scripts/scaffold_plugin.py <目标目录> [--name @scope/your-plugin] [--desc "一句话说明"]

示例:
    python scripts/scaffold_plugin.py D:/dev/my-plugin --name @me/my-plugin --desc "我的查询插件"
"""
import argparse
import os
import re
import shutil
import sys

SKELETON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "plugin-skeleton")

# 出现在 package.json / cordis.patch.yml / tsdown.config.ts / src/* 里的占位符
PACKAGE_PLACEHOLDER = "@yourscope/your-plugin"
ID_PLACEHOLDER = "my-plugin"
DESC_EN = "A dsh plugin that demonstrates the canonical structure (tool + skill + system prompt + client view)."
DESC_CN = "我的第一个 dsh 插件：提供一个查询工具 + 一个写作技能 + 系统提示引导。"


def replace_in_file(path, name, desc):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    text = text.replace(PACKAGE_PLACEHOLDER, name)
    text = text.replace("@yourscope\\your-plugin", name)  # Windows 反斜杠路径写法

    # 插件 id（cordis.patch.yml 的 id、src/index.ts 的 name、client 的 name）= 包名去掉 @scope/
    short = name.split("/")[-1]
    text = re.sub(r'"id": "my-plugin"', f'"id": "{short}"', text)
    # 兼容单/双引号两种写法
    text = re.sub(r"export const name = ['\"]my-plugin['\"]", f'export const name = "{short}"', text)

    # 描述占位符（可选）
    if desc:
        text = text.replace(DESC_EN, desc)
        text = text.replace(DESC_CN, desc)

    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def main():
    ap = argparse.ArgumentParser(description="生成 dsh 插件项目骨架")
    ap.add_argument("target", help="目标项目目录（会被创建）")
    ap.add_argument("--name", default="@yourscope/your-plugin", help="npm 包名，如 @me/my-plugin")
    ap.add_argument("--desc", default="", help="一句话描述")
    args = ap.parse_args()

    target = os.path.abspath(args.target)
    if os.path.exists(target) and os.listdir(target):
        print(f"[scaffold] 错误：目标目录非空：{target}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(target, exist_ok=True)
    for root, dirs, files in os.walk(SKELETON):
        rel = os.path.relpath(root, SKELETON)
        dst_dir = target if rel == "." else os.path.join(target, rel)
        os.makedirs(dst_dir, exist_ok=True)
        for fn in files:
            src = os.path.join(root, fn)
            dst = os.path.join(dst_dir, fn)
            shutil.copy2(src, dst)
            # 文本文件全部执行占位符替换（替换无副作用）
            if fn.endswith((".json", ".yml", ".yaml", ".ts", ".tsx", ".ps1", ".py", ".md")):
                replace_in_file(dst, args.name, args.desc)

    print(f"[scaffold] 已生成插件骨架：{target}")
    print(f"[scaffold] 包名：{args.name}")
    print("下一步：")
    print("  1) 编辑 src/index.ts / src/tool.ts / src/skill.ts / src/client/index.tsx 实现你的逻辑")
    print("  2) 按 scripts/build.ps1 内说明核对 dsh 缓存路径，运行: powershell -File scripts/build.ps1")
    print("  3) 安装: dsh plugin --profile web add file:<项目绝对路径>（自动加入 bundles）")
    print("  4) 测试: dsh --profile headless \"<你的问题>\"（需已配置 LLM key）")


if __name__ == "__main__":
    main()
