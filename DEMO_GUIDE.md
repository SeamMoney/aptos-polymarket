# 30K TPS DEMO GUIDE

## Infrastructure

| VM | IP | Role | Accounts |
|----|-----|------|----------|
| Worker 1 | 178.128.177.88 | **MASTER** (UI connects here) | 7 |
| Worker 2 | 147.182.237.239 | Secondary | 7 |
| Worker 3 | 161.35.231.0 | Secondary | 6 |
| Fullnode | aptos.cash.trading | Aptos Fullnode | - |

**RPC Endpoints:**
- Your Fullnode: http://aptos.cash.trading:8080/v1
- QuickNode: https://polished-evocative-borough.aptos-testnet.quiknode.pro/...

---

## Quick Start (MORNING CHECKLIST)

### Step 1: Deploy Latest Code (if needed)
```bash
cd ~/aptos-polymarket
./scripts/demo-deploy-all.sh
```

### Step 2: Start All Workers
```bash
./scripts/demo-start-all.sh
```

This starts:
- Worker 1 in **STANDBY MODE** (waits for UI)
- Workers 2 & 3 in **AUTO-START MODE** (quantum 30K TPS)

### Two-Key Security System:
| Key | Action | Location |
|-----|--------|----------|
| **KEY 1** | Run `./scripts/demo-start-all.sh` | Terminal |
| **KEY 2** | Click **ARM SYSTEM** in UI | Browser |
| **→ LAUNCH** | Click **LAUNCH DEMO** | Browser |

### Step 3: ARM + LAUNCH from UI
1. Open: **https://aptos-polymarket.vercel.app/demo-day**
2. Server should show as **Connected** (green) to 178.128.177.88:3001
3. Click **ARM SYSTEM** → Pre-flight checks run
4. All checks pass → Click **LAUNCH DEMO**
5. 3-2-1 countdown → 30K TPS GO!

### Monitor All Workers:
```bash
./scripts/demo-monitor-all.sh
```
Opens a 4-pane tmux dashboard:
- Worker 1 logs (top)
- Worker 2 logs (bottom left)
- Worker 3 logs (bottom right)
- Aggregated TPS stats (bottom)

### Stop All Workers:
```bash
./scripts/demo-stop-all.sh
```

---

## Alternative: Local Testing

If you want to test locally instead of on the VM:

**Option A: Turbo Mode (3K TPS)**
```bash
ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,..." npx tsx server/hft-ultra-server.ts turbo 60
```

**Option B: Quantum Mode (30K TPS)**
```bash
ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,..." npx tsx server/hft-ultra-server.ts quantum 60
```

See full private keys in `scripts/demo-morning.sh`

---

## Monitoring with tmux

### Simple Local Monitor
```bash
# Terminal 1: Run HFT server
ULTRA_PRIVATE_KEYS="..." npx tsx server/hft-ultra-server.ts quantum 60

# Terminal 2: Watch logs (optional, server shows stats)
tail -f /tmp/hft.log
```

### Multi-Worker Dashboard (if using distributed)
```bash
./scripts/demo-dashboard.sh
```

### Dryrun View (minimal resources)
```bash
./scripts/dryrun-view.sh
```

---

## UI Setup

### Open the App
```bash
npm run dev
# Then open: http://localhost:5173
```

### HFT Demo Page (ARM → LAUNCH Control)

Navigate to: **http://localhost:5173/hft-demo**

This page gives you full control with pre-flight checks:

