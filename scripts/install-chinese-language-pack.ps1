# 安装 Cursor/VS Code 简体中文语言包并设置显示语言
$ErrorActionPreference = 'Stop'
$log = Join-Path $PSScriptRoot 'install-zh-log.txt'
"start $(Get-Date -Format o)" | Set-Content $log -Encoding UTF8

$cursorCandidates = @(
  'D:\Program Files\cursor\bin\cursor.cmd',
  "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe",
  'cursor'
)
$cursor = $cursorCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $cursor) {
  $cursor = (Get-Command cursor -ErrorAction SilentlyContinue).Source
}
if (-not $cursor) {
  '未找到 cursor 命令，请从 Cursor 命令面板安装 Chinese (Simplified) Language Pack' | Add-Content $log
  exit 1
}
"cursor: $cursor" | Add-Content $log

$vsix = Join-Path $env:TEMP 'vscode-language-pack-zh-hans.vsix'
$url = 'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-ceintl/vsextensions/vscode-language-pack-zh-hans/1.105.2025101509/vspackage'
try {
  Invoke-WebRequest -Uri $url -OutFile $vsix -UseBasicParsing
  "downloaded bytes: $((Get-Item $vsix).Length)" | Add-Content $log
} catch {
  "download failed: $_" | Add-Content $log
  exit 1
}

& $cursor --install-extension $vsix --force 2>&1 | Add-Content $log
& $cursor --install-extension MS-CEINTL.vscode-language-pack-zh-hans --force 2>&1 | Add-Content $log

$localeDir = Join-Path $env:APPDATA 'Cursor\User'
New-Item -ItemType Directory -Force -Path $localeDir | Out-Null
@{ locale = 'zh-cn' } | ConvertTo-Json | Set-Content (Join-Path $localeDir 'locale.json') -Encoding UTF8
'locale.json written' | Add-Content $log

"done $(Get-Date -Format o). 请完全退出 Cursor 后重新打开。" | Add-Content $log
Write-Host '安装完成。请完全退出 Cursor 后重新打开，界面应为简体中文。'
Write-Host "日志: $log"
