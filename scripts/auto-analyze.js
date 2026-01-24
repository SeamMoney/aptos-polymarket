#!/usr/bin/env npx tsx
/**
 * Auto-Analyze - Unified Post-Run Analysis
 *
 * Runs all analysis scripts in sequence after a demo run.
 * Chains: analyze-submitted-txns → analyze-tps → deep-tps-analysis
 *
 * Usage:
 *   npx tsx scripts/auto-analyze.ts                     # Analyze default path
 *   npx tsx scripts/auto-analyze.ts /path/to/txns.json  # Analyze specific file
 *   npx tsx scripts/auto-analyze.ts --minutes 5         # Last 5 minutes
 *   npx tsx scripts/auto-analyze.ts --quick             # Only run analyze-tps
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
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
// Parse args
const args = process.argv.slice(2);
const quickMode = args.includes('--quick');
const minutes = args.find(a => a.startsWith('--minutes='))?.split('=')[1] ||
    (args.includes('--minutes') ? args[args.indexOf('--minutes') + 1] : '5');
const txnsFile = args.find(a => !a.startsWith('--') && (a.endsWith('.json') || a.includes('/tmp/')));
// Default paths
const DEFAULT_TXNS_FILE = '/tmp/hft-submitted-txns.json';
const SCRIPTS_DIR = path.dirname(new URL(import.meta.url).pathname);
function log(msg) {
    console.log(msg);
}
function logHeader(title) {
    log('');
    log(`${c.bold}${'='.repeat(70)}${c.reset}`);
    log(`${c.bold}   ${title}${c.reset}`);
    log(`${c.bold}${'='.repeat(70)}${c.reset}`);
    log('');
}
function runScript(name, command) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        log(`${c.cyan}Running:${c.reset} ${command}`);
        log('');
        try {
            const output = execSync(command, {
                cwd: path.join(SCRIPTS_DIR, '..'),
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 300000, // 5 minute timeout
            });
            console.log(output);
            resolve({
                script: name,
                success: true,
                duration: Date.now() - startTime,
                output,
            });
        }
        catch (err) {
            const duration = Date.now() - startTime;
            // Even on error, we might have partial output
            if (err.stdout) {
                console.log(err.stdout);
            }
            if (err.stderr) {
                console.error(err.stderr);
            }
            resolve({
                script: name,
                success: false,
                duration,
                error: err.message,
                output: err.stdout,
            });
        }
    });
}
async function main() {
    const results = [];
    log('');
    log(`${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════════════════╗${c.reset}`);
    log(`${c.bold}${c.cyan}║                    APTOS POLYMARKET POST-RUN ANALYSIS                ║${c.reset}`);
    log(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════════════════════╝${c.reset}`);
    log('');
    const targetFile = txnsFile || DEFAULT_TXNS_FILE;
    // Check if txns file exists
    if (fs.existsSync(targetFile)) {
        log(`${c.green}✓${c.reset} Transaction file found: ${targetFile}`);
        const stats = fs.statSync(targetFile);
        log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
        log(`  Modified: ${stats.mtime.toISOString()}`);
    }
    else {
        log(`${c.yellow}⚠${c.reset} Transaction file not found: ${targetFile}`);
        log(`  Will analyze blockchain data only`);
    }
    log(`${c.dim}  Mode: ${quickMode ? 'Quick (analyze-tps only)' : 'Full (all scripts)'}${c.reset}`);
    log(`${c.dim}  Time range: Last ${minutes} minutes${c.reset}`);
    log('');
    // ============================================
    // 1. Block-based TPS Analysis (always run first - most reliable)
    // ============================================
    logHeader('1. BLOCK-BASED TPS ANALYSIS (Ground Truth)');
    const tpsResult = await runScript('analyze-tps', `npx tsx scripts/analyze-tps.ts --minutes ${minutes}`);
    results.push(tpsResult);
    if (quickMode) {
        // Quick mode - only run analyze-tps
        logHeader('ANALYSIS COMPLETE (Quick Mode)');
    }
    else {
        // ============================================
        // 2. Transaction Hash Verification (if file exists)
        // ============================================
        if (fs.existsSync(targetFile)) {
            logHeader('2. TRANSACTION HASH VERIFICATION');
            const txnsResult = await runScript('analyze-submitted-txns', `npx tsx scripts/analyze-submitted-txns.ts ${targetFile}`);
            results.push(txnsResult);
        }
        else {
            log(`${c.dim}Skipping transaction hash verification (no file)${c.reset}`);
        }
        // ============================================
        // 3. Deep Analysis (comprehensive breakdown)
        // ============================================
        logHeader('3. DEEP TPS ANALYSIS');
        // Check if deep-tps-analysis.ts exists
        const deepAnalysisPath = path.join(SCRIPTS_DIR, 'deep-tps-analysis.ts');
        if (fs.existsSync(deepAnalysisPath)) {
            const deepResult = await runScript('deep-tps-analysis', `npx tsx scripts/deep-tps-analysis.ts --minutes ${minutes}`);
            results.push(deepResult);
        }
        else {
            log(`${c.yellow}⚠${c.reset} deep-tps-analysis.ts not found, skipping`);
        }
        // ============================================
        // Summary
        // ============================================
        logHeader('ANALYSIS SUMMARY');
    }
    // Print summary
    log(`${c.bold}Scripts Run:${c.reset}`);
    for (const result of results) {
        const status = result.success ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
        const duration = (result.duration / 1000).toFixed(1);
        log(`  ${status} ${result.script} (${duration}s)`);
        if (!result.success && result.error) {
            log(`    ${c.red}Error: ${result.error.slice(0, 80)}${c.reset}`);
        }
    }
    log('');
    // Check for results directory
    const resultsDir = path.join(SCRIPTS_DIR, '..', 'results');
    if (fs.existsSync(resultsDir)) {
        const subdirs = fs.readdirSync(resultsDir).filter(f => fs.statSync(path.join(resultsDir, f)).isDirectory()).sort().reverse();
        if (subdirs.length > 0) {
            log(`${c.cyan}Recent result directories:${c.reset}`);
            for (const dir of subdirs.slice(0, 3)) {
                log(`  results/${dir}/`);
            }
            log('');
        }
    }
    // Next steps
    log(`${c.cyan}Next steps:${c.reset}`);
    log(`  # View detailed block analysis:`);
    log(`  npx tsx scripts/analyze-peak-blocks.ts --block <BLOCK_HEIGHT>`);
    log('');
    log(`  # Analyze specific block range:`);
    log(`  npx tsx scripts/analyze-tps.ts --range <START> <END>`);
    log('');
    // Exit with appropriate code
    const allPassed = results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);
}
main().catch((err) => {
    console.error('Analysis failed:', err);
    process.exit(1);
});
