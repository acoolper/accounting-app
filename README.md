══════════════════════════════════════════════════════════════
记账本桌面应用 — macOS 打包产物地址
══════════════════════════════════════════════════════════════

📦 DMG 安装包（推荐分发）
完整路径：/Users/apple/Desktop/work_zone/accounting-app/release/记账本-1.0.0-arm64.dmg
文件大小：128 MB
支持系统：macOS Apple Silicon（M1/M2/M3，2020 年后机型）

📦 APP 目录（未压缩，用于测试）
完整路径：/Users/apple/Desktop/work_zone/accounting-app/release/mac-arm64/记账本.app
文件大小：351 MB

📋 其他文件
增量更新描述：release/记账本-1.0.0-arm64.dmg.blockmap（133 KB）

⚠️ 注意：
- 当前为 arm64 only，Intel Mac 无法运行
- 如需支持 Intel Mac，需打 universal 版本（体积约 2 倍）
- DMG 未签名，首次打开需右键 → 打开 → 仍要打开

══════════════════════════════════════════════════════════════
Windows 打包说明
══════════════════════════════════════════════════════════════

❌ 无法在 macOS arm64 上直接生成 Windows exe

技术原因：
- better-sqlite3 是 C++ 原生模块，必须为目标平台编译
- macOS 无法编译 Windows 的 .node 二进制文件
- electron-builder 已废弃内置 Docker 支持

✅ 推荐方案：GitHub Actions 云端构建（免费）

步骤：
1. 创建 GitHub 仓库
2. 推送代码（已包含 .github/workflows/build.yml）
3. 自动触发构建或手动触发
4. 下载产物：记账本 Setup 1.0.0.exe

详细教程：
- 文件：Windows打包教程.txt（10KB，204 行）
- 或查看：.github/workflows/build.yml

✅ 备选方案：在 Windows 机器上手动打包

需求：
- Windows 10/11 64 位
- Node.js 22.x
- Python 3.11+
- 按教程执行 3 条命令即可

══════════════════════════════════════════════════════════════
目标环境明确时能否提前下载？
══════════════════════════════════════════════════════════════

可以提前下载：
✅ Electron 二进制（通过镜像）
✅ npm 依赖包
✅ 更好的 sqlite3 预编译版本（部分）

但必须在此平台完成：
❌ better-sqlite3 原生模块编译（需要目标平台工具链）
❌ 最终打包（NSIS/DMG/AppImage 生成器依赖平台工具）

结论：
即使提前下载所有依赖，仍需在目标平台执行最终编译和打包。
GitHub Actions 是最简单的跨平台构建方案。

══════════════════════════════════════════════════════════════