[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Target,

  [ValidatePattern('^[a-f0-9]{64}$')]
  [string]$SourceApproval = '1ad335a985c782e2b7c6acc13e4feeea38094b6af9e6967303b08c4a6ad720fe',

  [string]$Bulk = 'artifacts\non-sol-bulk-v1-delivery',

  [string]$Density = 'artifacts\non-sol-market-density-v2',

  [switch]$MarketsOnly
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$bulkSeedScript = Join-Path $PSScriptRoot 'non-sol-bulk-seed.js'
$densitySeedScript = Join-Path $PSScriptRoot 'non-sol-market-density.js'
$densityReplayScript = Join-Path $PSScriptRoot 'non-sol-market-density-replay.js'
$baselineSeedScript = Join-Path $PSScriptRoot 'non-sol-density-baseline-seed.js'
$oldSourceGuard = '6e51ce5b2abe35c19e13f5b5979c0182cd7c6d5d0bb74932132ac3a1be5705e0'

function Resolve-ArtifactDirectory {
  param(
    [string]$Path,
    [string]$RequiredFile
  )

  $isAbsolute = [System.IO.Path]::IsPathRooted($Path)
  if ($isAbsolute) {
    $resolved = [System.IO.Path]::GetFullPath($Path)
  } else {
    $resolved = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $Path))
  }

  if (Test-Path -LiteralPath (Join-Path $resolved $RequiredFile) -PathType Leaf) {
    return $resolved
  }

  if (-not $isAbsolute -and $Path.StartsWith('artifacts\')) {
    $nested = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot (Join-Path 'artifacts' $Path)))
    if (Test-Path -LiteralPath (Join-Path $nested $RequiredFile) -PathType Leaf) {
      Write-Warning "Using artifacts extracted one folder below the repository root: $nested"
      return $nested
    }
  }

  throw "Required artifact '$RequiredFile' was not found under '$resolved'. Extract the verified delivery archive into the repository root or pass the correct -Bulk/-Density directory."
}

$bulk = Resolve-ArtifactDirectory -Path $Bulk -RequiredFile 'header.json'
$density = Resolve-ArtifactDirectory -Path $Density -RequiredFile 'offline-report.json'
if (-not (Test-Path -LiteralPath (Join-Path $density 'semantic-replay.json') -PathType Leaf)) {
  throw "Density v2 semantic replay is missing from '$density'. Prepare and review density v2 offline artifacts before deployment."
}

if ($SourceApproval -ceq $oldSourceGuard) {
  throw 'The supplied hash is the accepted old source guard, not a --approve-source migration approval. Obtain explicit owner approval of the migration hash in section 13.4.'
}

$target = $Target
$sourceApproval = $SourceApproval

$guardModule = Join-Path $PSScriptRoot 'lib\non-sol-bulk-artifacts.js'
$currentGuard = node -e "console.log(require(process.argv[1]).sourceGuard())" $guardModule
if ($LASTEXITCODE -ne 0 -or $currentGuard -notmatch '^[a-f0-9]{64}$') {
  throw 'Could not determine the current density source guard.'
}

$offlineReport = Get-Content -LiteralPath (Join-Path $density 'offline-report.json') -Raw | ConvertFrom-Json
if ($offlineReport.sourceGuard -cne $currentGuard) {
  $density = "$density-source-$currentGuard"
  Write-Host "Using fresh offline artifacts for the current source: $density"
  if (-not (Test-Path -LiteralPath (Join-Path $density 'offline-report.json') -PathType Leaf)) {
    node --no-warnings $densityReplayScript "--input=$bulk" "--out=$density"
    if ($LASTEXITCODE -ne 0) {
      throw "Semantic replay failed with exit code $LASTEXITCODE; no database write was run."
    }
    node --no-warnings $densitySeedScript --action=prepare --version=v2 "--input=$bulk" "--out=$density"
    if ($LASTEXITCODE -ne 0) {
      throw "Density v2 offline preparation failed with exit code $LASTEXITCODE; no database write was run."
    }
  }
  $offlineReport = Get-Content -LiteralPath (Join-Path $density 'offline-report.json') -Raw | ConvertFrom-Json
}
if ($offlineReport.sourceGuard -cne $currentGuard) {
  throw 'Offline density report does not match the current source.'
}
if ($sourceApproval -cne $offlineReport.sourceMigrationApprovalSha256) {
  Write-Host "Replay-verified source migration: $($offlineReport.sourceMigrationApprovalSha256)"
  $migrationDecision = Read-Host 'Enter APPLY to approve this updated source migration; the script supplies its hash'
  if ($migrationDecision -cne 'APPLY') {
    throw 'Updated source migration was not approved; no database write was run.'
  }
  $sourceApproval = $offlineReport.sourceMigrationApprovalSha256
}

