<#
.SYNOPSIS
  Sor Bakalım — Non-Destructive Concurrent Baseline Load & Security Test (Windows PowerShell + curl.exe --parallel)
  Uses a temporary curl config file (-K) for fast, reliable parallel execution.
  NEVER commit real credentials to this file.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tests\load-test.ps1 -Levels 5,10,25,50
#>
param(
  [string]$Levels = "5,10,25,50",
  [string]$SupabaseUrl = "https://fzxrqvobatablbtssggo.supabase.co",
  [string]$SupabaseAnonKey = "sb_publishable_orCsNwYborsnhOhixAez_Q_H_Aw73tM"
)

$ErrorActionPreference = "Stop"
$LevelList = @($Levels.Split(",") | ForEach-Object { [int]$_.Trim() } | Where-Object { $_ -gt 0 })

function Invoke-CurlParallel {
  param(
    [string]$Label,
    [string]$Url,
    [string]$Method,
    [int]$Concurrency,
    [string]$Body = ""
  )

  $tmpCfg = [System.IO.Path]::GetTempFileName()
  try {
    $cfgLines = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $Concurrency; $i++) {
      if ($i -gt 0) { $cfgLines.Add("next") }
      $cfgLines.Add("url = `"$Url`"")
      $cfgLines.Add("request = `"$Method`"")
      $cfgLines.Add("header = `"apikey: $SupabaseAnonKey`"")
      $cfgLines.Add("header = `"Accept: application/json`"")
      if ($Method -eq "POST") {
        $cfgLines.Add("header = `"Content-Type: application/json`"")
        $escapedBody = $Body.Replace('"', '\"')
        $cfgLines.Add("data-raw = `"$escapedBody`"")
      }
      $cfgLines.Add("output = `"NUL`"")
      $cfgLines.Add("write-out = `"%{http_code}|%{time_total}|%{size_download}\n`"")
      $cfgLines.Add("max-time = 15")
    }
    [System.IO.File]::WriteAllLines($tmpCfg, $cfgLines)

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $raw = & curl.exe -s --parallel --parallel-immediate --parallel-max $Concurrency -K $tmpCfg
    $sw.Stop()

    $lines = @($raw | Where-Object { $_ -and $_.Trim().Length -gt 0 })
    $codes = @()
    $timesMs = @()
    $sizes = @()
    foreach ($ln in $lines) {
      $parts = $ln.Trim().Split("|")
      if ($parts.Length -ge 3) {
        $codes += [int]$parts[0]
        $timesMs += [int]([double]::Parse($parts[1], [System.Globalization.CultureInfo]::InvariantCulture) * 1000)
        $sizes += [int]$parts[2]
      }
    }

    $sorted = $timesMs | Sort-Object
    $ok200 = ($codes | Where-Object { $_ -eq 200 }).Count
    $non200 = $codes.Count - $ok200
    $p50 = if ($sorted.Count -gt 0) { $sorted[[Math]::Floor(($sorted.Count - 1) * 0.50)] } else { 0 }
    $p95 = if ($sorted.Count -gt 0) { $sorted[[Math]::Floor(($sorted.Count - 1) * 0.95)] } else { 0 }
    $max = if ($sorted.Count -gt 0) { $sorted[$sorted.Count - 1] } else { 0 }
    $avgSize = if ($sizes.Count -gt 0) { [Math]::Round(($sizes | Measure-Object -Average).Average) } else { 0 }
    $statusSummary = ($codes | Group-Object | ForEach-Object { "$($_.Name):$($_.Count)" }) -join ", "

    Write-Output ("[{0}] concurrency={1} | ok200={2}/{1} | non200={3}/{1} | p50={4}ms | p95={5}ms | max={6}ms | wall={7}ms | avg_bytes={8} | statuses=({9})" -f $Label, $Concurrency, $ok200, $non200, $p50, $p95, $max, $sw.ElapsedMilliseconds, $avgSize, $statusSummary)
  } finally {
    if (Test-Path $tmpCfg) { Remove-Item $tmpCfg -Force -ErrorAction SilentlyContinue }
  }
}

Write-Output "=== Sor Bakalim Baseline Concurrent Load & RLS Test ==="
$catUrl = "$SupabaseUrl/rest/v1/game_categories?select=*&order=created_at.asc"
foreach ($lvl in $LevelList) {
  Invoke-CurlParallel -Label "game_categories GET" -Url $catUrl -Method "GET" -Concurrency $lvl
}

$rpcUrl = "$SupabaseUrl/rest/v1/rpc/consume_game_credit"
Invoke-CurlParallel -Label "SECURITY consume_game_credit ANON" -Url $rpcUrl -Method "POST" -Concurrency 5 -Body "{}"

$adminRpcUrl = "$SupabaseUrl/rest/v1/rpc/admin_add_credits"
Invoke-CurlParallel -Label "SECURITY admin_add_credits ANON" -Url $adminRpcUrl -Method "POST" -Concurrency 5 -Body "{`"target_email`":`"test@example.com`",`"amount`":1}"

$creditsUrl = "$SupabaseUrl/rest/v1/user_game_credits?select=*"
Invoke-CurlParallel -Label "SECURITY user_game_credits ANON" -Url $creditsUrl -Method "GET" -Concurrency 5

Write-Output "=== Done ==="
