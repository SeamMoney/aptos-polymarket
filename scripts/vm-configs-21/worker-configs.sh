#!/bin/bash
# =============================================================================
# 21-WORKER HFT CONFIGURATION
# =============================================================================
#
# This file defines the configuration for all 21 HFT workers.
# Each worker has a start-hft.sh script deployed to /opt/aptos-hft/
#
# Generated from actual worker configurations on January 30, 2026.
#
# Usage:
#   source scripts/vm-configs-21/worker-configs.sh
#   deploy_worker 1   # Deploy config to W1
#   deploy_all        # Deploy to all 21 workers
#   check_all         # Check status of all workers
#   start_all 30      # Start all workers for 30 seconds

# =============================================================================
# COMMON CONFIGURATION
# =============================================================================

# Seed mnemonic (same for all workers - accounts derived by index)
SEED_MNEMONIC="venture advance oval deliver profit drill chaos cabbage rapid tag south once rifle call flavor vague sword float town vault calm such grocery elder"

# Common settings (optimal from config tuning tests)
ACCOUNT_CONCURRENCY=10
BATCH_SIZE=10
BATCH_DELAY_MS=80
WORKER_COUNT=2
USE_ORDERLESS=false
PORT=3001

# USD1 metadata (shared across both contracts)
USD1_METADATA="0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3"

# Contract addresses
CONTRACT_A="0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
CONTRACT_B="0x27d2d721a0afb28a003741fb413bfe97424d38aa3b939f1c9789274517871668"

# Markets for Contract A (15 markets)
MARKETS_A="0xaf561030c7ebb22b1d8b99b727c27caab1f6944ce39c141fd2b6b0cfbf614a9e,0xa4ee321c4c642e7b5a3e27b9820f2be4c17a1add79f8129122289fca2c3ca7c3,0xf85c7010d966bc6c3417e52a9b4d86b5f36117e51b43bf5c7a92f0468bac5497,0xcbdddcf6206d2b5956b6c7c6a10d4ac1d6253a2c1c151e8b3af113d8e940f01f,0xe128c8f16a0f07f48c69a38ac75868a2d5fdd9fbf3299958e9b1e2994a0b9f57,0x00f60c218d500eb76c66a4a7fb6c6e5664847d5e9496016000fc953b5a89f6eb,0x287968f6d26efbd291960455ce14e3723a48d32b3dc0a8c545d4603fe842e30f,0xa594c8df003cd232043b34beefe020af744f378ec367a7f65b89e306e06baacb,0x310ccec449c57bf8972feab19c5cb8ba5004e2934e4fa1bd565fdbd1a44f4008,0x8172b2cf4ba365d72fca8b899a54d3c9e2539d63bd2283aca55c0d032fc793f6,0xa550234b5784656e3f3d060134e36ab9a0eecc436d182452955c995984b3e67a,0x9dc3b78821f64119671d7918b824b3b3c4b0e2124643ebe6b1e587efe9591202,0xf508498afdecb2a2f6b40912efb1611b9fe9725e9c35521be5ff2bba3c187efa,0x289aabd338cf7a2bc48512927775b5e1218b15bd83c3c740c3ec43faccef5b21,0x8c4f0da1238adb4486d2a62ff08c85af331e022c1446445059059918d4361cd3"

# Markets for Contract B (15 markets)
MARKETS_B="0xc42bc8fd13829bbe4b60d1af184f89b49731a6c2af39270246c99bc7a1bdec5,0x58f1ec6a003bfa02652fc999f28869a6f68f539cb52ab050519fdc51f8914cf4,0xb0071ae6aafddc899344459db5e5ec1012c3e97067675ac988e052bc53a2f6d9,0x7ee2862500e68cce391d50719da318e7bd0c3223aa7333d7431514440d94fd47,0xe389ee67bdaffa192952ad52e2eb8eeedc0bc735ce4a3bb46379e29b9481a6c5,0x6fa05e7a940c6fe2a0f747bd23f7d6153476e3f363a2adc13f2f1d6f52a1aaea,0xc3371396a3bbb085d31c06d4fb6bd1a1f42573c598f4360c93766a0a6bb4e09b,0xafe7b43af0d99ad8537299654b36cd3033edc1d92d50ce7b3a3c1161c3b5a8d3,0x8fb8b0b32ade467f8abf1d5e89142c885e40dbe94ed2c0678e0f320fc978417f,0xa537214ba3a8d0e7a8740a2016721ba1bb174ed73c33797007343148248c11bf,0x3c58cf1cddb01d452dbbb28ba9721d02b80fb3cbe1a6062423016ef82ab27144,0xa204c76f2d1b2f03d3cde08a96193f1ec621ffcabca8ef69653a6a64b76e7f38,0x6199d1bb20d3290a0c023b2a8d5ea978baeca30108c05f20cf5a4467ba7729cb,0xb5217a1c7805e617f8c139fdcf4a2424d1bbab7dff4c7324f37ede2649c1deb6,0xa7724e3537d5448b303ed216534bd7b82c63830739c85d78fc432ea33765d721"

