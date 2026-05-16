@echo off
chcp 65001 >nul
set SRC=%USERPROFILE%\.vscode\extensions\ms-ceintl.vscode-language-pack-zh-hans-1.110.2026041514
set DST=%USERPROFILE%\.cursor\extensions\ms-ceintl.vscode-language-pack-zh-hans-1.110.2026041514
set CURSOR=D:\Program Files\cursor\bin\cursor.cmd

if not exist "%SRC%" (
  echo 未在 VS Code 扩展目录找到中文语言包，请在 Cursor 扩展市场搜索并安装：
  echo Chinese ^(Simplified^) Language Pack
  pause
  exit /b 1
)

if not exist "%DST%" (
  echo 正在复制语言包到 Cursor 扩展目录...
  robocopy "%SRC%" "%DST%" /E /NFL /NDL /NJH /NJS
)

echo {"locale":"zh-cn"}> "%APPDATA%\Cursor\User\locale.json"

if exist "%CURSOR%" (
  "%CURSOR%" --install-extension MS-CEINTL.vscode-language-pack-zh-hans --force
)

echo.
echo 完成。请完全退出 Cursor（托盘也退出）后重新打开。
echo 若仍为英文：Ctrl+Shift+P -^> Configure Display Language -^> zh-cn
pause
