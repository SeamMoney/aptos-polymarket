# Aptos Mainnet Endpoints

Discovered: January 19, 2026
Updated: February 20, 2026 (added latency benchmarks, fullnode endpoints)

## Public HTTPS Endpoints (Well Known)

| Endpoint | Type | Latency (from US) |
|----------|------|-------------------|
| `https://api.mainnet.aptoslabs.com/v1` | API endpoint (CDN/LB) | **42-72ms** |
| `https://fullnode.mainnet.aptoslabs.com/v1` | Primary public fullnode | **70-108ms** |

## Regional HTTPS Endpoints

| Region | Endpoint | Notes |
|--------|----------|-------|
| US Central East | `https://usce1.fullnode.mainnet.aptoslabs.com/v1` | Regional fullnode |
| US Central East | `https://usce1-seed.fullnode.mainnet.aptoslabs.com/v1` | Seed node |
| US Central East | `https://usce1-backup.fullnode.mainnet.aptoslabs.com/v1` | Backup node |
| Europe West | `https://euwe4.fullnode.mainnet.aptoslabs.com/v1` | Regional fullnode |
| Europe West | `https://euwe4-backup.fullnode.mainnet.aptoslabs.com/v1` | Backup node |
| Asia Pacific NE | `https://apne1.fullnode.mainnet.aptoslabs.com/v1` | Regional fullnode |
| Asia Pacific NE | `https://apne1-seed.fullnode.mainnet.aptoslabs.com/v1` | Seed node |
| Staging | `https://api-staging.mainnet.aptoslabs.com/v1` | Staging API |
| Indexer | `https://indexer.mainnet.aptoslabs.com/v1` | Indexer API |

## Internal HTTP VFN Nodes (Port 80)

These are internal validator full nodes running on port 80 without SSL.
**No US-region VFNs exist for mainnet.** Only EU and Asia.

| Region | Endpoint | IP | Latency (from US) |
|--------|----------|-----|-------------------|
| EU West | `http://vfn0.euwe4-1.mainnet.aptoslabs.com:80/v1` | 34.147.75.73 | 344-439ms |
| EU West | `http://vfn0.euwe4-2.mainnet.aptoslabs.com:80/v1` | 34.91.209.36 | 330-389ms |
| EU West | `http://vfn0.euwe4-3.mainnet.aptoslabs.com:80/v1` | 35.204.251.101 | 326-399ms |
| Asia NE | `http://vfn0.apne1-0.mainnet.aptoslabs.com:80/v1` | 35.221.127.184 | 428-1103ms |

## Internal HTTP Fullnodes (Port 80)

| Region | Endpoint | Latency (from US) |
|--------|----------|-------------------|
| Asia NE | `http://fullnode0.apne1-0.mainnet.aptoslabs.com:80/v1` | 272-331ms |
| EU West | `http://fullnode0.euwe4-1.mainnet.aptoslabs.com:80/v1` | 370-1989ms |
| EU West | `http://fullnode0.euwe4-2.mainnet.aptoslabs.com:80/v1` | 330-481ms |

## Summary

- **2** Public HTTPS endpoints (fastest from US: 42-108ms)
- **9** Regional HTTPS endpoints
- **4** Internal HTTP VFN nodes (EU/Asia only, 326-1103ms from US)
- **3** Internal HTTP fullnodes (EU/Asia only, 272-1989ms from US)
- **18 total** endpoints

## Rate Limits

All public endpoints are rate-limited. For no rate limits:
1. Run your own mainnet fullnode
2. Use Geomi API keys for higher tiers

## Discovery Method

Found via certificate transparency logs at crt.sh, pattern enumeration based on testnet VFN naming conventions, and systematic DNS probing across all known GCP region abbreviations.

All VFN IPs resolve to GCP (35.x.x.x, 34.x.x.x ranges), confirming Aptos validators run on Google Cloud Platform.
