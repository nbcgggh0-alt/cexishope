#!/bin/bash
# ============================================================
#  CexiStore Bot — Auto Setup Script (VPS)
#  Automates: Node.js, Dependencies, Private Repo Clone, PM2
# ============================================================

set -e

# Configuration
# ⚠️ SECURITY WARNING: This token provides access to the private repository.
# Do not share this script publicly.
GITHUB_TOKEN="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"
GITHUB_REPO="nbcgggh0-alt/cexishope"
GITHUB_BRANCH="main"
INSTALL_DIR="$HOME/cexishope-bot"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step()  { echo -e "${CYAN}[→]${NC} $1"; }

# 1. System Updates & Dependencies
log_step "Updating system and installing dependencies..."
if command -v apt-get &> /dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y git curl unzip wget build-essential
elif command -v yum &> /dev/null; then
  sudo yum update -y
  sudo yum install -y git curl unzip wget
else
  log_warn "Package manager not detected. Ensure git/curl are installed."
fi

# 2. Install Node.js 20.x
log_step "Checking Node.js..."
if ! command -v node &> /dev/null; then
    log_step "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VER=$(node -v)
    log_info "Node.js $NODE_VER is already installed."
fi

# 3. Install PM2
log_step "Checking PM2..."
if ! command -v pm2 &> /dev/null; then
    log_step "Installing PM2 process manager..."
    sudo npm install -g pm2
else
    log_info "PM2 is already installed."
fi

# 4. Clone Repository (Handling Private Repo)
log_step "Setting up project directory..."

if [ -d "$INSTALL_DIR" ]; then
    log_warn "Directory $INSTALL_DIR already exists."
    # We don't want to interactive prompt in auto-script if possible, but user asked for 'auto'
    rm -rf "$INSTALL_DIR"
    log_info "Deleted existing directory to ensure fresh private clone."
fi

log_step "Cloning private repository..."
# Using the token directly in the URL for authentication
git clone "https://$GITHUB_TOKEN@github.com/$GITHUB_REPO.git" "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 5. Install Project Dependencies
log_step "Installing project dependencies..."
npm install --production

# 6. Setup Configuration (.env)
if [ ! -f .env ]; then
    log_step "Creating default .env file..."
    # User provided values
    cat > .env << EOF
# CexiStore Bot Configuration
TELEGRAM_BOT_TOKEN=8018214245:AAFSn9V0fF65fPtmen7QPyDwG8Hwn6N0gR0
SUPABASE_URL=https://yzjsmtxhpdlsniqpcuoa.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6anNtdHhocGRsc25pcXBjdW9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkzOTY4NCwiZXhwIjoyMDgwNTE1Njg0fQ.ooTln0pbYcRu6cta7TFM9qr7hamkT2pqc9JK1_WKtvQ
OWNER_ID=8402309532
STORE_NAME=CexiStore Ultimate Pro
STORE_CURRENCY=RM
SESSION_TIMEOUT=14400000
EOF
    chmod 600 .env
    log_info ".env created using default values. Warning: Check if tokens are up-to-date."
else
    log_info ".env file already exists."
fi

# 7. Create Data Directories
mkdir -p data/backup data/images data/qr
log_info "Data directories created."

# 8. Start with PM2
log_step "Starting bot with PM2..."

# Determine startup script
START_SCRIPT="index.js"
if [ -f "ecosystem.config.js" ]; then
    START_SCRIPT="ecosystem.config.js"
fi

# Check if process is already running
pm2 delete cexistore-bot 2>/dev/null || true
pm2 start "$START_SCRIPT" --name cexistore-bot
pm2 save
    
# Setup startup hook
log_step "Configuring PM2 startup..."
# This attempts to run the startup command. 
# Sometimes this requires manual intervention, but we try best effort.
pm2 startup | grep "sudo" | bash || log_warn "Could not auto-run startup hook. Please run 'pm2 startup' manually if needed."
pm2 save

echo ""
echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}   ✅ AUTO INSTALLATION COMPLETE!          ${NC}"
echo -e "${GREEN}===========================================${NC}"
echo -e "Bot is running in background with PM2."
echo -e "${BOLD}${CYAN}Bot kini berjalan di latar belakang (background).${NC}"
echo -e "${BOLD}${CYAN}Anda boleh keluar dari VPS sekarang (Safe to exit VPS).${NC}"
echo -e "Use: ${CYAN}pm2 logs cexistore-bot${NC} to view logs."