# VFN endpoints
VFN_USCE1_0="http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1"
VFN_USCE1_1="http://vfn0.usce1-1.testnet.aptoslabs.com:80/v1"
VFN_APNE1_0="http://vfn0.apne1-0.testnet.aptoslabs.com:80/v1"
VFN_CUSTOM="http://aptos.cash.trading:8080/v1"

# =============================================================================
# WORKER DEFINITIONS
# =============================================================================
# Format: WORKER_<N>="IP|START_INDEX|COUNT|VFN|CONTRACT"

# Contract A Workers (W1-W7) - accounts 0-2499
WORKER_1="178.128.177.88|0|357|$VFN_USCE1_0|A"
WORKER_2="167.99.164.45|357|357|$VFN_USCE1_1|A"
WORKER_3="138.68.0.124|714|357|$VFN_APNE1_0|A"
WORKER_4="138.197.221.123|1071|357|$VFN_CUSTOM|A"
WORKER_5="167.172.120.193|1428|357|$VFN_USCE1_0|A"
WORKER_6="138.68.22.167|1785|357|$VFN_USCE1_1|A"
WORKER_7="157.245.168.139|2142|358|$VFN_APNE1_0|A"

# Contract B Workers - Original (W8-W14) - accounts 2500-4999
WORKER_8="206.189.160.224|2500|357|$VFN_CUSTOM|B"
WORKER_9="165.227.20.62|2857|357|$VFN_USCE1_0|B"
WORKER_10="165.227.4.56|3214|357|$VFN_USCE1_1|B"
WORKER_11="104.248.79.36|3571|357|$VFN_APNE1_0|B"
WORKER_12="165.227.27.110|3928|357|$VFN_CUSTOM|B"
WORKER_13="178.128.70.11|4285|357|$VFN_USCE1_0|B"
WORKER_14="138.197.196.42|4642|358|$VFN_USCE1_1|B"

# Contract B Workers - New (W15-W21) - accounts 5000-7499
WORKER_15="178.128.176.238|5000|357|$VFN_APNE1_0|B"
WORKER_16="178.128.75.159|5357|357|$VFN_CUSTOM|B"
WORKER_17="157.245.165.252|5714|357|$VFN_USCE1_0|B"
WORKER_18="64.227.62.177|6071|357|$VFN_USCE1_1|B"
WORKER_19="138.68.31.100|6428|357|$VFN_APNE1_0|B"
WORKER_20="64.225.127.89|6785|357|$VFN_CUSTOM|B"
WORKER_21="134.209.6.169|7142|358|$VFN_USCE1_0|B"

# All worker IPs (for loops)
ALL_WORKER_IPS="178.128.177.88 167.99.164.45 138.68.0.124 138.197.221.123 167.172.120.193 138.68.22.167 157.245.168.139 206.189.160.224 165.227.20.62 165.227.4.56 104.248.79.36 165.227.27.110 178.128.70.11 138.197.196.42 178.128.176.238 178.128.75.159 157.245.165.252 64.227.62.177 138.68.31.100 64.225.127.89 134.209.6.169"

# =============================================================================
# FUNCTIONS
# =============================================================================

# Generate start-hft.sh content for a worker
generate_worker_script() {
  local worker_num=$1
  eval "local config=\$WORKER_${worker_num}"

  IFS='|' read -r ip start count vfn contract_type <<< "$config"

  if [ "$contract_type" = "A" ]; then
    local contract=$CONTRACT_A
    local markets=$MARKETS_A
  else
    local contract=$CONTRACT_B
    local markets=$MARKETS_B
  fi

  cat << EOF
#!/bin/bash
# Worker W${worker_num} - Contract ${contract_type}
export SEED_MNEMONIC="${SEED_MNEMONIC}"
export ACCOUNT_START_INDEX=${start}
export ACCOUNT_COUNT=${count}
export ACCOUNT_CONCURRENCY=${ACCOUNT_CONCURRENCY}
export BATCH_SIZE=${BATCH_SIZE}
export BATCH_DELAY_MS=${BATCH_DELAY_MS}
export WORKER_COUNT=${WORKER_COUNT}
export USE_ORDERLESS=${USE_ORDERLESS}
export RPC_MODE=custom
export FULLNODE_URL="${vfn}"
export CONTRACT_ADDRESS="${contract}"
export USD1_METADATA="${USD1_METADATA}"
export MULTI_MARKETS="${markets}"
export PORT=${PORT}

cd /opt/aptos-hft
exec npx tsx server/hft-piscina-server.ts turbo
EOF
}

