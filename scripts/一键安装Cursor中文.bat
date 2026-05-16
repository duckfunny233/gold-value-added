@echo off
chcp 65001 >nul
title 安装 Cursor 简体中文
color 0A

echo ========================================
echo   Cursor 简体中文 - 一键安装
echo ========================================
echo.

set SRC=%USERPROFILE%\.vscode\extensions\ms-ceintl.vscode-language-pack-zh-hans-1.110.2026041514
set DST=%USERPROFILE%\.cursor\extensions\ms-ceintl.vscode-language-pack-zh-hans-1.110.2026041514
set CURSOR=D:\Program Files\cursor\bin\cursor.cmd

if exist "%SRC%" (
  if not exist "%DST%" (
    echo [1/3] 正在复制中文语言包到 Cursor ...
    robocopy "%SRC%" "%DST%" /E /NFL /NDL /NJH /NJS >nul
    if exist "%DST%" (echo       复制成功.) else (echo       复制失败，请右键以管理员运行本脚本.)
  ) else (
    echo [1/3] 语言包已存在，跳过复制.
  )
) else (
  echo [1/3] 未找到 VS Code 中文包，尝试在线安装 ...
  if exist "%CURSOR%" (
    "%CURSOR%" --install-extension MS-CEINTL.vscode-language-pack-zh-hans --force
  )
)

echo [2/3] 写入显示语言 zh-cn ...
(
  echo {
  echo   "locale": "zh-cn"
  echo }
) > "%APPDATA%\Cursor\User\locale.json"

echo [3/3] 完成.
echo.
echo ----------------------------------------
echo 请现在：
echo   1. 完全退出 Cursor（包括托盘图标）
echo   2. 重新打开 Cursor
echo   3. 若仍英文：按 Ctrl+Shift+P
echo      输入 display language
echo      选 zh-cn 后重启
echo ----------------------------------------
echo.
pause
