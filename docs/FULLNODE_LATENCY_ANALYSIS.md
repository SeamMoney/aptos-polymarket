# Fullnode Latency Analysis & VFN Discovery

**Date:** February 20, 2026
**Node:** `aptos.cash.trading` (164.92.117.18) — DigitalOcean SFO2, 4 vCPU / 8GB RAM

## TL;DR

- Our fullnode API reads are **4x faster** than public testnet (35ms vs 145ms)
- Transaction confirmation is **~200ms slower** due to being 2 hops from validators (vs 1 hop for Aptos-operated nodes)
- No US-region mainnet VFNs exist — only EU and Asia
- For mainnet with no rate limits, we need our own mainnet fullnode

---

## Testnet Latency Breakdown

### API Read Latency (our node vs public)

| Endpoint | Our Node | Public Testnet | Winner |
|----------|----------|---------------|--------|
| `/v1` (health) | **35-40ms** | 145ms | Ours (4x) |
| `/accounts/.../resources` | **34-39ms** | ~140ms | Ours (4x) |
| `/transactions/simulate` | **34-43ms** | ~140ms | Ours (4x) |
| `/transactions?limit=5` | 68-413ms | ~200ms | Variable |
| `/transactions/by_version` | 35-255ms | ~150ms | Variable |

### Transaction Round-Trip (submit + confirm)

Full round-trip = build tx → sign → submit → mempool propagation → validator consensus → block confirmation

| Endpoint | Avg Latency | Notes |
|----------|------------|-------|
| VFN usce1-0 (testnet) | **~1,134ms** | Fastest — direct validator connection |
| Public testnet | **~1,106ms** | Load-balanced, Aptos-operated |
| Our node | **~1,295ms** | ~200ms slower due to network topology |

### Where the 1 Second Goes

```
GET sequence number:     ~35ms    (our node)
POST simulate:           ~35ms    (our node)
POST submit:             ~35ms    (our node)
Mempool propagation:     ~100ms   (our node → peers → validator)
Block consensus:         ~500ms   (Aptos validator consensus)
Block propagation back:  ~100ms   (validator → peers → our node)
CLI polling overhead:    ~100ms   (confirmation polling)
─────────────────────────────────
Total:                   ~1,000ms
```

---

## Peer Topology Analysis

### Our Node's Peers

Our node connects to 6 monitored peers, all **1 hop from validators**:

| Peer ID | Ping | Connected Peers | Distance from Validators |
|---------|------|----------------|------------------------|
| `676f640c` | **38ms** | 59-60 | 1 |
| `31e55012` | **39ms** | — | 1 |
| `479ca442` | 110ms | 33-35 | 1 |
| `6bd8f1f3` | 109ms | 37-39 | 1 |
| `03c04549` | 140ms | — | — |
| `116176e2` | 139ms | — | — |

### Network Topology

```
Validators (consensus)
    ↕  0 hops
VFNs (Aptos-operated: vfn0.usce1-*.testnet)
    ↕  1 hop
Our peers (676f640c, 31e55012, etc.)     ← distance=1
    ↕  38-140ms
Our node (aptos.cash.trading)            ← distance=2
```

The public fullnode (`fullnode.testnet.aptoslabs.com`) is likely a VFN or load balancer fronting VFNs — effectively **distance=0-1**.

### Why We Can't Get More Peers

- Config allows 100 outbound, but only 11 are discoverable in our region
- 0 inbound connections (port 6182 open, but node not well-known)
- 212K `peer_not_prioritized` mempool events — limited broadcast reach
- This is a testnet limitation, not a config issue

---

## Fullnode Configuration

### Current Config (optimized)

```yaml
# /opt/aptos/testnet/fullnode.yaml
base:
  role: "full_node"
  data_dir: "/opt/aptos/data"
  waypoint:
    from_file: "/opt/aptos/etc/waypoint.txt"

execution:
  genesis_file_location: "/opt/aptos/etc/genesis.blob"

state_sync:
  state_sync_driver:
    bootstrapping_mode: "DownloadLatestStates"
    continuous_syncing_mode: "ApplyTransactionOutputs"

storage:
  rocksdb_configs:
    enable_storage_sharding: true

full_node_networks:
- network_id: "public"
  discovery_method: "onchain"
  listen_address: "/ip4/0.0.0.0/tcp/6182"
  max_outbound_connections: 100
  max_inbound_connections: 200
  mutual_authentication: false
  connectivity_check_interval_ms: 5000

api:
  enabled: true
  address: "0.0.0.0:8080"
  max_submit_transaction_batch_size: 10000
  max_transactions_page_size: 10000

mempool:
  capacity: 10000000
  capacity_per_user: 100000
  system_transaction_timeout_secs: 600
  default_failovers: 10
  shared_mempool_tick_interval_ms: 10
  shared_mempool_batch_size: 500
  max_broadcasts_per_peer: 10
```

### Docker Container

```bash
docker run -d \
  --name aptos-fullnode \
  --restart unless-stopped \
  --ulimit nofile=1048576:1048576 \
  -v /opt/aptos/testnet:/opt/aptos/etc \
  -v /opt/aptos/testnet/data:/opt/aptos/data \
  -p 6182:6182 \
  -p 8080:8080 \
  -p 9101:9101 \
  aptoslabs/validator:testnet \
  aptos-node -f /opt/aptos/etc/fullnode.yaml
```

### Key Lessons

