#!/bin/bash
# ============================================================
# CexiStore Bot — Auto Domain & Nginx Setup Script
# Automates: Cloudflare DNS Record Creation & Nginx Proxy
# ============================================================

set -e

# Configuration
CF_API_TOKEN="nwvXVFnrob_ddztLgjFDBh55yRRSCSaNzl2SQqWE"
CF_ZONE_ID="765476de4d88ebc3d4325a8e843e221f"
WEB_PORT=3000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
function log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
function log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
function log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
function log_step() { echo -e "\n${YELLOW}=== $1 ===${NC}"; }

# Check for root
if [ "$EUID" -ne 0 ]; then
  log_error "This script must be run as root. Please run 'sudo bash setup_domain.sh'"
fi

cat << "EOF"
  ____          _ ____  _                  
 / ___|_____  _(_) ___|| |_ ___  _ __ ___  
| |   / _ \ \/ / \___ \| __/ _ \| '__/ _ \ 
| |__|  __/>  <| |___) | || (_) | | |  __/ 
 \____\___/_/\_\_|____/ \__\___/|_|  \___| 
                                           
 Domain & Reverse Proxy Auto-Installer     
EOF
echo ""

# 1. Prompt for Domain
read -p "Enter the full domain or subdomain you want to use (e.g. chat.yourdomain.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    log_error "Domain name cannot be empty!"
fi

# 2. Detect VPS IP
log_step "Detecting VPS Public IP..."
VPS_IP=$(curl -s -4 ifconfig.me)
if [ -z "$VPS_IP" ]; then
    VPS_IP=$(curl -s -4 ipv4.icanhazip.com)
fi

if [[ ! $VPS_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    log_error "Failed to detect a valid IPv4 address. Detected: $VPS_IP"
fi
log_success "VPS IP detected as: $VPS_IP"

# 3. Configure Cloudflare DNS
log_step "Configuring Cloudflare DNS for $DOMAIN_NAME..."

# Check if record already exists
RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?name=$DOMAIN_NAME&type=A" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$RECORD_ID" ]; then
    log_info "DNS record for $DOMAIN_NAME already exists. Updating it to point to $VPS_IP..."
    RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$RECORD_ID" \
         -H "Authorization: Bearer $CF_API_TOKEN" \
         -H "Content-Type: application/json" \
         --data "{\"type\":\"A\",\"name\":\"$DOMAIN_NAME\",\"content\":\"$VPS_IP\",\"ttl\":1,\"proxied\":true}")
else
    log_info "Creating new DNS record for $DOMAIN_NAME pointing to $VPS_IP..."
    RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
         -H "Authorization: Bearer $CF_API_TOKEN" \
         -H "Content-Type: application/json" \
         --data "{\"type\":\"A\",\"name\":\"$DOMAIN_NAME\",\"content\":\"$VPS_IP\",\"ttl\":1,\"proxied\":true}")
fi

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_success "Cloudflare DNS configuration successful!"
else
    log_warn "Cloudflare API response did not indicate clear success. Check your Cloudflare dashboard."
    echo "API Response: $RESPONSE"
fi

# 4. Install Nginx
log_step "Installing Nginx..."
if ! command -v nginx > /dev/null; then
    apt-get update
    apt-get install -y nginx
    log_success "Nginx installed."
else
    log_info "Nginx is already installed."
fi

# 5. Configure Nginx Reverse Proxy
log_step "Configuring Nginx reverse proxy for $DOMAIN_NAME -> Port $WEB_PORT..."

NGINX_CONF="/etc/nginx/sites-available/$DOMAIN_NAME"

cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Limit payload size
    client_max_body_size 10M;

    # Main Web Chat Route
    location / {
        proxy_pass http://127.0.0.1:$WEB_PORT;
        
        # Standard Proxy Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket Support for Socket.io
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$WEB_PORT;

        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        
        # WebSockets timeout settings
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

# Enable Site & Restart Nginx
if [ -f "/etc/nginx/sites-enabled/$DOMAIN_NAME" ]; then
    rm -f "/etc/nginx/sites-enabled/$DOMAIN_NAME"
fi
ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/

log_info "Testing Nginx configuration..."
if nginx -t; then
    systemctl restart nginx
    log_success "Nginx restarted successfully!"
else
    log_error "Nginx configuration test failed. Please check the config."
fi

# 6. Final Instructions
log_step "Setup Complete!"
echo -e "${GREEN}Configuration finished!${NC}"
echo -e "Your Web Chat server is now accessible via:"
echo -e "👉 ${BLUE}http://$DOMAIN_NAME${NC}"
echo -e "\nMake sure your Node.js bot is running (\`pm2 logs cexistor\`) to serve port $WEB_PORT."
echo -e "Cloudflare usually provisions SSL certificates automatically (Flexible / Full). If it's proxied (orange cloud), ${GREEN}https://$DOMAIN_NAME${NC} will work shortly."
echo -e "\nIf the Domain name is not saving inside the Bot receipts, update your .env file MANUALLY:"
echo -e "Add: ${YELLOW}WEB_URL=https://$DOMAIN_NAME${NC}"
echo -e "Then restart the bot: ${GREEN}pm2 restart cexistor${NC}"
echo "============================================================"
