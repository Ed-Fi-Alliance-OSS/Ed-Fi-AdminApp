<#
.SYNOPSIS
    Utility functions for environment variable management and template substitution.

.DESCRIPTION
    This module provides reusable functions for:
    - Loading environment variables from .env files
    - Substituting placeholders in configuration files with environment variable values
    - Processing multiple template files with environment variable substitution

.EXAMPLE
    . .\env-utils.ps1
    Import-EnvFile -Path ".env"
    Invoke-EnvSubstitution -TemplateFile "config.json" -WarnOnMissing
#>

<#
.SYNOPSIS
    Loads environment variables from a .env file into the current process.

.DESCRIPTION
    Reads a .env file and sets each variable as a process-level environment variable.
    Ignores comments (lines starting with #) and empty lines.

.PARAMETER Path
    The path to the .env file. Defaults to ".env" in the current directory.

.EXAMPLE
    Import-EnvFile -Path ".env"
#>
function Import-EnvFile {
    param(
        [Parameter(Mandatory = $false)]
        [string]$Path = ".env"
    )

    if (-not (Test-Path $Path)) {
        Write-Warning "Environment file not found: $Path"
        return
    }

    Write-Verbose "Loading environment variables from: $Path"

    Get-Content $Path | ForEach-Object {
        # Skip empty lines and comments
        if ($_ -match '^\s*$' -or $_ -match '^\s*#') {
            return
        }

        # Parse key=value pairs
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()

            # Strip inline comments (# followed by space or end of line)
            # Only strip comments that have whitespace before them to avoid breaking values with #
            if ($value -match '^(.*?)\s+#.*$') {
                $value = $matches[1].Trim()
            }

            # Remove quotes if present - check for matching pairs
            if ($value -match '^"(.*)"$') {
                # Double quotes
                $value = $matches[1]
            } elseif ($value -match "^'(.*)'$") {
                # Single quotes
                $value = $matches[1]
            }

            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Verbose "Set environment variable: $name"
        }
    }
}

<#
.SYNOPSIS
    Substitutes placeholders in a template file with environment variable values.

.DESCRIPTION
    Reads a template file, replaces all placeholders in the format {{VARIABLE_NAME}}
    with the corresponding environment variable values, and writes the result back to the same file.

.PARAMETER TemplateFile
    The path to the template file containing placeholders. This file will be modified in place.

.PARAMETER PlaceholderPattern
    The regex pattern for placeholders. Defaults to '\{\{([A-Z_][A-Z0-9_]*)\}\}'
    which matches {{VARIABLE_NAME}} style placeholders.

.PARAMETER WarnOnMissing
    If set, warns when an environment variable referenced in a placeholder is not set.

.EXAMPLE
    Invoke-EnvSubstitution -TemplateFile "config.json" -WarnOnMissing

.EXAMPLE
    Invoke-EnvSubstitution -TemplateFile "keycloak_client.json"
#>
function Invoke-EnvSubstitution {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TemplateFile,

        [Parameter(Mandatory = $false)]
        [string]$PlaceholderPattern = '\{\{([A-Z_][A-Z0-9_]*)\}\}',

        [Parameter(Mandatory = $false)]
        [switch]$WarnOnMissing
    )

    if (-not (Test-Path $TemplateFile)) {
        Write-Error "Template file not found: $TemplateFile"
        return $false
    }

    Write-Verbose "Processing template: $TemplateFile"
    $content = Get-Content $TemplateFile -Raw

    # Track variables that were substituted (using hashtables to track unique variables)
    $substitutedVars = @{}
    $missingVars = @{}

    # Find all placeholders and replace them
    $content = [regex]::Replace($content, $PlaceholderPattern, {
        param($match)
        $varName = $match.Groups[1].Value
        $varValue = [Environment]::GetEnvironmentVariable($varName)

        if ($null -eq $varValue -or $varValue -eq '') {
            $missingVars[$varName] = $true
            return $match.Value  # Keep placeholder if variable not found
        } else {
            $substitutedVars[$varName] = $true
            return $varValue
        }
    })

    # Write the substituted content back
    $content | Set-Content $TemplateFile -NoNewline

    # Report results
    if ($substitutedVars.Count -gt 0) {
        $uniqueVars = $substitutedVars.Keys | Sort-Object
        Write-Host "Substituted $($uniqueVars.Count) unique variable(s) in '$TemplateFile'" -ForegroundColor Cyan
        Write-Verbose "Variables substituted: $($uniqueVars -join ', ')"
    }

    if ($missingVars.Count -gt 0 -and $WarnOnMissing) {
        $uniqueMissing = $missingVars.Keys | Sort-Object
        Write-Warning "Missing environment variables in '$TemplateFile': $($uniqueMissing -join ', ')"
        Write-Warning "These placeholders were not replaced."
    }

    Write-Verbose "File updated: $TemplateFile"
    return $true
}

