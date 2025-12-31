# Demo Day UI Implementation Plan

## Goal
Create a polished demo experience that looks like Polymarket, with a "Start HFT Mode" button that triggers the bots and shows real-time TPS visualization with block river.

## Design Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] Polymarket on Aptos          [Live] [Testnet] [Connect] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Who will be the Republican Presidential Nominee 2028?  │   │
│  │  Politics • Multi-Outcome • Ends Jan 2028               │   │
│  │                                                         │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │J.D.Vance│ │M. Rubio │ │D. Trump │ │DeSantis │       │   │
│  │  │  17.2¢  │ │  16.8¢  │ │  16.5¢  │ │  16.3¢  │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  │  ┌─────────┐ ┌─────────┐                               │   │
│  │  │ Carlson │ │  Other  │                               │   │
│  │  │  16.1¢  │ │  16.0¢  │                               │   │
│  │  └─────────┘ └─────────┘                               │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  ⚡ START HFT MODE                               │   │   │
│  │  │  Watch 20 bots trade at 10,000+ TPS             │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  Vol: 5,000 APT  •  139,800 APT ready for demo         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────── HFT Mode Active ───────────────               │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │  CURRENT TPS        │  │  Block River (iframe)           │  │
│  │  ████████ 8,547     │  │  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐   │  │
│  │  Peak: 12,340       │  │  │█│█│▓│▒│█│▓│▒│░│█│▓│█│▒│░│   │  │
│  │                     │  │  ├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤   │  │
│  │  [TPS Graph]        │  │  │▓│▒│█│░│▓│█│▒│█│▓│░│▒│█│▓│   │  │
│  │  ╱╲_╱╲__╱╲╱╲       │  │  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘   │  │
│  │                     │  │  Live blocks from Aptos testnet │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Live Trade Stream                                        │ │
│  │  Bot Alpha  BUY J.D. Vance    0.5 APT   [142ms] 0x3f2...  │ │
│  │  Bot Beta   SELL DeSantis     0.3 APT   [138ms] 0x7a1...  │ │
│  │  Bot Gamma  BUY Trump         0.8 APT   [145ms] 0x9c4...  │ │
│  │  ...                                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Stats: 45,230 trades | 99.2% success | 141ms avg latency │ │
│  │  Aptos: ~400ms finality | 160k+ peak TPS | <$0.001 fees   │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create DemoMarketPage Component
**File:** `src/components/DemoMarketPage.tsx`

A new full-page component that:
- Fetches the multi-outcome market data (2028 GOP Nominee)
- Displays outcomes in Polymarket style (centered, clean cards)
- Has "Start HFT Mode" button instead of buy/sell
- Shows HFT status (connected/disconnected)

### Step 2: Create HFTDashboard Component
**File:** `src/components/HFTDashboard.tsx`

Combines:
- Large TPS counter with graph (from DemoMode.tsx)
- Block River iframe (from VisualizerEmbed.tsx)
- Live trade stream (from HFTVisualizer.tsx)
- Stats bar

This appears below the market when HFT is active.

### Step 3: Add Route for Demo Page
**File:** `src/App.tsx`

Add route `/demo-day` that renders `<DemoMarketPage />`

### Step 4: WebSocket Integration
The "Start HFT Mode" button will:
1. Connect to WebSocket at `ws://localhost:3001` (or configured HFT server)
2. Send start command via REST: `POST /start`
3. Receive trade updates and display in dashboard
4. "Stop" button appears to end the demo

## Component Structure

```
DemoMarketPage
├── Header (Polymarket-style)
├── MarketHero
│   ├── Market Question & Category
│   ├── Outcome Grid (prices updating live)
│   └── StartHFTButton OR StopHFTButton
├── HFTDashboard (only visible when running)
│   ├── TPSPanel (large counter + graph)
│   ├── BlockRiverEmbed (iframe)
│   ├── TradeStream (live trades)
│   └── StatsBar
└── Footer
```

## Key Features

1. **Live Price Updates**: Prices update in real-time as bots trade
2. **Dramatic TPS Display**: Large, animated TPS counter
3. **Block River**: Shows Aptos blocks being produced
4. **Trade Stream**: Scrolling list of bot trades with tx hashes
5. **One-Click Start**: Single button to begin the demo

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/DemoMarketPage.tsx` | CREATE | Main demo day page |
| `src/components/HFTDashboard.tsx` | CREATE | TPS + Block River + Trades |
| `src/components/TPSDisplay.tsx` | CREATE | Large TPS counter component |
| `src/App.tsx` | MODIFY | Add `/demo-day` route |
| `src/main.tsx` | MODIFY | Add router if needed |

## Technical Notes

- Block River URL: `https://aptos-consensus-visualizer.vercel.app/`
- HFT Server: `ws://localhost:3001` (WebSocket) and `http://localhost:3001` (REST)
- Market Address: `0xfefd1b67818ee4ef12a7953852c83f0efb411a9b92c518a52ba92555e4abdd96`

## Questions for User

1. **Market Choice**: Use existing "2028 GOP Nominee" market or create a new one?
2. **Block River**: Embed full visualizer or just the block stream section?
3. **Auto-stop**: Should demo auto-stop after X seconds/trades?
