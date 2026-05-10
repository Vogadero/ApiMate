#!/bin/bash

# Verification script for build setup (Task 1.1.5)
# This script verifies that all build scripts and configurations are in place

echo "=========================================="
echo "ApiMate Build Setup Verification"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1 (missing)"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        return 0
    else
        echo -e "${RED}✗${NC} $1/ (missing)"
        return 1
    fi
}

# Check root files
echo "Root Configuration Files:"
check_file "package.json"
check_file "tsconfig.json"
check_file "BUILD.md"
check_file "QUICKSTART.md"
check_file ".gitignore"
check_file ".vscodeignore"
echo ""

# Check VS Code configuration
echo "VS Code Configuration:"
check_file ".vscode/tasks.json"
check_file ".vscode/launch.json"
check_file ".vscode/settings.json"
echo ""

# Check webview structure
echo "Webview Structure:"
check_dir "webview"
check_dir "webview/src"
check_dir "webview/src/types"
check_file "webview/package.json"
check_file "webview/vite.config.ts"
check_file "webview/tsconfig.json"
check_file "webview/tsconfig.node.json"
check_file "webview/.eslintrc.json"
check_file "webview/index.html"
check_file "webview/README.md"
echo ""

# Check webview source files
echo "Webview Source Files:"
check_file "webview/src/main.tsx"
check_file "webview/src/App.tsx"
check_file "webview/src/App.css"
check_file "webview/src/index.css"
check_file "webview/src/types/vscode.d.ts"
echo ""

# Check extension source
echo "Extension Source:"
check_dir "src"
check_dir "src/managers"
check_file "src/extension.ts"
echo ""

# Check build scripts in package.json
echo "Build Scripts:"
if grep -q "\"build:extension\"" package.json; then
    echo -e "${GREEN}✓${NC} build:extension script"
else
    echo -e "${RED}✗${NC} build:extension script (missing)"
fi

if grep -q "\"build:webview\"" package.json; then
    echo -e "${GREEN}✓${NC} build:webview script"
else
    echo -e "${RED}✗${NC} build:webview script (missing)"
fi

if grep -q "\"watch:extension\"" package.json; then
    echo -e "${GREEN}✓${NC} watch:extension script"
else
    echo -e "${RED}✗${NC} watch:extension script (missing)"
fi

if grep -q "\"watch:webview\"" package.json; then
    echo -e "${GREEN}✓${NC} watch:webview script"
else
    echo -e "${RED}✗${NC} watch:webview script (missing)"
fi

if grep -q "\"clean\"" package.json; then
    echo -e "${GREEN}✓${NC} clean script"
else
    echo -e "${RED}✗${NC} clean script (missing)"
fi

if grep -q "\"package\"" package.json; then
    echo -e "${GREEN}✓${NC} package script"
else
    echo -e "${RED}✗${NC} package script (missing)"
fi
echo ""

# Test extension build
echo "Testing Extension Build:"
echo -e "${YELLOW}Running: npm run build:extension${NC}"
if npm run build:extension > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Extension builds successfully"
    if [ -f "dist/extension.js" ]; then
        echo -e "${GREEN}✓${NC} dist/extension.js created"
    else
        echo -e "${RED}✗${NC} dist/extension.js not found"
    fi
else
    echo -e "${RED}✗${NC} Extension build failed"
fi
echo ""

# Check if webview dependencies are installed
echo "Webview Dependencies:"
if [ -d "webview/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Webview dependencies installed"
    echo -e "${YELLOW}Testing: npm run build:webview${NC}"
    if (cd webview && npm run build > /dev/null 2>&1); then
        echo -e "${GREEN}✓${NC} Webview builds successfully"
        if [ -f "webview/dist/index.html" ]; then
            echo -e "${GREEN}✓${NC} webview/dist/index.html created"
        else
            echo -e "${RED}✗${NC} webview/dist/index.html not found"
        fi
    else
        echo -e "${RED}✗${NC} Webview build failed"
    fi
else
    echo -e "${YELLOW}⚠${NC} Webview dependencies not installed"
    echo -e "   Run: ${YELLOW}npm run install:webview${NC}"
fi
echo ""

echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Install webview dependencies: npm run install:webview"
echo "2. Test full build: npm run build"
echo "3. Launch extension: Press F5 in VS Code"
echo ""
