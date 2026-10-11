$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules/lucide-react')) {
    npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось установить зависимости' }
}
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать интерфейс' }
python server.py
