import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// Condensed code snippets from the actual contracts
const multiOutcomeCode = `/// Multi-Outcome Prediction Market with Complete Sets Model
/// A Polymarket-style prediction market on Aptos
/// TPS OPTIMIZATIONS:
/// - Table registry for O(1) lookups
/// - Separate OutcomeMarket objects for parallelization
/// - Aggregator_v2 for parallel state updates

module prediction_market::multi_outcome_market {
    use std::string::{Self, String};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::aggregator_v2::{Self, Aggregator};
    use aptos_std::table::{Self, Table};

    /// Separate object for each outcome (parallel trading)
    struct OutcomeMarket has key {
        market_addr: address,
        outcome_index: u64,
        label: String,
        metadata: Object<Metadata>,
        reserve: Aggregator<u64>,
        base_reserve: Aggregator<u64>,
    }

    /// Multi-outcome prediction market
    struct MultiMarket has key {
        question: String,
        outcome_addresses: vector<address>,
        outcome_count: u64,
        collateral_metadata: Object<Metadata>,
        total_collateral: Aggregator<u64>,
        resolved: bool,
        winning_outcome: Option<u64>,
    }

    /// Buy tokens using CPMM pricing
    /// TPS OPTIMIZED: Only locks specific OutcomeMarket
    public entry fun buy_outcome(
        buyer: &signer,
        market_addr: address,
        outcome_index: u64,
        collateral_in: u64,
        min_tokens_out: u64,
    ) acquires MultiMarket, OutcomeMarket {
        let market = borrow_global_mut<MultiMarket>(market_addr);
        assert!(!market.resolved, E_MARKET_ALREADY_RESOLVED);

        // Lock ONLY that outcome - enables parallelism
        let outcome = borrow_global_mut<OutcomeMarket>(outcome_addr);

        // CPMM: tokens_out = reserve * amount / (base + amount)
        let tokens_out = calculate_buy_output(
            base_reserve, outcome_reserve, amount_after_fee
        );

        aggregator_v2::add(&mut outcome.base_reserve, amount);
        aggregator_v2::sub(&mut outcome.reserve, tokens_out);

        // Mint tokens to buyer
        let tokens = fungible_asset::mint(&outcome.mint_ref, tokens_out);
        primary_fungible_store::deposit(buyer_addr, tokens);
    }
}`;

const usd1Code = `/// USD1 Stablecoin - High-TPS Collateral Token
///
/// WHY THIS EXISTS:
/// Using APT as collateral causes 356:1 state contention
/// This custom FA enables 10,000+ TPS

module prediction_market::usd1 {
    use std::string::{Self, String};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::primary_fungible_store;

    struct TokenRefs has key {
        mint_ref: MintRef,
        burn_ref: BurnRef,
        transfer_ref: TransferRef,
    }

    /// Initialize USD1 Stablecoin
    public entry fun initialize(deployer: &signer) {
        let constructor_ref = object::create_named_object(
            deployer, b"USD1_STABLECOIN_V1"
        );

        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::none(), // No max supply
            string::utf8(b"USD1 Stablecoin"),
            string::utf8(b"USD1"),
            8, // decimals
        );
    }

    /// Mint tokens (open for demo)
    public entry fun mint(
        _minter: &signer,
        recipient: address,
        amount: u64,
    ) acquires TokenRegistry, TokenRefs {
        let tokens = fungible_asset::mint(&refs.mint_ref, amount);
        primary_fungible_store::deposit(recipient, tokens);
    }
}`;

