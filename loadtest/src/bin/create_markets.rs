use anyhow::{Context, Result};
use aptos_sdk::{
    move_types::{
        account_address::AccountAddress, identifier::Identifier, language_storage::ModuleId,
    },
    rest_client::{AptosBaseUrl, Client},
    transaction_builder::TransactionFactory,
    types::{
        LocalAccount,
        chain_id::ChainId,
        transaction::{EntryFunction, TransactionPayload},
    },
};
use clap::Parser;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::str::FromStr;

#[derive(Parser, Debug)]
#[command(name = "create-markets")]
#[command(about = "Create prediction markets for Polymarket load testing")]
struct Args {
    /// RPC endpoint URL
    #[clap(long, default_value = "https://fullnode.testnet.aptoslabs.com/v1")]
    rpc_url: String,

    /// Market creator private key (hex)
    #[clap(long, env = "COIN_SOURCE_KEY")]
    creator_key: String,

    /// Node API key for authentication
    #[clap(long, env = "NODE_API_KEY")]
    node_api_key: Option<String>,

    /// Contract address (multi_outcome_market module)
    #[clap(
        long,
        default_value = "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
    )]
    contract: String,

    /// USD1 metadata address for collateral
    #[clap(
        long,
        default_value = "0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3"
    )]
    usd1_metadata: String,

    /// Number of markets to create
    #[clap(long, default_value_t = 10)]
    num_markets: usize,

    /// Output file to save market addresses
    #[clap(long, default_value = "markets.txt")]
    output: String,

    /// Initial liquidity per market (in USD1 units, 8 decimals). Set to 0 for no liquidity.
    #[clap(long, default_value_t = 0)]
    initial_liquidity: u64,

    /// Market duration in seconds from now
    #[clap(long, default_value_t = 86400 * 365)] // 1 year
    duration_secs: u64,

    /// Append to existing file instead of overwriting
    #[clap(long)]
    append: bool,
}