<#
.SYNOPSIS
    Creates a backup of template files and substitutes placeholders with environment variable values.

.DESCRIPTION
    Creates .bak backup files of the original templates, then performs environment variable substitution
    on the originals. Returns information needed to restore the backups later.

.PARAMETER TemplateFiles
    An array of template file paths to process.

.PARAMETER WarnOnMissing
    If set, warns when environment variables are missing.

.RETURNS
    Array of backup file paths that were created.

.EXAMPLE
    $backups = Invoke-SafeEnvSubstitution -TemplateFiles @("config.json") -WarnOnMissing
#>
function Invoke-SafeEnvSubstitution {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$TemplateFiles,

        [Parameter(Mandatory = $false)]
        [switch]$WarnOnMissing
    )

    $backupFiles = @()

    foreach ($file in $TemplateFiles) {
        if (-not (Test-Path $file)) {
            Write-Warning "Template file not found: $file"
            continue
        }

        # Create backup file
        $backupPath = "$file.bak"
        Copy-Item -Path $file -Destination $backupPath -Force
        $backupFiles += $backupPath
        Write-Verbose "Created backup: $backupPath"

        # Perform substitution on original
        $result = Invoke-EnvSubstitution -TemplateFile $file -WarnOnMissing:$WarnOnMissing
        if (-not $result) {
            Write-Warning "Failed to process: $file"
        }
    }

    return $backupFiles
}

<#
.SYNOPSIS
    Restores template files from their backups and removes the backup files.

.DESCRIPTION
    Moves .bak files back to their original names, effectively restoring the templates
    with placeholders and cleaning up the backup files.

.PARAMETER BackupFiles
    Array of backup file paths to restore.

.EXAMPLE
    Restore-TemplateFiles -BackupFiles $backupFiles
#>
function Restore-TemplateFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$BackupFiles
    )

    foreach ($backupFile in $BackupFiles) {
        if (-not (Test-Path $backupFile)) {
            Write-Warning "Backup file not found: $backupFile"
            continue
        }

        # Get original file path (remove .bak extension)
        $originalFile = $backupFile -replace '\.bak$', ''

        # Move backup back to original, overwriting the substituted version
        Move-Item -Path $backupFile -Destination $originalFile -Force
        Write-Verbose "Restored: $originalFile"
    }

    Write-Host "Template files restored with placeholders." -ForegroundColor Green
}

<#
.SYNOPSIS
    Processes multiple template files with environment variable substitution.

.DESCRIPTION
    Applies environment variable substitution to multiple template files in batch.

.PARAMETER TemplateFiles
    An array of template file paths to process.

.PARAMETER WarnOnMissing
    If set, warns when environment variables are missing.

.EXAMPLE
    Invoke-BulkEnvSubstitution -TemplateFiles @("config1.json", "config2.json") -WarnOnMissing
#>
function Invoke-BulkEnvSubstitution {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$TemplateFiles,

        [Parameter(Mandatory = $false)]
        [switch]$WarnOnMissing
    )

    $successCount = 0
    $failureCount = 0

    foreach ($file in $TemplateFiles) {
        $result = Invoke-EnvSubstitution -TemplateFile $file -WarnOnMissing:$WarnOnMissing
        if ($result) {
            $successCount++
        } else {
            $failureCount++
        }
    }

    Write-Host "Processed $successCount file(s) successfully, $failureCount failed." -ForegroundColor $(if ($failureCount -eq 0) { "Green" } else { "Yellow" })
}
