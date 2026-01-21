# Aptos Mainnet Endpoints

Discovered: January 19, 2026

## Public HTTPS Endpoints (Well Known)

| Endpoint | Type |
|----------|------|
| `https://fullnode.mainnet.aptoslabs.com/v1` | Primary public fullnode |
| `https://api.mainnet.aptoslabs.com/v1` | API endpoint |

## Regional HTTPS Endpoints (Less Known)

| Region | Endpoint | Notes |
|--------|----------|-------|
| Staging | `https://api-staging.mainnet.aptoslabs.com/v1` | Staging API |
| Asia Pacific NE | `https://apne1.fullnode.mainnet.aptoslabs.com/v1` | Regional fullnode |
| Asia Pacific NE | `https://apne1-seed.fullnode.mainnet.aptoslabs.com/v1` | Seed node |
| Europe West | `https://euwe4.fullnode.mainnet.aptoslabs.com/v1` | Regional fullnode |
| Europe West | `https://euwe4-backup.fullnode.mainnet.aptoslabs.com/v1` | Backup node |
| US Central East | `https://usce1.fullnode.mainnet.aptoslabs.com/v1` | Regional fullnode |
| US Central East | `https://usce1-seed.fullnode.mainnet.aptoslabs.com/v1` | Seed node |
| US Central East | `https://usce1-backup.fullnode.mainnet.aptoslabs.com/v1` | Backup node |
| Indexer | `https://indexer.mainnet.aptoslabs.com/v1` | Indexer API |

## Internal HTTP VFN Nodes (Gatekept)

These are internal validator full nodes running on port 80 without SSL.
May have different rate limits than public endpoints.

| Region | Endpoint |
|--------|----------|
| Asia Pacific NE | `http://vfn0.apne1-0.mainnet.aptoslabs.com:80/v1` |
| Europe West | `http://vfn0.euwe4-1.mainnet.aptoslabs.com:80/v1` |
| Europe West | `http://vfn0.euwe4-2.mainnet.aptoslabs.com:80/v1` |
| Europe West | `http://vfn0.euwe4-3.mainnet.aptoslabs.com:80/v1` |

## Summary

- **2** Public HTTPS endpoints
- **9** Regional HTTPS endpoints
- **4** Internal HTTP VFN nodes
- **15 total** endpoints

## Discovery Method

Found via certificate transparency logs at crt.sh and pattern enumeration based on testnet VFN naming conventions.

## Rate Limits

TBD - need to test under load to determine rate limits for each endpoint.
