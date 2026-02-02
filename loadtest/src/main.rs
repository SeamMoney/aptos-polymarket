mod config;
mod polymarket_entrypoint;

use anyhow::{Context, Result};
use aptos_logger::{Level, Logger};
use aptos_sdk::move_types::account_address::AccountAddress;
use aptos_transaction_emitter_lib::emit_transactions;
use aptos_transaction_generator_lib::TransactionType;
use clap::Parser;
use config::Args;
use polymarket_entrypoint::BuyOutcomeEntryPoint;
use serde::Serialize;
use std::str::FromStr;

/// Serializable version of TxnStats for JSON output
#[derive(Serialize)]
struct StatsOutput {
    submitted: u64,
    committed: u64,
    expired: u64,
    failed_submission: u64,
    latency_ms_total: u64,
    latency_samples: u64,
    duration_secs: f64,
    rate_submitted_per_sec: f64,
    rate_committed_per_sec: f64,
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    Logger::builder().level(Level::Info).build();

    let args = Args::parse();

    let contract_addr = AccountAddress::from_str(&args.transaction_type.contract)
        .context("Invalid contract address")?;

    let market_addrs: Vec<AccountAddress> = args
        .transaction_type
        .markets
        .iter()
        .enumerate()
        .map(|(i, m)| {
            AccountAddress::from_str(m)
                .with_context(|| format!("Invalid market address at index {}: {}", i, m))
        })
        .collect::<Result<Vec<_>>>()?;

    let num_outcomes = args.transaction_type.num_outcomes;

    println!("Polymarket Load Test");
    if let Ok(targets) = args.cluster_args.get_targets() {
        println!("RPC Endpoints: {} total", targets.len());
        for (i, target) in targets.iter().enumerate() {
            println!("  [{}] {}", i + 1, target);
        }
    }
    println!("Contract: {}", contract_addr);
    println!("Markets: {} total", market_addrs.len());
    for (i, addr) in market_addrs.iter().enumerate() {
        println!("  [{}] {}", i + 1, addr);
    }
    println!("Duration: {}s", args.emit_args.duration);
    println!("Mempool backlog: {:?}", args.emit_args.mempool_backlog);
    println!();

    let entry_point = BuyOutcomeEntryPoint::new(contract_addr, market_addrs, num_outcomes);
    let transaction_mix = vec![vec![(
        TransactionType::CallCustomModules {
            entry_point: Box::new(entry_point),
            num_modules: 1,
            use_account_pool: false,
        },
        1, // weight
    )]];

    println!("Starting...");

    let stats = emit_transactions(&args.cluster_args, &args.emit_args, transaction_mix)
        .await
        .context("Emit transactions failed")?;

    println!();
    println!("Complete!");
    println!("Stats: {}", stats);
    println!("Rate: {}", stats.rate());

    if let Some(output_path) = &args.output {
        let rate = stats.rate();
        let output = StatsOutput {
            submitted: stats.submitted,
            committed: stats.committed,
            expired: stats.expired,
            failed_submission: stats.failed_submission,
            latency_ms_total: stats.latency,
            latency_samples: stats.latency_samples,
            duration_secs: stats.lasted.as_secs_f64(),
            rate_submitted_per_sec: rate.submitted,
            rate_committed_per_sec: rate.committed,
        };
        let json = serde_json::to_string_pretty(&output)?;
        std::fs::write(output_path, json)?;
        println!("Results saved to: {}", output_path.display());
    }

    Ok(())
}