/// Create market payload
/// Calls {contract}::multi_outcome_market::create_multi_market_with_collateral
fn create_market_payload(
    contract: AccountAddress,
    usd1_metadata: AccountAddress,
    question: String,
    description: String,
    category: String,
    outcomes: Vec<String>,
    end_time: u64,
    initial_liquidity: u64,
) -> TransactionPayload {
    let module_id = ModuleId::new(contract, Identifier::new("multi_outcome_market").unwrap());
    let function_name = Identifier::new("create_multi_market_with_collateral").unwrap();

    let args = vec![
        bcs::to_bytes(&question).unwrap(),
        bcs::to_bytes(&description).unwrap(),
        bcs::to_bytes(&category).unwrap(),
        bcs::to_bytes(&outcomes).unwrap(),
        bcs::to_bytes(&end_time).unwrap(),
        bcs::to_bytes(&initial_liquidity).unwrap(),
        bcs::to_bytes(&usd1_metadata).unwrap(),
    ];

    TransactionPayload::EntryFunction(EntryFunction::new(
        module_id,
        function_name,
        vec![],
        args,
    ))
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let args = Args::parse();

    let contract =
        AccountAddress::from_str(&args.contract).context("Invalid contract address")?;
    let usd1_metadata =
        AccountAddress::from_str(&args.usd1_metadata).context("Invalid USD1 metadata address")?;

    // Parse creator account
    let creator_key = args.creator_key.trim_start_matches("0x");

    // Create client with optional API key
    let client = if let Some(api_key) = &args.node_api_key {
        Client::builder(AptosBaseUrl::Custom(reqwest::Url::parse(&args.rpc_url)?))
            .api_key(api_key)?
            .build()
    } else {
        Client::new(reqwest::Url::parse(&args.rpc_url)?)
    };

    // Create creator account
    let creator_account = LocalAccount::from_private_key(creator_key, 0)
        .context("Failed to create account from key")?;

    // Get current sequence number
    let account_info = client
        .get_account(creator_account.address())
        .await
        .context("Failed to get creator account info")?
        .into_inner();
    creator_account.set_sequence_number(account_info.sequence_number);

    // Get chain ID and current time
    let ledger_info = client.get_ledger_information().await?.into_inner();
    let chain_id = ChainId::new(ledger_info.chain_id);
    let current_time_secs = ledger_info.timestamp_usecs / 1_000_000; // Convert microseconds to seconds
    let end_time = current_time_secs + args.duration_secs;

    println!("Market Creation Configuration:");
    println!("  RPC URL: {}", args.rpc_url);
    println!("  Creator account: {}", creator_account.address());
    println!("  Contract: {}", contract);
    println!("  USD1 metadata: {}", usd1_metadata);
    println!("  Number of markets: {}", args.num_markets);
    println!("  Initial liquidity: {} USD1", args.initial_liquidity as f64 / 100_000_000.0);
    println!("  End time: {} (in {} days)", end_time, args.duration_secs / 86400);
    println!("  Output file: {}", args.output);
    println!("  Chain ID: {}", chain_id);
    println!();

    // Create transaction factory
    let txn_factory = TransactionFactory::new(chain_id)
        .with_gas_unit_price(100)
        .with_max_gas_amount(50_000);

    // Open output file
    let mut output_file = if args.append {
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(&args.output)?
    } else {
        File::create(&args.output)?
    };

    // Count existing markets if appending
    let existing_count = if args.append && std::path::Path::new(&args.output).exists() {
        let file = File::open(&args.output)?;
        BufReader::new(file).lines().count()
    } else {
        0
    };

    let mut success_count = 0;
    let mut fail_count = 0;

    for i in 0..args.num_markets {
        let market_num = existing_count + i + 1;
        let question = format!("Load Test Market #{}", market_num);
        let description = format!("Automated load test market created for stress testing. Market #{}", market_num);
        let category = "Load Test".to_string();
        let outcomes = vec!["Yes".to_string(), "No".to_string()];

        println!("Creating market #{}...", market_num);

        let payload = create_market_payload(
            contract,
            usd1_metadata,
            question,
            description,
            category,
            outcomes,
            end_time,
            args.initial_liquidity,
        );

        let txn = creator_account.sign_with_transaction_builder(txn_factory.payload(payload));

        match client.submit_and_wait(&txn).await {
            Ok(response) => {
                let txn = response.into_inner();

                // Extract market address from transaction events
                let mut market_address = None;

                // Get events from the transaction
                let events = match &txn {
                    aptos_sdk::rest_client::Transaction::UserTransaction(ut) => {
                        Some(ut.events.as_slice())
                    }
                    _ => None,
                };

                if let Some(events) = events {
                    for event in events {
                        let event_type = event.typ.to_string();
                        // Look for market creation event
                        if event_type.contains("MarketCreated") || event_type.contains("CreateMarket") {
                            // Try to extract address from event data
                            if let Some(addr) = event.data.get("market_address")
                                .or_else(|| event.data.get("market"))
                                .or_else(|| event.data.get("market_id"))
                            {
                                market_address = addr.as_str().map(String::from);
                            }
                        }
                    }
                }

                // Get transaction hash
                let txn_hash = match &txn {
                    aptos_sdk::rest_client::Transaction::UserTransaction(ut) => {
                        ut.info.hash.to_string()
                    }
                    _ => "unknown".to_string(),
                };

                // If we couldn't find the market address in events,
                // save the txn hash so user can look it up
                let addr_to_save = market_address.unwrap_or_else(|| {
                    format!("txn:{}", txn_hash)
                });

                writeln!(output_file, "{}", addr_to_save)?;
                println!("  Created: {} (txn: {})", addr_to_save, txn_hash);
                success_count += 1;
            }
            Err(e) => {
                eprintln!("  Failed to create market #{}: {:?}", market_num, e);
                fail_count += 1;
            }
        }
    }

    println!();
    println!("Market creation complete!");
    println!("  Successful: {}", success_count);
    println!("  Failed: {}", fail_count);
    println!("  Markets saved to: {}", args.output);

    Ok(())
}
