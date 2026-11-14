#!/bin/bash
# PRE-DEPLOYMENT VERIFICATION SCRIPT
# Checks for all critical files and configurations before Docker deployment
# Usage: bash scripts/verify-deployment.sh

set -e

echo "================================================================"
echo "  DePIN-Guard PRE-DEPLOYMENT VERIFICATION"
echo "================================================================"
echo ""

ERRORS=0
WARNINGS=0
SUCCESS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

check_file() {
    local file=$1
    local name=$2
    if [ -f "$file" ]; then
        echo -e "${GREEN}[OK]${NC} $name exists"
        ((SUCCESS++))
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $name MISSING: $file"
        ((ERRORS++))
        return 1
    fi
}

check_dir() {
    local dir=$1
    local name=$2
    if [ -d "$dir" ]; then
        echo -e "${GREEN}[OK]${NC} $name exists"
        ((SUCCESS++))
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $name MISSING: $dir"
        ((ERRORS++))
        return 1
    fi
}

check_content() {
    local file=$1
    local pattern=$2
    local name=$3
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}[OK]${NC} $name configured"
        ((SUCCESS++))
        return 0
    else
        echo -e "${YELLOW}[WARN]${NC} $name NOT FOUND in $file"
        ((WARNINGS++))
        return 1
    fi
}

# ---------------------------------------------------------------------
echo -e "${BLUE}[1/4] Checking Dockerfiles...${NC}"
echo ""
check_file "backend/Dockerfile" "backend/Dockerfile"
check_file "ai-service/Dockerfile" "ai-service/Dockerfile"
check_file "frontend/Dockerfile" "frontend/Dockerfile"
check_file "iot/Dockerfile" "iot/Dockerfile"
check_file "auth-service/Dockerfile" "auth-service/Dockerfile"
check_file "scripts/docker-blockchain-init/Dockerfile" "blockchain-init/Dockerfile"

# ---------------------------------------------------------------------
echo ""
echo -e "${BLUE}[2/4] Checking requirements.txt files...${NC}"
echo ""
check_file "requirements.txt" "requirements.txt (root)"
check_file "backend/requirements.txt" "backend/requirements.txt"
check_file "ai-service/requirements.txt" "ai-service/requirements.txt"
check_file "auth-service/requirements.txt" "auth-service/requirements.txt"
check_file "iot/requirements.txt" "iot/requirements.txt"

# ---------------------------------------------------------------------
echo ""
echo -e "${BLUE}[3/4] Checking environment files...${NC}"
echo ""
check_file ".env" ".env (root)"
check_file "backend/.env" "backend/.env"
check_file "frontend/.env" "frontend/.env"
check_file "iot/.env" "iot/.env"
check_file ".env.example" ".env.example (template)"

# ---------------------------------------------------------------------
echo ""
echo -e "${BLUE}[4/4] Checking configuration content...${NC}"
echo ""

# Check .env has critical values
if [ -f ".env" ]; then
    check_content ".env" "DEPIN_API_KEY=" ".env has DEPIN_API_KEY"
    check_content ".env" "JWT_SECRET_KEY=" ".env has JWT_SECRET_KEY"
fi

# Check backend.env has Docker networking URLs
if [ -f "backend/.env" ]; then
    echo ""
    echo "Checking backend/.env for Docker networking..."
    if grep -q "AI_SERVICE_URL=http://ai-service:10000" backend/.env; then
        echo -e "${GREEN}[OK]${NC} backend/.env uses Docker service name for AI"
        ((SUCCESS++))
    else
        echo -e "${RED}[FAIL]${NC} backend/.env still has tunnel URL for AI_SERVICE_URL"
        ((ERRORS++))
    fi
fi

# Check frontend.env has localhost URLs
if [ -f "frontend/.env" ]; then
    echo ""
    echo "Checking frontend/.env for localhost URLs..."
    if grep -q "VITE_API_URL=http://localhost:8000" frontend/.env; then
        echo -e "${GREEN}[OK]${NC} frontend/.env uses localhost for API"
        ((SUCCESS++))
    else
        echo -e "${RED}[FAIL]${NC} frontend/.env still has tunnel URL"
        ((ERRORS++))
    fi
fi

# Check iot.env has Docker service name
if [ -f "iot/.env" ]; then
    echo ""
    echo "Checking iot/.env for Docker service name..."
    if grep -q "BACKEND_URL=http://backend:8000" iot/.env; then
        echo -e "${GREEN}[OK]${NC} iot/.env uses Docker service name"
        ((SUCCESS++))
    else
        echo -e "${RED}[FAIL]${NC} iot/.env still has tunnel URL"
        ((ERRORS++))
    fi
fi

# ---------------------------------------------------------------------
echo ""
echo "================================================================"
echo -e "  ${GREEN}SUCCESS:${NC} $SUCCESS"
echo -e "  ${YELLOW}WARNINGS:${NC} $WARNINGS"
echo -e "  ${RED}ERRORS:${NC} $ERRORS"
echo "================================================================"

if [ $ERRORS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}ALL CHECKS PASSED!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. docker-compose -f docker-compose.prod.yml build"
    echo "  2. docker-compose -f docker-compose.prod.yml up -d"
    echo "  3. docker-compose -f docker-compose.prod.yml ps"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}DEPLOYMENT BLOCKED - ERRORS FOUND${NC}"
    echo ""
    exit 1
fi
