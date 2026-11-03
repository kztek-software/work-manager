<#
.SYNOPSIS
    Kịch bản tự động sao lưu CSDL PostgreSQL cho hệ thống KZTEK Work Management.
.DESCRIPTION
    Tự động trích xuất CSDL sang định dạng SQL/GZip, hỗ trợ tự động tìm pg_dump,
    phân tích file .env và tự động dọn dẹp các bản sao lưu cũ quá hạn lưu trữ.
.PARAMETER BackupDir
    Thư mục chứa file sao lưu. Mặc định: ./backups/postgres
.PARAMETER RetentionDays
    Số ngày lưu trữ các bản backup cũ trước khi xóa. Mặc định: 14 ngày.
.PARAMETER Compress
    Có nén file backup sang .sql.gz bằng GZipStream native hay không. Mặc định: $true.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$BackupDir = "",

    [Parameter(Mandatory = $false)]
    [int]$RetentionDays = 14,

    [Parameter(Mandatory = $false)]
    [switch]$Compress = $true,

    [Parameter(Mandatory = $false)]
    [string]$PgDumpPath = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..").Path

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    $BackupDir = Join-Path $rootDir "backups\postgres"
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# 1. Đọc file .env nếu có
$envFile = Join-Path $rootDir ".env"
$envMap = @{}
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not [string]::IsNullOrWhiteSpace($line) -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $key = $parts[0].Trim()
            $val = $parts[1].Trim().Trim('"').Trim("'")
            $envMap[$key] = $val
        }
    }
}

# 2. Phân giải thông tin kết nối CSDL
$dbUser = if ($envMap.ContainsKey("POSTGRES_USER")) { $envMap["POSTGRES_USER"] } else { "kztek" }
$dbPassword = if ($envMap.ContainsKey("POSTGRES_PASSWORD")) { $envMap["POSTGRES_PASSWORD"] } else { "kztek" }
$dbName = if ($envMap.ContainsKey("POSTGRES_DB")) { $envMap["POSTGRES_DB"] } else { "WorkingManager" }
$dbHost = if ($envMap.ContainsKey("POSTGRES_HOST")) { $envMap["POSTGRES_HOST"] } else { "127.0.0.1" }
$dbPort = if ($envMap.ContainsKey("POSTGRES_PORT")) { $envMap["POSTGRES_PORT"] } else { "5432" }

if ($envMap.ContainsKey("DATABASE_URL")) {
    $databaseUrl = $envMap["DATABASE_URL"]
    # postgresql://user:password@host:port/dbname?params
    if ($databaseUrl -match "^postgres(?:ql)?://(?:([^:]+)(?::([^@]+))?@)?([^:/]+)(?::(\d+))?/(?:([^?]+))") {
        if ($Matches[1]) { $dbUser = $Matches[1] }
        if ($Matches[2]) { $dbPassword = $Matches[2] }
        if ($Matches[3]) { $dbHost = $Matches[3] }
        if ($Matches[4]) { $dbPort = $Matches[4] }
        if ($Matches[5]) { $dbName = $Matches[5] }
    }
}

# 3. Tìm công cụ pg_dump.exe
$foundPgDump = ""
if (-not [string]::IsNullOrWhiteSpace($PgDumpPath) -and (Test-Path $PgDumpPath)) {
    $foundPgDump = $PgDumpPath
}
elseif (Get-Command "pg_dump.exe" -ErrorAction SilentlyContinue) {
    $foundPgDump = (Get-Command "pg_dump.exe").Source
}
else {
    $pgVersions = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    foreach ($v in $pgVersions) {
        $candidate = Join-Path $v.FullName "bin\pg_dump.exe"
        if (Test-Path $candidate) {
            $foundPgDump = $candidate
            break
        }
    }
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlBackupFile = Join-Path $BackupDir "backup_${dbName}_${timestamp}.sql"
$finalBackupFile = $sqlBackupFile

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  KZTEK WORK MANAGEMENT — POSTGRESQL BACKUP (WINDOWS)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "Thời gian  : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Database   : $dbName"
Write-Host "User       : $dbUser"
Write-Host "Host       : $dbHost`:$dbPort"
Write-Host "Thư mục    : $BackupDir"
Write-Host "Retention  : Giữ lại $RetentionDays ngày"
Write-Host "------------------------------------------------------------------------------"

if ([string]::IsNullOrWhiteSpace($foundPgDump)) {
    Write-Error "Không tìm thấy công cụ 'pg_dump.exe' trên hệ thống! Vui lòng cài PostgreSQL hoặc truyền tham số -PgDumpPath."
    exit 1
}

Write-Host "[INFO] Sử dụng pg_dump tại: $foundPgDump" -ForegroundColor Gray

# 4. Thực thi pg_dump
$env:PGPASSWORD = $dbPassword
try {
    $dumpArgs = @(
        "-h", $dbHost,
        "-p", $dbPort,
        "-U", $dbUser,
        "-d", $dbName,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "-f", $sqlBackupFile
    )
    
    $process = Start-Process -FilePath $foundPgDump -ArgumentList $dumpArgs -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "pg_dump kết thúc với mã lỗi $($process.ExitCode)"
    }
    
    if (-not (Test-Path $sqlBackupFile) -or (Get-Item $sqlBackupFile).Length -eq 0) {
        throw "Tệp sao lưu tạo ra bị rỗng hoặc không tồn tại."
    }
    
    Write-Host "[SUCCESS] Trích xuất SQL thành công ($([math]::Round((Get-Item $sqlBackupFile).Length / 1KB, 2)) KB)" -ForegroundColor Green

    # 5. Nén GZip nếu được bật
    if ($Compress) {
        $gzBackupFile = "$sqlBackupFile.gz"
        Write-Host "[INFO] Đang nén file sao lưu bằng GZipStream..." -ForegroundColor Gray
        
        $srcStream = [System.IO.File]::OpenRead($sqlBackupFile)
        $dstStream = [System.IO.File]::Create($gzBackupFile)
        $gzStream = New-Object System.IO.Compression.GZipStream($dstStream, [System.IO.Compression.CompressionLevel]::Optimal)
        
        $srcStream.CopyTo($gzStream)
        
        $gzStream.Dispose()
        $dstStream.Dispose()
        $srcStream.Dispose()
        
        Remove-Item -Path $sqlBackupFile -Force
        $finalBackupFile = $gzBackupFile
        Write-Host "[SUCCESS] Nén GZip hoàn tất: $([math]::Round((Get-Item $finalBackupFile).Length / 1KB, 2)) KB" -ForegroundColor Green
    }
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# 6. Dọn dẹp bản sao lưu cũ quá hạn retention
Write-Host "[INFO] Kiểm tra dọn dẹp các tệp sao lưu cũ hơn $RetentionDays ngày..." -ForegroundColor Gray
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
$oldFiles = Get-ChildItem -Path $BackupDir -Filter "backup_${dbName}_*.sql*" | Where-Object { $_.LastWriteTime -lt $cutoffDate }
$deletedCount = 0
foreach ($old in $oldFiles) {
    Remove-Item -Path $old.FullName -Force
    $deletedCount++
}
Write-Host "[INFO] Đã dọn dẹp $deletedCount tệp sao lưu hết hạn." -ForegroundColor Gray
Write-Host "------------------------------------------------------------------------------"
Write-Host "Tệp backup sẵn sàng: $finalBackupFile" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