if (-not $MarketsOnly) {
  Write-Host "Running full non-Sol bulk dry-run for target: $target"
  node $bulkSeedScript --action=dry-run "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval"
  if ($LASTEXITCODE -ne 0) {
    throw "Bulk dry-run failed with exit code $LASTEXITCODE."
  }

  $receiptPath = Join-Path $bulk 'target-dry-run.json'
  if (-not (Test-Path -LiteralPath $receiptPath -PathType Leaf)) {
    throw "Dry-run did not create the expected receipt: $receiptPath"
  }

  $receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
  if ($null -eq $receipt.approvalSha256 -or $receipt.approvalSha256 -notmatch '^[a-f0-9]{64}$') {
    throw "The target receipt has no valid approval hash: $receiptPath"
  }

  $blocked = @($receipt.results | Where-Object { $_.status -eq 'blocked' })
  if ($blocked.Count -gt 0) {
    Write-Host "Blocked systems in the receipt:"
    $blocked | Format-Table systemId, status, reason -AutoSize | Out-Host
    throw 'Target preflight contains blocked systems; no apply was run.'
  }

  $bulkApproval = $receipt.approvalSha256
  Write-Host "Review the complete target report before continuing: $receiptPath"
  Write-Host "Target receipt approval hash: $bulkApproval"
  $decision = Read-Host "Enter APPLY to pass this fresh bulk receipt directly to apply, or READBACK if bulk is already complete"
  if ($decision -ceq 'APPLY') {
    Write-Host "Applying the approved non-Sol bulk seed to: $target"
    node $bulkSeedScript --action=apply "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval" "--approve=$bulkApproval"
    if ($LASTEXITCODE -ne 0) {
      throw "Bulk apply failed with exit code $LASTEXITCODE. Inspect the durable journal before deciding whether to resume."
    }
  } elseif ($decision -cne 'READBACK') {
    throw 'Choose APPLY or READBACK; no database write was run.'
  }

  Write-Host "Reading back the non-Sol bulk seed from: $target"
  node $bulkSeedScript --action=readback "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval"
  if ($LASTEXITCODE -ne 0) {
    throw "Bulk readback failed with exit code $LASTEXITCODE."
  }
}

Write-Host 'Checking the three delivered Alpha Centauri/Barnard baseline markets.'
node $baselineSeedScript --action=dry-run --version=v2 "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval"
if ($LASTEXITCODE -ne 0) {
  throw "Baseline market preflight failed with exit code $LASTEXITCODE."
}
$baselineReceipt = Get-Content -LiteralPath (Join-Path $density 'baseline-target-dry-run.json') -Raw | ConvertFrom-Json
$missingBaseline = @($baselineReceipt.results | Where-Object { $_.status -eq 'missing' })
if ($missingBaseline.Count -gt 0) {
  Write-Host "Missing delivered baseline markets: $($missingBaseline.marketId -join ', ')"
  Write-Warning 'These restore the archived legacy placements, including known geometry defects; existing markets and gameplay are never overwritten.'
  $baselineDecision = Read-Host 'Enter APPLY to seed these missing baseline markets before density'
  if ($baselineDecision -cne 'APPLY') {
    throw 'Baseline seeding cancelled; no baseline market write was run.'
  }
  $baselineApproval = $baselineReceipt.approvalSha256
  node $baselineSeedScript --action=apply --version=v2 "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval" "--approve=$baselineApproval"
  if ($LASTEXITCODE -ne 0) {
    throw "Baseline market seed failed with exit code $LASTEXITCODE."
  }
}

Write-Host "Running full density v2 market dry-run for target: $target"
node $densitySeedScript --action=dry-run --version=v2 "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval"
if ($LASTEXITCODE -ne 0) {
  throw "Density v2 market dry-run failed with exit code $LASTEXITCODE."
}

$densityReceiptPath = Join-Path $density 'target-dry-run.json'
if (-not (Test-Path -LiteralPath $densityReceiptPath -PathType Leaf)) {
  throw "Density dry-run did not create the expected receipt: $densityReceiptPath"
}

$densityReceipt = Get-Content -LiteralPath $densityReceiptPath -Raw | ConvertFrom-Json
if ($null -eq $densityReceipt.approvalSha256 -or $densityReceipt.approvalSha256 -notmatch '^[a-f0-9]{64}$') {
  throw "The density target receipt has no valid approval hash: $densityReceiptPath"
}

if (@($densityReceipt.results).Count -ne 4843) {
  throw "Density receipt must cover all 4,843 systems; found $(@($densityReceipt.results).Count)."
}

$densityBlocked = @($densityReceipt.results | Where-Object { $_.status -eq 'blocked' })
if ($densityBlocked.Count -gt 0) {
  Write-Host "Blocked systems in the density receipt:"
  $densityBlocked | Format-Table systemId, status, reason -AutoSize | Out-Host
  throw 'Density target preflight contains blocked systems; no market apply was run.'
}

$densityApproval = $densityReceipt.approvalSha256
Write-Host "Review all 4,843 density results: $densityReceiptPath"
Write-Host "Density target receipt approval hash: $densityApproval"
$densityDecision = Read-Host "Enter APPLY to pass this fresh density receipt directly to apply, or READBACK if density is already complete"
if ($densityDecision -ceq 'APPLY') {
  Write-Host "Applying the approved density v2 market seed to: $target"
  node $densitySeedScript --action=apply --version=v2 "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval" "--approve=$densityApproval"
  if ($LASTEXITCODE -ne 0) {
    throw "Density v2 market apply failed with exit code $LASTEXITCODE. Inspect its durable checkpoints before deciding whether to resume."
  }
} elseif ($densityDecision -cne 'READBACK') {
  throw 'Choose APPLY or READBACK; no density market write was run.'
}

Write-Host "Reading back the density v2 market seed from: $target"
node $densitySeedScript --action=readback --version=v2 "--input=$bulk" "--out=$density" "--target=$target" "--approve-source=$sourceApproval"
if ($LASTEXITCODE -ne 0) {
  throw "Density v2 market readback failed with exit code $LASTEXITCODE."
}

Write-Host "Verifying the bulk seed again after market density deployment: $target"
node $bulkSeedScript --action=readback "--out=$bulk" "--target=$target" "--approve-source=$sourceApproval"
if ($LASTEXITCODE -ne 0) {
  throw "Final bulk readback failed with exit code $LASTEXITCODE."
}