export const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: multi_outcome_market.move (0-20s = 0-600 frames)
  // Phase 2: usd1.move (20-30s = 600-900 frames)
  const phase1Duration = fps * 20;
  const phase2Start = fps * 20;

  const isPhase1 = frame < phase2Start;
  const currentCode = isPhase1 ? multiOutcomeCode : usd1Code;
  const fileName = isPhase1 ? "multi_outcome_market.move" : "usd1.move";

  const phaseFrame = isPhase1 ? frame : frame - phase2Start;
  const phaseDuration = isPhase1 ? phase1Duration : fps * 10;

  // Characters per frame (typing speed)
  const charsPerFrame = currentCode.length / phaseDuration;
  const visibleChars = Math.floor(phaseFrame * charsPerFrame);
  const visibleCode = currentCode.substring(0, visibleChars);

  // Calculate current line for scroll
  const lines = visibleCode.split("\n");
  const lineCount = lines.length;
  const maxVisibleLines = 25;
  const scrollOffset = Math.max(0, lineCount - maxVisibleLines);

  // Cursor blink
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  const polymarketColors = {
    purple: "#8B5CF6",
    blue: "#3B82F6",
    green: "#10B981",
    cyan: "#06B6D4",
    yellow: "#F59E0B",
    red: "#EF4444",
    gray: "#6B7280",
  };

  // Syntax highlighting
  const highlightSyntax = (code: string): React.ReactNode[] => {
    const lines = code.split("\n");
    return lines.slice(scrollOffset).map((line, index) => {
      let highlighted = line;

      // Keywords
      highlighted = highlighted.replace(
        /\b(module|struct|public|entry|fun|has|key|use|let|mut|if|else|while|return|assert!|acquires)\b/g,
        `<span style="color: ${polymarketColors.purple}">$1</span>`
      );

      // Types
      highlighted = highlighted.replace(
        /\b(address|u64|u128|bool|String|Object|Option|Table|Aggregator|vector)\b/g,
        `<span style="color: ${polymarketColors.cyan}">$1</span>`
      );

      // Comments
      highlighted = highlighted.replace(
        /(\/\/\/?.*)$/gm,
        `<span style="color: ${polymarketColors.gray}">$1</span>`
      );

      // Strings
      highlighted = highlighted.replace(
        /("[^"]*"|b"[^"]*")/g,
        `<span style="color: ${polymarketColors.green}">$1</span>`
      );

      // Numbers
      highlighted = highlighted.replace(
        /\b(\d+)\b/g,
        `<span style="color: ${polymarketColors.yellow}">$1</span>`
      );

      // Function calls
      highlighted = highlighted.replace(
        /(\w+)(\s*\()/g,
        `<span style="color: ${polymarketColors.blue}">$1</span>$2`
      );

      return (
        <div
          key={index}
          style={{
            minHeight: 22,
            display: "flex",
          }}
        >
          <span
            style={{
              color: "#444",
              width: 50,
              textAlign: "right",
              paddingRight: 15,
              userSelect: "none",
            }}
          >
            {scrollOffset + index + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: highlighted }} />
        </div>
      );
    });
  };

  const terminalScale = spring({
    frame: frame - fps * 0.5,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
    },
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 30% 70%, ${polymarketColors.purple}15, #0d0d0d 60%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          transform: `scale(${terminalScale})`,
          width: "95%",
          maxWidth: 1400,
          height: "90%",
          backgroundColor: "#1a1a1a",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 0 100px ${polymarketColors.purple}33`,
          border: `1px solid ${polymarketColors.purple}44`,
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            height: 40,
            background: `linear-gradient(90deg, ${polymarketColors.purple}22, ${polymarketColors.blue}22)`,
            display: "flex",
            alignItems: "center",
            padding: "0 15px",
            gap: 8,
            borderBottom: "1px solid #333",
          }}
        >
          <div
            style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FF5F56" }}
          />
          <div
            style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#FFBD2E" }}
          />
          <div
            style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#27CA40" }}
          />
          <span
            style={{
              marginLeft: 20,
              color: "#888",
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            contracts/sources/{fileName}
          </span>
          <span
            style={{
              marginLeft: "auto",
              color: polymarketColors.green,
              fontSize: 12,
              background: `${polymarketColors.green}22`,
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            Move
          </span>
        </div>

        {/* Code Area */}
        <div
          style={{
            padding: 20,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 14,
            lineHeight: 1.6,
            color: "#e0e0e0",
            height: "calc(100% - 80px)",
            overflow: "hidden",
          }}
        >
          {highlightSyntax(visibleCode)}
          {cursorVisible && (
            <span
              style={{
                backgroundColor: polymarketColors.purple,
                width: 8,
                height: 18,
                display: "inline-block",
                marginLeft: 2,
                animation: "blink 1s infinite",
              }}
            />
          )}
        </div>

        {/* Status Bar */}
        <div
          style={{
            height: 30,
            backgroundColor: polymarketColors.purple,
            display: "flex",
            alignItems: "center",
            padding: "0 15px",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#fff",
          }}
        >
          <span>MOVE</span>
          <span>
            Line {lineCount}, Col {(lines[lineCount - 1]?.length || 0) + 1}
          </span>
          <span>UTF-8</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
