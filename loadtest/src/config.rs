use aptos_transaction_emitter_lib::{ClusterArgs, EmitArgs};
use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "polymarket-loadtest")]
#[command(about = "Load test for Aptos Polymarket contracts")]
pub struct Args {
    #[clap(flatten)]
    pub cluster_args: ClusterArgs,

    #[clap(flatten)]
    pub emit_args: EmitArgs,

    #[clap(flatten)]
    pub transaction_type: PolymarketTransactionTypeArg,

    /// Path to write JSON stats when the run completes
    #[clap(long)]
    pub output: Option<PathBuf>,
}

#[derive(Parser, Debug, Clone)]
pub struct PolymarketTransactionTypeArg {
    /// Contract (multi_outcome_market) account address
    #[clap(long, required = true)]
    pub contract: String,

    /// Market account addresses (can specify multiple times)
    #[clap(long = "market", required = true, num_args = 1..)]
    pub markets: Vec<String>,

    /// Number of outcomes on the markets (assumes all markets have same number)
    #[clap(long, default_value_t = 2)]
    pub num_outcomes: u64,
}
