# HFT Transaction Failure Analysis

## Executive Summary

**Root Cause Identified**: The HFT trading bot attempts to sell outcome tokens that accounts don't own, causing ~30% of transactions to fail with `E_INSUFFICIENT_BALANCE`.

This is NOT primarily a mempool or liquidity issue - it's a **logic bug** in `trading-worker.ts`.

## The Bug

Location: `server/trading-worker.ts:262-284`

```typescript
// 70% buys, 30% sells
const isBuy = Math.random() < 0.7;

if (isBuy) {
  return { function: 'buy_outcome', args: [market, outcomeIndex, amount, 0] };
} else {
  // BUG: Sells a DIFFERENT outcome than what was bought
  const otherOutcome = (outcomeIndex + 1) % outcomeCount;
  return { function: 'sell_outcome', args: [market, otherOutcome, amount, 0] };
}
```

### Why This Fails

1. Account randomly decides to sell (30% probability)
2. It picks a random outcome, then sells `(outcomeIndex + 1) % 4`
3. The account likely never bought that specific outcome
4. The `sell_outcome` function calls `primary_fungible_store::withdraw()` for tokens the account doesn't have
5. Transaction fails with error code `0x10006` (INSUFFICIENT_BALANCE)

### Verified On-Chain

```
Account: 0x71e98979245631561776bc6ff32dddbb2983595d8891086a31e3e75ab7ac76b2
Positions: [ '7653123', '0', '9673645', '12753049' ]
                        ^-- Outcome 1 has 0 balance

Attempting sell outcome 1...
SIMULATION FAILED: INSUFFICIENT_BALANCE
>>> CONFIRMED: Cannot sell tokens you do not own!
```

## AMM Mechanics Refresher

### CPMM Formulas

**Buy**: `tokens_out = outcome_reserve * amount_in / (base_reserve + amount_in)`
- User pays collateral
- `base_reserve` increases
- `outcome_reserve` decreases
- Tokens minted to user

**Sell**: `collateral_out = base_reserve * tokens_in / (outcome_reserve + tokens_in)`
- User burns outcome tokens
- `outcome_reserve` increases
- `base_reserve` decreases
- Collateral returned to user

### Key Constraint

**You can only sell tokens you own.** The contract calls:
```move
let tokens = primary_fungible_store::withdraw(seller, outcome.metadata, tokens_in);
```

If the seller doesn't have `tokens_in` amount of outcome tokens, this fails.

## Error Code Reference

| Code | Name | Cause |
|------|------|-------|
| 1 | E_NOT_AUTHORIZED | Not market creator |
| 6 | E_INSUFFICIENT_LIQUIDITY | Not enough liquidity |
| 7 | E_SLIPPAGE_EXCEEDED | min_tokens not met |
| 8 | E_ZERO_AMOUNT | Zero amount provided |
| 12 | E_INSUFFICIENT_BALANCE | **No tokens to sell** |
| 0x10006 | FA_INSUFFICIENT_BALANCE | fungible_asset withdraw failed |

## Impact on Demo TPS

If the bot is configured for 70% buys / 30% sells, and most sells fail:
- **Theoretical failure rate**: ~30% (all sell attempts)
- **Observed success rate**: ~70-80% (matches buy-only success)

The Aptos employee's observation is **partially correct**:
- Some failures ARE from mempool flooding (sequence number conflicts, timeouts)
- But a significant portion (~30%) is from this sell logic bug

## Solutions

### Option 1: Buy-Only Mode (Quick Fix)
```typescript
// In buildPayload():
const isBuy = true; // Always buy, never sell
```

**Pros**: Immediate fix, no state tracking needed
**Cons**: Prices will drift (no arbitrage), not realistic trading

### Option 2: Track Holdings Per Account (Correct Fix)

```typescript
// Track what each account owns
const accountHoldings = new Map<string, Map<string, bigint>>(); // account -> (outcome -> amount)

function buildPayload(account: string, market: string) {
  const holdings = accountHoldings.get(account)?.get(market + ':' + outcomeIndex) || 0n;

  // Only sell if we have tokens
  const canSell = holdings > amount;
  const isBuy = !canSell || Math.random() < 0.7;

  if (isBuy) {
    // Update holdings after success
    // holdings += tokens_received
  } else {
    // holdings -= tokens_sold
  }
}
```

**Pros**: Accurate simulation, can sell what was bought
**Cons**: More complex, need to track state across workers

### Option 3: Pre-Fund with Complete Sets (Best for Demo)

Before demo, mint complete sets for all accounts:
```typescript
// 1 USD1 → 1 of EACH outcome token
await mint_complete_set(account, market, 1000_000_000); // 10 USD1 = 10 of each outcome
```

Then accounts can freely buy OR sell any outcome.

**Pros**: Most realistic trading, accounts start with inventory
**Cons**: Requires setup step, uses more USD1

### Option 4: Balanced Batch Emitter (Recommended)

Design batches where sells ≤ buys per outcome per account:

```typescript
function buildBalancedBatch(account: Account, market: string, batchSize: number) {
  const trades = [];
  const pendingBuys: Record<number, number> = {}; // outcome -> count

  for (let i = 0; i < batchSize; i++) {
    const outcome = Math.floor(Math.random() * 4);

    // 70% buy, 30% sell (if we have pending buys)
    const wantSell = Math.random() > 0.7;
    const canSell = (pendingBuys[outcome] || 0) > 0;

    if (wantSell && canSell) {
      trades.push({ action: 'sell', outcome, amount });
      pendingBuys[outcome]--;
    } else {
      trades.push({ action: 'buy', outcome, amount });
      pendingBuys[outcome] = (pendingBuys[outcome] || 0) + 1;
    }
  }

  return trades;
}
```

**Constraint**: `sells[outcome] ≤ buys[outcome]` for each outcome in each batch

## Downstream Effects

### 1. Batch Transaction Ordering

When using sequential sequence numbers, sell transactions must come AFTER buy transactions for the same outcome. Consider:

```
Batch for account A:
  seq 1: buy outcome 0 → gets 100 tokens
  seq 2: sell outcome 0 → uses 50 tokens (OK, has 100)
  seq 3: buy outcome 1 → gets 80 tokens
  seq 4: sell outcome 1 → uses 30 tokens (OK, has 80)
```

If using orderless transactions, this ordering doesn't matter since each tx is independent.

### 2. Cross-Worker Coordination

If account A is shared across workers (it shouldn't be!), holdings tracking becomes complex. Solution: Each account belongs to exactly one worker.

### 3. Initial Liquidity Bootstrap

For fresh accounts with no tokens, first transactions MUST be buys. Consider:
- First N transactions: buy only
- Then: balanced buy/sell

## Recommended Implementation

1. **Immediate**: Switch to buy-only mode for next demo
2. **Short-term**: Implement Option 4 (balanced batch emitter)
3. **Long-term**: Pre-fund accounts with complete sets for realistic simulation

## Verification Commands

```bash
# Test sell without tokens
npx tsx scripts/test-sell-without-tokens.ts

# Check account positions
npx tsx -e '... get_user_multi_positions ...'

# Analyze recent transaction failures
npx tsx -e '... getAccountTransactions ...'
```