1. **Start Server in Standby Mode**:
```bash
ULTRA_PRIVATE_KEYS="0x6e2fca34586261b6f22a973c20024b78ddb370d87f7c974315fb97ba56716a7f,0xe61d22b3dc37c537a20d5b301c4d2b409b2f93cd7b2915f3518d49517c2ab6c4,0x4542c2e4a39beee8202eee0cddeceea886687b21b54b8f50c17e729251fdd7f5,0xcf5154af9664bbc2634fddfcce2317ed788b35de7f004ac0e24aefd68a0b10c5,ed25519-priv-0xb7d1f406e48c2eddffe987f98445dd4a353e8e9d1630d878621ded084bdd77c7,ed25519-priv-0xa8088ee787b847f6304807a8b09d1afc15409082ee9c8b7eda6919b0ecb86ea8,ed25519-priv-0xb5305eb83498dcba61242ccc91fac35263d9b44bddaf5e7417adbaceb1cfcb36,ed25519-priv-0xc27a6a8b6ed3013da99dc924b2f6af17f1448dedce91691f97d9e778c0761655,ed25519-priv-0xd6402b3493af005ed02b07f6cd7ffdfd37fae6d4d9c88fec6ff38e90f01b21c1,ed25519-priv-0xd375af1a686835905e15bf82f24fcaeed4b1b5b5fabe22c80e998acb804aa295,ed25519-priv-0xC5BA2ED0F5C40EE298E844B1140B6BB31C2671B747C8E9DF4B76054C4C5A8761,ed25519-priv-0x536C886483209657C9B30663B295C7CB007EB57E07931D3E41AF69067897D465,ed25519-priv-0x3E9CB6207207A266F298B1B13648D707BF886766221C3253F30AF68530A79749,ed25519-priv-0x4641D0FDD221B48EF4A45C8DC77D6D4F12D6848E01B7686134564A8CAE5BE637,ed25519-priv-0xFB2AFF37DFED247E9CF407FFA41208A41A78877C1990ADD1F94E00FCE1A5CCAC,ed25519-priv-0x9E338A7FB43F8280CCD82B2929B66F4ED1B7AA7900C40E06EAD934BC7CDEF315,ed25519-priv-0x8E7D4B0196840DA3A7BA6EDEF3784E1B961263F06651B130F440F5D974920B1F,ed25519-priv-0x975CF351CE096E1350C9F9E89ED5CB8D7BEAAEBF7FC235B10F1A0852355EED7A,ed25519-priv-0xD945B44FCFA961B9E4F8DAA5139CF6B4CE9A1DF4838C75701EDC8A429739C097,ed25519-priv-0x292A25EDBE90DCB5F682908C1E7185E1CC127FAD74EEA218167115AA5962866C" npx tsx server/hft-ultra-server.ts
```

2. **Go to HFT Demo page** - Server will show as connected
3. **Click ARM SYSTEM** - Runs pre-flight checks:
   - ✓ HFT Server Connection
   - ✓ Trading Accounts Ready (shows X/Y active)
   - ✓ Market Contract Active
   - ✓ Sufficient Gas Funds (shows APT balance)
4. **Click LAUNCH DEMO** - 3-2-1 countdown then trading starts!
5. **Watch** the TPS counter, trade feed, and Block River visualization
6. **Click STOP DEMO** when done

### What to Show During Demo

1. **Navigate to**: Republican Nominee market
2. **Set timeframe**: Click "1H" or "6H" to see live price updates
3. **Watch for**:
   - Trade Stream showing live trades
   - TPS chart showing real-time throughput
   - Price chart lines moving (on 1H/6H view)
   - Order book updating

---

## TPS Modes Available

| Mode | Target TPS | Command |
|------|-----------|---------|
| dryrun | 10 | `npx tsx server/hft-ultra-server.ts dryrun 60` |
| light | 100 | `npx tsx server/hft-ultra-server.ts light 60` |
| normal | 1,000 | `npx tsx server/hft-ultra-server.ts normal 60` |
| turbo | 3,000 | `npx tsx server/hft-ultra-server.ts turbo 60` |
| ultra | 10,000 | `npx tsx server/hft-ultra-server.ts ultra 60` |
| quantum | 30,000 | `npx tsx server/hft-ultra-server.ts quantum 60` |

---

## Failsafe Strategy

### If 30K TPS fails:
1. Immediately fall back to `ultra` (10K TPS)
2. Say: "We're hitting testnet limits, but even 10K TPS is 100x Ethereum"

### Key Talking Points:
- Aptos mainnet supports 160K+ TPS
- Sub-second finality (not 12 seconds like Ethereum)
- Gas costs are fractions of a cent
- Orderless transactions enable true parallelism

---

## Cost Estimates

| Duration | TPS | Total Txns | Est. Cost |
|----------|-----|-----------|-----------|
| 30 sec | 30K | 900,000 | ~10,000 APT |
| 60 sec | 30K | 1,800,000 | ~20,000 APT |
| 60 sec | 10K | 600,000 | ~7,000 APT |

**Available**: ~495,000 APT across 20 accounts

---

## Troubleshooting

### Port 3001 in use
```bash
kill -9 $(lsof -ti:3001)
```

### No trades showing in UI
- Verify WebSocket URL in `.env.local` matches server
- Check browser console for connection errors
- Make sure timeframe is "1H" or "6H" for live charts

### Low success rate
- Fullnode might be overloaded - try `turbo` instead of `quantum`
- Check fullnode is synced: `curl http://aptos.cash.trading:8080/v1`

---

## Infrastructure

- **Fullnode**: aptos.cash.trading:8080 (Digital Ocean, 8 vCPU, 32GB RAM)
- **Contract**: 0xa2e5e47aab07fed78a3bcf95135ee2dad20c547499c94cb16a3e047859ffa7e1
- **Market**: 0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96
- **Accounts**: 20 accounts, ~24,800 APT each

---

## Files Modified for Demo

- `server/hft-ultra-server.ts` - Uses only custom fullnode, improved trade sampling
- `src/polymarket/MarketDetail.tsx` - Live price integration for charts
- `scripts/demo-checklist.ts` - Pre-demo verification
