# Run from the root of the s3v-xi repo AFTER copying the RSFC League files in.
# Deletes every git-tracked file that is not part of RSFC League (the old
# cricket app, Supabase login, tournaments, predictor league).
param([string]$List = ".rsfc-files")
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $List)) {
  Write-Error "Missing $List (it ships in the RSFC League zip). Run this from the repo root."
  exit 1
}

$keep = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
Get-Content -LiteralPath $List | Where-Object { $_.Trim() -ne "" } | ForEach-Object { [void]$keep.Add($_.Trim()) }

$removed = 0
foreach ($f in (git -c core.quotepath=off ls-files)) {
  if (-not $keep.Contains($f)) {
    git --literal-pathspecs rm -q -- "$f"
    if ($LASTEXITCODE -ne 0) { throw "git rm failed for $f" }
    Write-Host "removed  $f"
    $removed++
  }
}

git --literal-pathspecs rm -q -f --ignore-unmatch -- $List | Out-Null
if (Test-Path -LiteralPath $List) { Remove-Item -LiteralPath $List -Force }
Write-Host "Done: removed $removed old file(s). Review with 'git status', then commit."
