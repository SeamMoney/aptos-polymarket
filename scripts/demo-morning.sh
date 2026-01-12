#!/bin/bash
#
# 30K TPS DEMO - MORNING STARTUP SCRIPT
# ======================================
#
# This script sets up everything for the demo with two-key activation:
#   KEY 1: This script starts the server on remote VM (standby mode)
#   KEY 2: Go to UI and click ARM → LAUNCH
#
# Usage: ./scripts/demo-morning.sh
#

set -e

# Configuration
SERVER_IP="aptos.cash.trading"  # Your fullnode VM
SERVER_PORT="3001"
DEMO_URL="https://aptos-polymarket.vercel.app/demo-day"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}🚀 30K TPS DEMO - MORNING STARTUP${NC}                            ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}▶ STEP $1:${NC} $2"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Main
print_header

echo -e "${BOLD}Two-Key Activation System:${NC}"
echo -e "  ${CYAN}KEY 1:${NC} This script starts server (CLI)"
echo -e "  ${CYAN}KEY 2:${NC} You ARM in the UI (Browser)"
echo -e "  ${GREEN}→${NC} Both keys needed to LAUNCH"
echo ""

# Step 1: Check SSH access
print_step "1" "Checking SSH access to $SERVER_IP..."
if ssh -o ConnectTimeout=5 -o BatchMode=yes root@$SERVER_IP "echo ok" &>/dev/null; then
    print_success "SSH connection OK"
else
    echo -e "${RED}✗ Cannot SSH to $SERVER_IP${NC}"
    echo "  Make sure you have SSH key access to root@$SERVER_IP"
    exit 1
fi

# Step 2: Kill any existing HFT server
print_step "2" "Stopping any existing HFT server..."
ssh root@$SERVER_IP "pkill -f 'hft-ultra-server' || true; lsof -ti:$SERVER_PORT | xargs kill -9 2>/dev/null || true" 2>/dev/null
print_success "Cleared port $SERVER_PORT"

# Step 3: Copy latest server code
print_step "3" "Deploying latest server code..."
scp -q server/hft-ultra-server.ts root@$SERVER_IP:/opt/aptos-hft/ 2>/dev/null || {
    ssh root@$SERVER_IP "mkdir -p /opt/aptos-hft"
    scp server/hft-ultra-server.ts root@$SERVER_IP:/opt/aptos-hft/
    scp package.json root@$SERVER_IP:/opt/aptos-hft/
    scp tsconfig.json root@$SERVER_IP:/opt/aptos-hft/
}
print_success "Server code deployed"

# Step 4: Create the run script with ALL 20 keys
print_step "4" "Configuring server with all 20 trading accounts..."
cat << 'RUNSCRIPT' | ssh root@$SERVER_IP "cat > /opt/aptos-hft/run-standby.sh && chmod +x /opt/aptos-hft/run-standby.sh"
#!/bin/bash
cd /opt/aptos-hft

# All 20 trading accounts
export ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36,ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295,ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637,ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C"

export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://127.0.0.1:8080/v1"  # Local fullnode on same VM
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKET="0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"
export HFT_PORT=3001

echo "=============================================="
echo "  HFT SERVER - STANDBY MODE"
echo "=============================================="
echo ""
echo "Server will initialize accounts and wait for UI to LAUNCH"
echo ""

# NO mode argument = Standby mode (waits for UI to ARM + LAUNCH)
npx tsx hft-ultra-server.ts
RUNSCRIPT
print_success "Server configured"

# Step 5: Start tmux session with server
print_step "5" "Starting HFT server in tmux session..."
ssh root@$SERVER_IP << 'SSHCMD'
# Kill old tmux session if exists
tmux kill-session -t hft-demo 2>/dev/null || true

# Start new tmux session
tmux new-session -d -s hft-demo -n "hft-server"
tmux send-keys -t hft-demo "cd /opt/aptos-hft && ./run-standby.sh" Enter

echo "✓ Server started in tmux session 'hft-demo'"
SSHCMD
print_success "Server starting in background"

# Wait for server to come up
print_step "6" "Waiting for server to initialize..."
sleep 5

# Check if server is responding
if curl -s --connect-timeout 5 "http://$SERVER_IP:$SERVER_PORT/health" | grep -q "ok"; then
    print_success "Server is running and healthy!"
else
    echo -e "${YELLOW}⚠ Server may still be starting. Check in a moment.${NC}"
fi

# Final instructions
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}✓ KEY 1 COMPLETE - SERVER RUNNING IN STANDBY${NC}                 ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Now complete KEY 2:${NC}"
echo ""
echo -e "  1. Open: ${CYAN}$DEMO_URL${NC}"
echo -e "  2. Click ${YELLOW}ARM SYSTEM${NC} → Pre-flight checks run"
echo -e "  3. Click ${GREEN}LAUNCH DEMO${NC} → 3-2-1 countdown → GO!"
echo ""
echo -e "${BOLD}To monitor the demo:${NC}"
echo ""
echo -e "  ${CYAN}ssh root@$SERVER_IP -t 'tmux attach -t hft-demo'${NC}"
echo ""
echo -e "To stop the demo:"
echo -e "  ${CYAN}ssh root@$SERVER_IP 'tmux kill-session -t hft-demo'${NC}"
echo ""
