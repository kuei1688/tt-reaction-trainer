param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$TaskpackPath,

    [Parameter(Mandatory = $false)]
    [string]$OutputDir = "AI_CONTEXT/DRAFTS",

    [Parameter(Mandatory = $false)]
    [string]$Model = "glm-5.2:cloud",

    [Parameter(Mandatory = $false)]
    [string]$ReasoningEffort = "max",

    [Parameter(Mandatory = $false)]
    [double]$Temperature = 0.1,

    [Parameter(Mandatory = $false)]
    [string]$Endpoint = "http://127.0.0.1:11434/v1/chat/completions",

    [Parameter(Mandatory = $false)]
    [string]$OutputName
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    $toolsDir = Split-Path -Parent $PSScriptRoot
    return [System.IO.Path]::GetFullPath($toolsDir)
}

function Resolve-PathRelativeToRepo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue,
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot
    )

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $PathValue))
}

function Get-OutputStem {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TaskpackFilePath,
        [string]$OverrideName
    )

    if ($OverrideName) {
        $stem = [System.IO.Path]::GetFileNameWithoutExtension($OverrideName)
        if ([string]::IsNullOrWhiteSpace($stem)) {
            throw "OutputName was provided but resolved to an empty file stem."
        }
        return $stem
    }

    return [System.IO.Path]::GetFileNameWithoutExtension($TaskpackFilePath)
}

function Get-ModelsEndpoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ChatEndpoint
    )

    if ($ChatEndpoint -match '/v1/chat/completions$') {
        return ($ChatEndpoint -replace '/v1/chat/completions$', '/v1/models')
    }

    throw "Endpoint must end with /v1/chat/completions so the script can derive /v1/models."
}

function Convert-ToPrettyJson {
    param(
        [Parameter(Mandatory = $true)]
        $InputObject
    )

    return ($InputObject | ConvertTo-Json -Depth 100)
}

$repoRoot = Resolve-RepoRoot
$resolvedTaskpackPath = Resolve-PathRelativeToRepo -PathValue $TaskpackPath -RepoRoot $repoRoot
$resolvedOutputDir = Resolve-PathRelativeToRepo -PathValue $OutputDir -RepoRoot $repoRoot
$modelsEndpoint = Get-ModelsEndpoint -ChatEndpoint $Endpoint

if (-not (Test-Path -LiteralPath $resolvedTaskpackPath)) {
    throw "TaskpackPath does not exist: $resolvedTaskpackPath"
}

$taskpackText = Get-Content -LiteralPath $resolvedTaskpackPath -Raw
if ([string]::IsNullOrWhiteSpace($taskpackText)) {
    throw "Taskpack file is empty: $resolvedTaskpackPath"
}

Write-Host "Checking Ollama endpoint: $modelsEndpoint"
$modelsResponse = Invoke-RestMethod -Method Get -Uri $modelsEndpoint -ContentType "application/json"

if (-not $modelsResponse.data) {
    throw "Ollama /v1/models response did not contain a data array."
}

$availableModelIds = @($modelsResponse.data | ForEach-Object { $_.id })
if ($availableModelIds -notcontains $Model) {
    $availableText = if ($availableModelIds.Count -gt 0) { $availableModelIds -join ", " } else { "(none)" }
    throw "Model '$Model' was not found in Ollama /v1/models. Available models: $availableText"
}

if (-not (Test-Path -LiteralPath $resolvedOutputDir)) {
    New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null
}

$outputStem = Get-OutputStem -TaskpackFilePath $resolvedTaskpackPath -OverrideName $OutputName
$outputJsonPath = Join-Path $resolvedOutputDir ($outputStem + "_glm_output.json")
$outputMdPath = Join-Path $resolvedOutputDir ($outputStem + "_glm_output.md")

$messages = @(
    @{
        role = "system"
        content = "You are a read-only GLM sidecar. Follow the taskpack strictly. Do not modify files. Return only the requested analysis."
    },
    @{
        role = "user"
        content = @"
Taskpack markdown:

$taskpackText
"@
    }
)

$payload = @{
    model = $Model
    reasoning_effort = $ReasoningEffort
    temperature = $Temperature
    messages = $messages
    stream = $false
}

Write-Host "Calling GLM sidecar model: $Model"
$response = Invoke-RestMethod `
    -Method Post `
    -Uri $Endpoint `
    -ContentType "application/json" `
    -Body (Convert-ToPrettyJson -InputObject $payload)

$responseJson = Convert-ToPrettyJson -InputObject $response
[System.IO.File]::WriteAllText($outputJsonPath, $responseJson, (New-Object System.Text.UTF8Encoding($false)))

$responseContent = $null
if ($response.choices -and $response.choices.Count -gt 0 -and $response.choices[0].message) {
    $responseContent = $response.choices[0].message.content
}

if ([string]::IsNullOrWhiteSpace($responseContent)) {
    throw "The GLM response did not contain choices[0].message.content."
}

[System.IO.File]::WriteAllText($outputMdPath, $responseContent, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Saved JSON: $outputJsonPath"
Write-Host "Saved MD:   $outputMdPath"