| Issue | Fix |
|-------|-----|
| `RLIMIT_NOFILE` panic | `--ulimit nofile=1048576:1048576` |
| ChunkCommitQueue corruption | Restart container — self-resolves |
| Disk 100% full (DB growth) | Enable pruning after sync completes |
| Block storage adds ~50ms latency | Keep DB on local SSD, not network volume |
| Docker can't follow symlinks | Use `mount --bind` instead |

---

## Testnet VFN Endpoints

### Available (verified Feb 2026)

| Endpoint | Region | Latency (from US) |
|----------|--------|-------------------|
| `http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1` | US Central | **~35ms** |
| `http://vfn0.usce1-1.testnet.aptoslabs.com:80/v1` | US Central | **~35ms** |
| `http://vfn0.apne1-0.testnet.aptoslabs.com:80/v1` | Asia NE | ~150ms |

### P2P Port (6182) — all open for peer connections

---

## Mainnet VFN Endpoints

### Discovered (verified Feb 2026)

**No US-region mainnet VFNs exist.** Only EU and Asia:

| Endpoint | Region | Latency (from US) |
|----------|--------|-------------------|
| `api.mainnet.aptoslabs.com/v1` | US (CDN/LB) | **42-72ms** |
| `fullnode.mainnet.aptoslabs.com/v1` | US (CDN/LB) | **70-108ms** |
| `vfn0.euwe4-1.mainnet.aptoslabs.com:80/v1` | EU West | 344-439ms |
| `vfn0.euwe4-2.mainnet.aptoslabs.com:80/v1` | EU West | 330-389ms |
| `vfn0.euwe4-3.mainnet.aptoslabs.com:80/v1` | EU West | 326-399ms |
| `vfn0.apne1-0.mainnet.aptoslabs.com:80/v1` | Asia NE | 428-1103ms |
| `fullnode0.apne1-0.mainnet.aptoslabs.com:80/v1` | Asia NE | 272-331ms |
| `fullnode0.euwe4-1.mainnet.aptoslabs.com:80/v1` | EU West | 370-1989ms |
| `fullnode0.euwe4-2.mainnet.aptoslabs.com:80/v1` | EU West | 330-481ms |

### Regional HTTPS Endpoints

| Region | Endpoint |
|--------|----------|
| US Central East | `https://usce1.fullnode.mainnet.aptoslabs.com/v1` |
| US Central East (seed) | `https://usce1-seed.fullnode.mainnet.aptoslabs.com/v1` |
| US Central East (backup) | `https://usce1-backup.fullnode.mainnet.aptoslabs.com/v1` |
| Europe West | `https://euwe4.fullnode.mainnet.aptoslabs.com/v1` |
| Asia Pacific NE | `https://apne1.fullnode.mainnet.aptoslabs.com/v1` |

### VFN IP Addresses

| Hostname | IP |
|----------|-----|
| vfn0.apne1-0.mainnet | 35.221.127.184 (GCP asia-northeast1) |
| vfn0.euwe4-1.mainnet | 34.147.75.73 (GCP europe-west4) |
| vfn0.euwe4-2.mainnet | 34.91.209.36 (GCP europe-west4) |
| vfn0.euwe4-3.mainnet | 35.204.251.101 (GCP europe-west4) |

---

## Mainnet: Path to No Rate Limits

The public endpoints (`api.mainnet.aptoslabs.com`, `fullnode.mainnet.aptoslabs.com`) are rate-limited. To query mainnet with no rate limits:

### Option 1: Own Mainnet Fullnode (Recommended)

Spin up a dedicated mainnet fullnode on DigitalOcean or GCP.

**Requirements:**
- 4+ vCPU, 16GB+ RAM, 500GB+ SSD
- Mainnet genesis.blob and waypoint.txt
- Pruning enabled from the start (mainnet DB is larger than testnet)
- Cost: ~$48-150/mo depending on provider

**GCP us-central1 advantage:** Validators run on GCP. Co-locating there gives <5ms to peers instead of 38ms from DO SFO.

### Option 2: Geomi API Key

Use Geomi (Aptos's developer toolkit) for higher rate limits via API key:
- `VITE_GEOMI_API_KEY` in current `.env.local`
- Rate limits depend on plan tier

### Option 3: Split Architecture

- **Writes (tx submit):** `api.mainnet.aptoslabs.com` (42ms, rate-limited but fast)
- **Reads:** Own fullnode (no rate limits, fast API)

---

## Infrastructure Summary

| Component | Network | IP/URL | Region | Status |
|-----------|---------|--------|--------|--------|
| Our fullnode | Testnet | `aptos.cash.trading:8080` (164.92.117.18) | DO SFO2 | Running |
| Block storage | — | `/mnt/volume_sfo3_01` (500GB) | DO SFO3 | Mounted, unused |
| Worker 1 | Testnet | 178.128.177.88 | DO SFO2 | Ready |
| Worker 2 | Testnet | 167.99.164.45 | DO SFO2 | Ready |
| Worker 3 | Testnet | 138.68.0.124 | DO SFO2 | Ready |
| 21 HFT workers | Testnet | Various | DO SFO2 | Ready |

---

## Discovery Method

- **Testnet VFNs:** Pattern enumeration (`vfn0.<region>-<idx>.testnet.aptoslabs.com`)
- **Mainnet VFNs:** Systematic probing of all region/index combinations + DNS resolution
- **Peer topology:** Prometheus metrics at `localhost:9101/metrics` on our fullnode
- **Latency benchmarks:** `aptos move run` CLI round-trip + raw `curl` TTFB measurements
