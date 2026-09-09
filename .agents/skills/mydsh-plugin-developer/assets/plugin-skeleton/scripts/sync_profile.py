# -*- coding: utf-8 -*-
"""把最新构建产物同步到已安装 profile 里的插件（file: 依赖是复制，需手动刷新）。

用法：python scripts/sync_profile.py
按需修改 PROFS 中的 profile 名与插件包名。
"""
import os
import shutil

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROFS = [
    os.path.expanduser(r"~\.dsh\profiles\web\node_modules\@yourscope\your-plugin"),
    os.path.expanduser(r"~\.dsh\profiles\headless\node_modules\@yourscope\your-plugin"),
]

for dst in PROFS:
    if not os.path.isdir(dst):
        print("skip missing:", dst)
        continue
    src_lib, dst_lib = os.path.join(SRC, "lib"), os.path.join(dst, "lib")
    shutil.rmtree(dst_lib, ignore_errors=True)
    shutil.copytree(src_lib, dst_lib)
    shutil.copy2(os.path.join(SRC, "cordis.patch.yml"), os.path.join(dst, "cordis.patch.yml"))
    shutil.copy2(os.path.join(SRC, "package.json"), os.path.join(dst, "package.json"))
    print("synced:", dst)
    print("  lib:", sorted(os.listdir(dst_lib)))
