#!/usr/bin/env npx tsx
/**
 * Pre-flight Check for 2000 Account Demo
 *
 * Comprehensive validation before running a 2000-account dual-mode demo.
 * Checks: account funding, distribution, contract state, RPC health, gas budget.
 *
 * Usage:
 *   SEED_MNEMONIC="..." npx tsx scripts/pre-flight-2000.ts
 *   SEED_MNEMONIC="..." npx tsx scripts/pre-flight-2000.ts --dual
 *   SEED_MNEMONIC="..." npx tsx scripts/pre-flight-2000.ts --verbose
 */
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { deriveAccount, validateMnemonic } from '../config/seed-accounts';
// Configuration
const TOTAL_ACCOUNTS = parseInt(process.env.ACCOUNT_COUNT || '2000');
const AMM_ACCOUNTS = parseInt(process.env.AMM_ACCOUNTS || '1500');
const TRANSFER_ACCOUNTS = TOTAL_ACCOUNTS - AMM_ACCOUNTS;
// Minimum balances required
const MIN_APT_PER_ACCOUNT = 0.5; // 0.5 APT for gas (conservative)
const MIN_USD1_FOR_AMM = 100; // 100 USD1 for AMM trading
const MIN_USD1_FOR_TRANSFER = 50; // 50 USD1 for transfers
const OCTAS_PER_APT = 100_000_000;
const USD1_DECIMALS = 100_000_000;
// Contract configuration
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea';
const USD1_MODULE = `${CONTRACT_ADDRESS}::usd1`;
const MULTI_MODULE = `${CONTRACT_ADDRESS}::multi_outcome_market`;
// RPC endpoints to check
const RPC_ENDPOINTS = {
    internal: 'http://vfn0.usce1-0.testnet.aptoslabs.com:80/v1',
    custom: process.env.FULLNODE_URL || 'https://aptos.cash.trading/v1',
};
// Parse args
const args = process.argv.slice(2);
const isDualMode = args.includes('--dual');
const isVerbose = args.includes('--verbose');
const checkOnlyAmm = args.includes('--amm-only');
const sampleSize = parseInt(args.find(a => a.startsWith('--sample='))?.split('=')[1] || '0') || 0;
// ANSI colors
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};
function log(msg) {
    console.log(msg);
}
function logSuccess(msg) {
    console.log(`${c.green}✓${c.reset} ${msg}`);
}
function logError(msg) {
    console.log(`${c.red}✗${c.reset} ${msg}`);
}
function logWarning(msg) {
    console.log(`${c.yellow}⚠${c.reset} ${msg}`);
}
function logInfo(msg) {
    console.log(`${c.cyan}ℹ${c.reset} ${msg}`);
}
async function checkRpcEndpoint(name, url) {
    try {
        const response = await fetch(`${url}`, { method: 'GET' });
        if (response.ok) {
            const data = await response.json();
            if (isVerbose) {
                log(`  ${name}: Chain ID ${data.chain_id}, Block ${data.block_height}`);
            }
            return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
async function checkAccountBalance(aptos, address, index, type) {
    let aptBalance = 0;
    let usd1Balance = 0;
    try {
        aptBalance = await aptos.getAccountAPTAmount({ accountAddress: address });
        aptBalance = aptBalance / OCTAS_PER_APT;
    }
    catch {
        // Account doesn't exist
    }
    try {
        const result = await aptos.view({
            payload: {
                function: `${USD1_MODULE}::balance`,
                functionArguments: [address],
            },
        });
        usd1Balance = Number(result[0]) / USD1_DECIMALS;
    }
    catch {
        // No USD1 balance
    }
    const minUsd1 = type === 'amm' ? MIN_USD1_FOR_AMM : MIN_USD1_FOR_TRANSFER;
    return {
        index,
        address,
        aptBalance,
        usd1Balance,
        hasEnoughApt: aptBalance >= MIN_APT_PER_ACCOUNT,
        hasEnoughUsd1: usd1Balance >= minUsd1,
        type,
    };
}
async function checkMarkets(aptos, marketAddresses) {
    let activeCount = 0;
    for (const market of marketAddresses) {
        try {
            await aptos.view({
                payload: {
                    function: `${MULTI_MODULE}::get_market_info`,
                    functionArguments: [market],
                },
            });
            activeCount++;
        }
        catch {
            // Market not found or error
        }
    }
    return activeCount;
}
async function runPreflight() {
    const result = {
        passed: true,
        accounts: {
            total: TOTAL_ACCOUNTS,
            ammCount: AMM_ACCOUNTS,
            transferCount: TRANSFER_ACCOUNTS,
            aptFunded: 0,
            usd1Funded: 0,
            underfunded: 0,
        },
        balances: {
            totalApt: 0,
            totalUsd1: 0,
            minAptBalance: Infinity,
            minUsd1Balance: Infinity,
        },
        rpc: {
            internal: false,
            custom: false,
            recommendedEndpoint: '',
        },
        contract: {
            deployed: false,
            marketsActive: 0,
        },
        gasBudget: {
            estimatedGasCost: 0,
            estimatedTradingCost: 0,
            totalEstimate: 0,
            available: 0,
            sufficient: false,
        },
        issues: [],
        recommendations: [],
    };
    log('');
    log(`${c.bold}${'='.repeat(70)}${c.reset}`);
    log(`${c.bold}   PRE-FLIGHT CHECK: ${TOTAL_ACCOUNTS} ACCOUNTS${isDualMode ? ' (DUAL MODE)' : ''}${c.reset}`);
    log(`${c.bold}${'='.repeat(70)}${c.reset}`);
    log('');
    // ============================================
    // 1. Check Mnemonic
    // ============================================
    log(`${c.cyan}[1/5] MNEMONIC VALIDATION${c.reset}`);
    const mnemonic = process.env.SEED_MNEMONIC;
    if (!mnemonic) {
        logError('SEED_MNEMONIC environment variable not set');
        result.issues.push('Missing SEED_MNEMONIC');
        result.passed = false;
        return result;
    }
    if (!validateMnemonic(mnemonic)) {
        logError('Invalid mnemonic phrase');
        result.issues.push('Invalid mnemonic phrase');
        result.passed = false;
        return result;
    }
    const wordCount = mnemonic.trim().split(/\s+/).length;
    logSuccess(`Valid ${wordCount}-word mnemonic`);
    log('');
    // ============================================
    // 2. Check RPC Endpoints
    // ============================================
    log(`${c.cyan}[2/5] RPC ENDPOINT HEALTH${c.reset}`);
    result.rpc.internal = await checkRpcEndpoint('Internal VFN', RPC_ENDPOINTS.internal);
    result.rpc.custom = await checkRpcEndpoint('Custom', RPC_ENDPOINTS.custom);
    if (result.rpc.internal) {
        logSuccess(`Internal VFN: ${RPC_ENDPOINTS.internal}`);
        result.rpc.recommendedEndpoint = RPC_ENDPOINTS.internal;
    }
    else {
        logError(`Internal VFN unreachable: ${RPC_ENDPOINTS.internal}`);
        result.issues.push('Internal VFN unreachable');
    }
    if (result.rpc.custom) {
        logSuccess(`Custom fullnode: ${RPC_ENDPOINTS.custom}`);
        if (!result.rpc.recommendedEndpoint) {
            result.rpc.recommendedEndpoint = RPC_ENDPOINTS.custom;
        }
    }
    else {
        logWarning(`Custom fullnode unreachable: ${RPC_ENDPOINTS.custom}`);
    }
    if (!result.rpc.internal && !result.rpc.custom) {
        logError('No RPC endpoints available');
        result.issues.push('No RPC endpoints available');
        result.passed = false;
        return result;
    }
    log('');
    // ============================================
    // 3. Check Contract & Markets
    // ============================================
    log(`${c.cyan}[3/5] CONTRACT & MARKET STATE${c.reset}`);
    const aptos = new Aptos(new AptosConfig({
        network: Network.TESTNET,
        fullnode: result.rpc.recommendedEndpoint,
    }));
    // Check contract deployment
    try {
        await aptos.getAccountModule({
            accountAddress: CONTRACT_ADDRESS,
            moduleName: 'multi_outcome_market',
        });
        result.contract.deployed = true;
        logSuccess(`Contract deployed: ${CONTRACT_ADDRESS.slice(0, 20)}...`);
    }
    catch {
        logError(`Contract not found at ${CONTRACT_ADDRESS.slice(0, 20)}...`);
        result.issues.push('Contract not deployed');
        result.passed = false;
    }
    // Check markets
    const marketAddresses = (process.env.MULTI_MARKETS || '').split(',').filter(m => m.trim());
    if (marketAddresses.length > 0) {
        result.contract.marketsActive = await checkMarkets(aptos, marketAddresses);
        if (result.contract.marketsActive === marketAddresses.length) {
            logSuccess(`All ${marketAddresses.length} markets active`);
        }
        else if (result.contract.marketsActive > 0) {
            logWarning(`${result.contract.marketsActive}/${marketAddresses.length} markets active`);
        }
        else {
            logError('No markets active');
            result.issues.push('No active markets');
        }
    }
    else {
        logWarning('No MULTI_MARKETS configured');
        result.recommendations.push('Set MULTI_MARKETS environment variable');
    }
    log('');
    // ============================================
    // 4. Check Account Funding
    // ============================================
    log(`${c.cyan}[4/5] ACCOUNT FUNDING STATUS${c.reset}`);
    const accountsToCheck = sampleSize > 0 ? sampleSize : TOTAL_ACCOUNTS;
    const checkAll = sampleSize === 0;
    if (!checkAll) {
        logInfo(`Checking ${accountsToCheck} sample accounts (use --sample=0 for all)`);
    }
    else {
        logInfo(`Checking all ${accountsToCheck} accounts...`);
    }
    const batchSize = 50;
    const accountStatuses = [];
    // Determine which accounts to check
    const indicesToCheck = [];
    if (checkAll) {
        // Check all accounts
        for (let i = 0; i < AMM_ACCOUNTS; i++) {
            indicesToCheck.push({ index: i, type: 'amm' });
        }
        if (isDualMode && !checkOnlyAmm) {
            for (let i = AMM_ACCOUNTS; i < TOTAL_ACCOUNTS; i++) {
                indicesToCheck.push({ index: i, type: 'transfer' });
            }
        }
    }
    else {
        // Sample evenly from AMM and transfer ranges
        const ammSample = Math.floor(accountsToCheck * 0.75);
        const transferSample = accountsToCheck - ammSample;
        for (let i = 0; i < ammSample; i++) {
            const idx = Math.floor((i / ammSample) * AMM_ACCOUNTS);
            indicesToCheck.push({ index: idx, type: 'amm' });
        }
        if (isDualMode && !checkOnlyAmm) {
            for (let i = 0; i < transferSample; i++) {
                const idx = AMM_ACCOUNTS + Math.floor((i / transferSample) * TRANSFER_ACCOUNTS);
                indicesToCheck.push({ index: idx, type: 'transfer' });
            }
        }
    }
    // Check accounts in batches
    for (let i = 0; i < indicesToCheck.length; i += batchSize) {
        const batch = indicesToCheck.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(({ index, type }) => {
            const account = deriveAccount(mnemonic, index);
            return checkAccountBalance(aptos, account.accountAddress.toString(), index, type);
        }));
        accountStatuses.push(...batchResults);
        // Progress
        if (isVerbose || i % 200 === 0) {
            process.stdout.write(`\r  Checked ${Math.min(i + batchSize, indicesToCheck.length)}/${indicesToCheck.length} accounts`);
        }
    }
    console.log('');
    // Analyze results
    for (const status of accountStatuses) {
        result.balances.totalApt += status.aptBalance;
        result.balances.totalUsd1 += status.usd1Balance;
        if (status.aptBalance < result.balances.minAptBalance) {
            result.balances.minAptBalance = status.aptBalance;
        }
        if (status.usd1Balance < result.balances.minUsd1Balance) {
            result.balances.minUsd1Balance = status.usd1Balance;
        }
        if (status.hasEnoughApt)
            result.accounts.aptFunded++;
        if (status.hasEnoughUsd1)
            result.accounts.usd1Funded++;
        if (!status.hasEnoughApt || !status.hasEnoughUsd1)
            result.accounts.underfunded++;
        if (isVerbose && (!status.hasEnoughApt || !status.hasEnoughUsd1)) {
            log(`  ${c.yellow}Account ${status.index}${c.reset}: ${status.aptBalance.toFixed(2)} APT, ${status.usd1Balance.toFixed(0)} USD1`);
        }
    }
    const aptPercentage = (result.accounts.aptFunded / accountStatuses.length * 100).toFixed(1);
    const usd1Percentage = (result.accounts.usd1Funded / accountStatuses.length * 100).toFixed(1);
    if (result.accounts.aptFunded === accountStatuses.length) {
        logSuccess(`APT funding: ${result.accounts.aptFunded}/${accountStatuses.length} accounts (${aptPercentage}%)`);
    }
    else if (result.accounts.aptFunded >= accountStatuses.length * 0.95) {
        logWarning(`APT funding: ${result.accounts.aptFunded}/${accountStatuses.length} accounts (${aptPercentage}%)`);
    }
    else {
        logError(`APT funding: ${result.accounts.aptFunded}/${accountStatuses.length} accounts (${aptPercentage}%)`);
        result.issues.push(`${accountStatuses.length - result.accounts.aptFunded} accounts need APT funding`);
    }
    if (result.accounts.usd1Funded === accountStatuses.length) {
        logSuccess(`USD1 funding: ${result.accounts.usd1Funded}/${accountStatuses.length} accounts (${usd1Percentage}%)`);
    }
    else if (result.accounts.usd1Funded >= accountStatuses.length * 0.95) {
        logWarning(`USD1 funding: ${result.accounts.usd1Funded}/${accountStatuses.length} accounts (${usd1Percentage}%)`);
    }
    else {
        logError(`USD1 funding: ${result.accounts.usd1Funded}/${accountStatuses.length} accounts (${usd1Percentage}%)`);
        result.issues.push(`${accountStatuses.length - result.accounts.usd1Funded} accounts need USD1 funding`);
    }
    log(`  Total APT: ${result.balances.totalApt.toFixed(2)} APT`);
    log(`  Total USD1: ${result.balances.totalUsd1.toFixed(0)} USD1`);
    log(`  Min APT balance: ${result.balances.minAptBalance.toFixed(4)} APT`);
    log(`  Min USD1 balance: ${result.balances.minUsd1Balance.toFixed(0)} USD1`);
    log('');
    // ============================================
    // 5. Gas Budget Estimation
    // ============================================
    log(`${c.cyan}[5/5] GAS BUDGET ESTIMATION${c.reset}`);
    // Estimate for 60-second demo
    const demoSeconds = 60;
    const estimatedTps = 5000; // Conservative estimate
    const totalTxns = demoSeconds * estimatedTps;
    const gasPerTxn = 0.0002; // ~0.0002 APT per transaction
    result.gasBudget.estimatedGasCost = totalTxns * gasPerTxn;
    result.gasBudget.estimatedTradingCost = 0; // No collateral cost for demo
    result.gasBudget.totalEstimate = result.gasBudget.estimatedGasCost;
    result.gasBudget.available = result.balances.totalApt;
    result.gasBudget.sufficient = result.balances.totalApt >= result.gasBudget.totalEstimate;
    log(`  Estimated transactions (60s @ ${estimatedTps} TPS): ${totalTxns.toLocaleString()}`);
    log(`  Estimated gas cost: ${result.gasBudget.estimatedGasCost.toFixed(2)} APT`);
    log(`  Available APT: ${result.gasBudget.available.toFixed(2)} APT`);
    if (result.gasBudget.sufficient) {
        logSuccess(`Gas budget sufficient (${(result.gasBudget.available / result.gasBudget.totalEstimate).toFixed(1)}x margin)`);
    }
    else {
        logError(`Insufficient gas budget`);
        result.issues.push('Insufficient APT for gas budget');
        result.passed = false;
    }
    log('');
    // ============================================
    // Summary
    // ============================================
    log(`${c.bold}${'='.repeat(70)}${c.reset}`);
    if (result.issues.length === 0 && result.accounts.underfunded < accountStatuses.length * 0.05) {
        log(`${c.bold}${c.green}   PRE-FLIGHT CHECK: PASSED${c.reset}`);
        result.passed = true;
    }
    else if (result.accounts.underfunded < accountStatuses.length * 0.1) {
        log(`${c.bold}${c.yellow}   PRE-FLIGHT CHECK: WARNING${c.reset}`);
        result.passed = true; // Proceed with caution
    }
    else {
        log(`${c.bold}${c.red}   PRE-FLIGHT CHECK: FAILED${c.reset}`);
        result.passed = false;
    }
    log(`${c.bold}${'='.repeat(70)}${c.reset}`);
    log('');
    if (result.issues.length > 0) {
        log(`${c.red}Issues:${c.reset}`);
        for (const issue of result.issues) {
            log(`  - ${issue}`);
        }
        log('');
    }
    if (result.recommendations.length > 0) {
        log(`${c.yellow}Recommendations:${c.reset}`);
        for (const rec of result.recommendations) {
            log(`  - ${rec}`);
        }
        log('');
    }
    // Fund commands if needed
    if (result.accounts.underfunded > 0) {
        log(`${c.cyan}To fix funding issues:${c.reset}`);
        log(`  # Fund APT:`);
        log(`  SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts --apt-only --count ${TOTAL_ACCOUNTS}`);
        log('');
        log(`  # Fund USD1:`);
        log(`  SEED_MNEMONIC="..." npx tsx scripts/fund-seed-accounts.ts --usd1-only --count ${TOTAL_ACCOUNTS}`);
        log('');
    }
    // Next steps
    if (result.passed) {
        log(`${c.cyan}Ready to run:${c.reset}`);
        if (isDualMode) {
            log(`  ./scripts/demo.sh standby --dual`);
            log(`  ./scripts/demo.sh launch 60 --dual`);
        }
        else {
            log(`  ./scripts/demo.sh standby`);
            log(`  ./scripts/demo.sh launch 60`);
        }
        log('');
    }
    return result;
}
// Run
runPreflight()
    .then((result) => {
    process.exit(result.passed ? 0 : 1);
})
    .catch((err) => {
    console.error('Pre-flight check failed:', err);
    process.exit(1);
});