# Deploy config to a specific worker
deploy_worker() {
  local worker_num=$1
  eval "local config=\$WORKER_${worker_num}"
  IFS='|' read -r ip start count vfn contract_type <<< "$config"

  echo "Deploying to W${worker_num} (${ip})..."
  generate_worker_script $worker_num | ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@$ip "cat > /opt/aptos-hft/start-hft.sh && chmod +x /opt/aptos-hft/start-hft.sh"
  echo "  Done"
}

# Deploy to all 21 workers
deploy_all() {
  echo "Deploying to all 21 workers..."
  for i in $(seq 1 21); do
    deploy_worker $i &
  done
  wait
  echo "All workers updated."
}

# Check status of all workers
check_all() {
  echo "Checking all 21 workers..."
  echo "-------------------------------------------------------------------"
  printf "%-4s %-18s %-8s %-10s %-10s %s\n" "ID" "IP" "Status" "Threads" "Accounts" "VFN"
  echo "-------------------------------------------------------------------"

  for i in $(seq 1 21); do
    eval "local config=\$WORKER_${i}"
    IFS='|' read -r ip start count vfn contract_type <<< "$config"

    local resp=$(curl -s --connect-timeout 5 "http://$ip:3001/status" 2>/dev/null)
    if [ -n "$resp" ]; then
      local threads=$(echo "$resp" | jq -r '.workers.ready // 0')
      local accounts=$(echo "$resp" | jq -r '.accounts.total // 0')
      printf "%-4s %-18s %-8s %-10s %-10s %s\n" "W$i" "$ip" "READY" "${threads}/2" "$accounts" "${vfn:7:20}..."
    else
      printf "%-4s %-18s %-8s %-10s %-10s %s\n" "W$i" "$ip" "OFFLINE" "-" "-" "${vfn:7:20}..."
    fi
  done
  echo "-------------------------------------------------------------------"
}

# Start all workers for a duration
start_all() {
  local duration=${1:-30}
  echo "Starting all 21 workers for ${duration} seconds..."

  for ip in $ALL_WORKER_IPS; do
    curl -s -X POST "http://$ip:3001/start?duration=$duration" &
  done
  wait
  echo "All workers started."
}

# Stop all workers
stop_all() {
  echo "Stopping all 21 workers..."

  for ip in $ALL_WORKER_IPS; do
    curl -s -X POST "http://$ip:3001/stop" &
  done
  wait
  echo "All workers stopped."
}

# Restart all workers (kill and restart)
restart_all() {
  echo "Restarting all 21 workers..."

  for ip in $ALL_WORKER_IPS; do
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@$ip "
      pkill -f 'hft-piscina-server' 2>/dev/null || true
      sleep 1
      cd /opt/aptos-hft && nohup ./start-hft.sh > /tmp/hft.log 2>&1 &
    " &
  done
  wait

  echo "Waiting 30 seconds for initialization..."
  sleep 30
  check_all
}

# Show usage
show_usage() {
  echo "21-Worker HFT Configuration"
  echo ""
  echo "Usage:"
  echo "  source scripts/vm-configs-21/worker-configs.sh"
  echo ""
  echo "Functions:"
  echo "  check_all           Check status of all 21 workers"
  echo "  deploy_all          Deploy config to all 21 workers"
  echo "  deploy_worker N     Deploy config to worker N"
  echo "  start_all [N]       Start all workers for N seconds (default: 30)"
  echo "  stop_all            Stop all workers"
  echo "  restart_all         Kill and restart all workers"
  echo ""
  echo "Variables:"
  echo "  ALL_WORKER_IPS      Space-separated list of all worker IPs"
  echo "  WORKER_N            Config for worker N (IP|START|COUNT|VFN|CONTRACT)"
}

echo "21-Worker HFT config loaded. Run 'show_usage' for help."
