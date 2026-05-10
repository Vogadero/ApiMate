# Verification script for build setup (Task 1.1.5)
# This script verifies that all build scripts and configurations are in place

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "ApiMate Build Setup Verification" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check function
function Check-File {
    param($Path)
    if (Test-Path $Path -PathType Leaf) {
        Write-Host "✓ $Path" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ $Path (missing)" -ForegroundColor Red
        return $false
    }
}

function Check-Dir {
    param($Path)
    if (Test-Path $Path -PathType Container) {
        Write-Host "✓ $Path/" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ $Path/ (missing)" -ForegroundColor Red
        return $false
    }
}

# Check root files
Write-Host "Root Configuration Files:"
Check-File "package.json"
Check-File "tsconfig.json"
Check-File "BUILD.md"
Check-File "QUICKSTART.md"
Check-File ".gitignore"
Check-File ".vscodeignore"
Write-Host ""

# Check VS Code configuration
Write-Host "VS Code Configuration:"
Check-File ".vscode/tasks.json"
Check-File ".vscode/launch.json"
Check-File ".vscode/settings.json"
Write-Host ""

# Check webview structure
Write-Host "Webview Structure:"
Check-Dir "webview"
Check-Dir "webview/src"
Check-Dir "webview/src/types"
Check-File "webview/package.json"
Check-File "webview/vite.config.ts"
Check-File "webview/tsconfig.json"
Check-File "webview/tsconfig.node.json"
Check-File "webview/.eslintrc.json"
Check-File "webview/index.html"
Check-File "webview/README.md"
Write-Host ""

# Check webview source files
Write-Host "Webview Source Files:"
Check-File "webview/src/main.tsx"
Check-File "webview/src/App.tsx"
Check-File "webview/src/App.css"
Check-File "webview/src/index.css"
Check-File "webview/src/types/vscode.d.ts"
Write-Host ""

# Check extension source
Write-Host "Extension Source:"
Check-Dir "src"
Check-Dir "src/managers"
Check-File "src/extension.ts"
Write-Host ""

# Check build scripts in package.json
Write-Host "Build Scripts:"
$packageJson = Get-Content "package.json" -Raw
if ($packageJson -match '"build:extension"') {
    Write-Host "✓ build:extension script" -ForegroundColor Green
} else {
    Write-Host "✗ build:extension script (missing)" -ForegroundColor Red
}

if ($packageJson -match '"build:webview"') {
    Write-Host "✓ build:webview script" -ForegroundColor Green
} else {
    Write-Host "✗ build:webview script (missing)" -ForegroundColor Red
}

if ($packageJson -match '"watch:extension"') {
    Write-Host "✓ watch:extension script" -ForegroundColor Green
} else {
    Write-Host "✗ watch:extension script (missing)" -ForegroundColor Red
}

if ($packageJson -match '"watch:webview"') {
    Write-Host "✓ watch:webview script" -ForegroundColor Green
} else {
    Write-Host "✗ watch:webview script (missing)" -ForegroundColor Red
}

if ($packageJson -match '"clean"') {
    Write-Host "✓ clean script" -ForegroundColor Green
} else {
    Write-Host "✗ clean script (missing)" -ForegroundColor Red
}

if ($packageJson -match '"package"') {
    Write-Host "✓ package script" -ForegroundColor Green
} else {
    Write-Host "✗ package script (missing)" -ForegroundColor Red
}
Write-Host ""

# Test extension build
Write-Host "Testing Extension Build:"
Write-Host "Running: npm run build:extension" -ForegroundColor Yellow
try {
    $null = npm run build:extension 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Extension builds successfully" -ForegroundColor Green
        if (Test-Path "dist/extension.js") {
            Write-Host "✓ dist/extension.js created" -ForegroundColor Green
        } else {
            Write-Host "✗ dist/extension.js not found" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ Extension build failed" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Extension build failed" -ForegroundColor Red
}
Write-Host ""

# Check if webview dependencies are installed
Write-Host "Webview Dependencies:"
if (Test-Path "webview/node_modules" -PathType Container) {
    Write-Host "✓ Webview dependencies installed" -ForegroundColor Green
    Write-Host "Testing: npm run build:webview" -ForegroundColor Yellow
    try {
        Push-Location webview
        $null = npm run build 2>&1
        Pop-Location
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Webview builds successfully" -ForegroundColor Green
            if (Test-Path "webview/dist/index.html") {
                Write-Host "✓ webview/dist/index.html created" -ForegroundColor Green
            } else {
                Write-Host "✗ webview/dist/index.html not found" -ForegroundColor Red
            }
        } else {
            Write-Host "✗ Webview build failed" -ForegroundColor Red
        }
    } catch {
        Pop-Location
        Write-Host "✗ Webview build failed" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ Webview dependencies not installed" -ForegroundColor Yellow
    Write-Host "   Run: npm run install:webview" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Verification Complete" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:"
Write-Host "1. Install webview dependencies: npm run install:webview"
Write-Host "2. Test full build: npm run build"
Write-Host "3. Launch extension: Press F5 in VS Code"
Write-Host ""
