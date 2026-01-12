import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import type { InputViewFunctionData } from '@aptos-labs/ts-sdk';

// Contract configuration - Deployed on Aptos Testnet
// Use env var with fallback to USD1 contract (deployed Jan 11, 2026)
export const PREDICTION_MARKET_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xbdea15f5b0f5449ae8f3a6ae95a5e090bdeeec91be1fcac8375b2f5f37f1c134';

// Testnet USDC token metadata address
export const USDC_ADDRESS = '0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832';

// Module path
const MODULE = `${PREDICTION_MARKET_ADDRESS}::market`;

// Type for Move function paths
type MoveFn = `${string}::${string}::${string}`;

// Initialize Aptos client
const aptosConfig = new AptosConfig({ network: Network.TESTNET });
export const aptos = new Aptos(aptosConfig);

// ==================== Transaction Payloads ====================

/**
 * Create a new prediction market
 */
export function createMarketPayload(
  question: string,
  description: string,
  endTime: number, // Unix timestamp
  initialLiquidity: number // USD1 amount in smallest units (6 decimals)
) {
  return {
    function: `${MODULE}::create_market` as const,
    functionArguments: [question, description, endTime, initialLiquidity],
  };
}

/**
 * Buy YES tokens with USD1
 */
export function buyYesPayload(
  marketAddr: string,
  usd1Amount: number,
  minYesOut: number = 0 // slippage protection
) {
  return {
    function: `${MODULE}::buy_yes` as const,
    functionArguments: [marketAddr, usd1Amount, minYesOut],
  };
}

/**
 * Buy NO tokens with USD1
 */
export function buyNoPayload(
  marketAddr: string,
  usd1Amount: number,
  minNoOut: number = 0
) {
  return {
    function: `${MODULE}::buy_no` as const,
    functionArguments: [marketAddr, usd1Amount, minNoOut],
  };
}

/**
 * Sell YES tokens for USD1
 */
export function sellYesPayload(
  marketAddr: string,
  yesAmount: number,
  minUsd1Out: number = 0
) {
  return {
    function: `${MODULE}::sell_yes` as const,
    functionArguments: [marketAddr, yesAmount, minUsd1Out],
  };
}

/**
 * Sell NO tokens for USD1
 */
export function sellNoPayload(
  marketAddr: string,
  noAmount: number,
  minUsd1Out: number = 0
) {
  return {
    function: `${MODULE}::sell_no` as const,
    functionArguments: [marketAddr, noAmount, minUsd1Out],
  };
}

/**
 * Resolve a market (admin only)
 */
export function resolvePayload(marketAddr: string, outcome: boolean) {
  return {
    function: `${MODULE}::resolve` as const,
    functionArguments: [marketAddr, outcome],
  };
}

/**
 * Redeem winning tokens for USD1
 */
export function redeemPayload(marketAddr: string) {
  return {
    function: `${MODULE}::redeem` as const,
    functionArguments: [marketAddr],
  };
}

// ==================== View Functions ====================

/**
 * Get YES token price (0-100 representing probability %)
 */
export async function getYesPrice(marketAddr: string): Promise<number> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_yes_price` as MoveFn,
    functionArguments: [marketAddr],
  };
  const result = await aptos.view({ payload });
  return Number(result[0]);
}

/**
 * Get NO token price (0-100 representing probability %)
 */
export async function getNoPrice(marketAddr: string): Promise<number> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_no_price` as MoveFn,
    functionArguments: [marketAddr],
  };
  const result = await aptos.view({ payload });
  return Number(result[0]);
}

/**
 * Get market details
 */
export interface MarketInfo {
  question: string;
  description: string;
  endTime: number;
  resolved: boolean;
  outcome: boolean | null;
  yesReserve: number;
  noReserve: number;
}

export async function getMarketInfo(marketAddr: string): Promise<MarketInfo> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_market_info` as MoveFn,
    functionArguments: [marketAddr],
  };
  const result = await aptos.view({ payload });

  return {
    question: result[0] as string,
    description: result[1] as string,
    endTime: Number(result[2]),
    resolved: result[3] as boolean,
    outcome: result[4] ? (result[4] as { vec: boolean[] }).vec[0] ?? null : null,
    yesReserve: Number(result[5]),
    noReserve: Number(result[6]),
  };
}

/**
 * Get user's token balances for a market
 */
export interface UserPositions {
  yesBalance: number;
  noBalance: number;
}

export async function getUserPositions(
  marketAddr: string,
  userAddr: string
): Promise<UserPositions> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_user_positions` as MoveFn,
    functionArguments: [marketAddr, userAddr],
  };
  const result = await aptos.view({ payload });

  return {
    yesBalance: Number(result[0]),
    noBalance: Number(result[1]),
  };
}

/**
 * Get all market addresses
 */
export async function getAllMarkets(): Promise<string[]> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::get_all_markets` as MoveFn,
    functionArguments: [],
  };
  const result = await aptos.view({ payload });
  return result[0] as string[];
}

/**
 * Quote expected output for a buy
 */
export async function quoteBuy(
  marketAddr: string,
  amountIn: number,
  isYes: boolean
): Promise<number> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::quote_buy` as MoveFn,
    functionArguments: [marketAddr, amountIn, isYes],
  };
  const result = await aptos.view({ payload });
  return Number(result[0]);
}

/**
 * Quote expected output for a sell
 */
export async function quoteSell(
  marketAddr: string,
  amountIn: number,
  isYes: boolean
): Promise<number> {
  const payload: InputViewFunctionData = {
    function: `${MODULE}::quote_sell` as MoveFn,
    functionArguments: [marketAddr, amountIn, isYes],
  };
  const result = await aptos.view({ payload });
  return Number(result[0]);
}

// ==================== Helper Functions ====================

/**
 * Convert USD amount to smallest units (6 decimals)
 */
export function toUsd1Units(amount: number): number {
  return Math.floor(amount * 1_000_000);
}

/**
 * Convert from smallest units to USD amount
 */
export function fromUsd1Units(units: number): number {
  return units / 1_000_000;
}

/**
 * Format price as percentage string
 */
export function formatPrice(price: number): string {
  return `${price}%`;
}

/**
 * Format token amount for display
 */
export function formatAmount(units: number): string {
  const amount = fromUsd1Units(units);
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(2)}`;
}
