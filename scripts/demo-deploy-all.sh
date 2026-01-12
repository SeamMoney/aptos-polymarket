#!/bin/bash
#
# DEPLOY TO ALL WORKER VMs
# ========================
#
# Deploys latest hft-ultra-server.ts to all 3 workers
#
# Usage: ./scripts/demo-deploy-all.sh
#

set -e

# Worker VMs
WORKER1="178.128.177.88"   # 7 accounts - UI connected (master)
WORKER2="147.182.237.239"  # 7 accounts
WORKER3="161.35.231.0"     # 6 accounts
FULLNODE="aptos.cash.trading"   # Your fullnode

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}📦 DEPLOYING TO ALL WORKER VMs${NC}                               ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Account splits (20 total accounts split across 3 workers)
# Worker 1: accounts 1-7 (7 accounts) - MASTER, UI connects here
KEYS_W1="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36"

# Worker 2: accounts 8-14 (7 accounts)
KEYS_W2="ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295,ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637"

# Worker 3: accounts 15-20 (6 accounts)
KEYS_W3="ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C"

deploy_worker() {
    local IP=$1
    local WORKER_NUM=$2
    local KEYS=$3
    local IS_MASTER=$4

    echo -e "${YELLOW}▶ Deploying to Worker $WORKER_NUM ($IP)...${NC}"

    # Copy latest server code
    ssh root@$IP "mkdir -p /opt/aptos-hft"
    scp -q server/hft-ultra-server.ts root@$IP:/opt/aptos-hft/
    scp -q package.json root@$IP:/opt/aptos-hft/
    scp -q tsconfig.json root@$IP:/opt/aptos-hft/

    # Create run script
    if [ "$IS_MASTER" = "true" ]; then
        # Master worker - standby mode, UI connects here
        cat << RUNSCRIPT | ssh root@$IP "cat > /opt/aptos-hft/run-hft.sh && chmod +x /opt/aptos-hft/run-hft.sh"
#!/bin/bash
cd /opt/aptos-hft

export ULTRA_PRIVATE_KEYS="$KEYS"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://$FULLNODE:8080/v1"
export EXTRA_RPC_ENDPOINTS="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKET="0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"
export HFT_PORT=3001

echo "=============================================="
echo "  WORKER $WORKER_NUM - MASTER (UI Connected)"
echo "  7 accounts, Port 3001"
echo "=============================================="

# Standby mode - waits for UI to ARM + LAUNCH
npx tsx hft-ultra-server.ts
RUNSCRIPT
    else
        # Secondary workers - auto-start mode
        cat << RUNSCRIPT | ssh root@$IP "cat > /opt/aptos-hft/run-hft.sh && chmod +x /opt/aptos-hft/run-hft.sh"
#!/bin/bash
cd /opt/aptos-hft

export ULTRA_PRIVATE_KEYS="$KEYS"
export APTOS_API_KEY="AG-3JMDT54EN4DCLULDWAUXCYGQ56JJQCYHH"
export FULLNODE_URL="http://$FULLNODE:8080/v1"
export EXTRA_RPC_ENDPOINTS="https://polished-evocative-borough.aptos-testnet.quiknode.pro/a0b08bae2dc34e4a8774d91414948d02a5ce2975/v1"
export CONTRACT_ADDRESS="0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1"
export MULTI_MARKET="0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96"
export HFT_PORT=3001

echo "=============================================="
echo "  WORKER $WORKER_NUM - SECONDARY"
echo "  Accounts ready, auto-start mode"
echo "=============================================="

# Auto-start quantum mode
npx tsx hft-ultra-server.ts quantum 120
RUNSCRIPT
    fi

    # Install dependencies
    ssh root@$IP "cd /opt/aptos-hft && npm install --silent 2>/dev/null" &

    echo -e "${GREEN}✓${NC} Worker $WORKER_NUM deployed"
}

# Deploy to all workers in parallel
echo "Deploying to all 3 workers..."
echo ""

deploy_worker $WORKER1 1 "$KEYS_W1" "true"
deploy_worker $WORKER2 2 "$KEYS_W2" "false"
deploy_worker $WORKER3 3 "$KEYS_W3" "false"

# Wait for npm installs
echo ""
echo "Waiting for npm installs to complete..."
wait

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}✓ ALL WORKERS DEPLOYED${NC}                                      ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Worker 1 (${CYAN}$WORKER1${NC}): MASTER - 7 accounts - UI connects here"
echo -e "Worker 2 (${CYAN}$WORKER2${NC}): Secondary - 7 accounts"
echo -e "Worker 3 (${CYAN}$WORKER3${NC}): Secondary - 6 accounts"
echo ""
echo -e "Total: ${BOLD}20 accounts${NC} across 3 workers"
echo ""
echo -e "Next: Run ${YELLOW}./scripts/demo-start-all.sh${NC} to start the demo"
