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
        transaction::{EntryFunction, SignedTransaction, TransactionPayload},
    },
};
use clap::Parser;
use futures::future::join_all;
use rand::{SeedableRng, rngs::StdRng};
use std::str::FromStr;
use std::sync::Arc;

#[derive(Parser, Debug)]
#[command(name = "fund-accounts")]
#[command(about = "Pre-fund test accounts with USD1 for Polymarket load testing")]
struct Args {
    /// RPC endpoint URL
    #[clap(long, default_value = "https://fullnode.testnet.aptoslabs.com/v1")]
    rpc_url: String,

    /// Minter account private key (hex) - must have USD1 mint authority
    #[clap(long, env = "COIN_SOURCE_KEY")]
    coin_source_key: String,

    /// Account minter seed (same as load test). Not required if --recipient is specified.
    #[clap(long, env = "ACCOUNT_MINTER_SEED")]
    account_minter_seed: Option<String>,

    /// Single recipient address to fund (alternative to generating from seed)
    #[clap(long)]
    recipient: Option<String>,

    /// Fund the minter's own account (for self-funding)
    #[clap(long, conflicts_with = "recipient")]
    self_fund: bool,

    /// Node API key for authentication
    #[clap(long, env = "NODE_API_KEY")]
    node_api_key: Option<String>,

    /// USD1 contract address (has usd1::mint function)
    #[clap(
        long,
        default_value = "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea"
    )]
    usd1_contract: String,

    /// Amount of USD1 to mint per account (in smallest units, 8 decimals)
    #[clap(long, default_value_t = 1000_00000000)] // 1000 USD1
    usd1_amount: u64,

    /// Number of accounts to fund (ignored if --recipient is specified)
    #[clap(long, default_value_t = 100)]
    num_accounts: usize,

    /// Batch size for transactions
    #[clap(long, default_value_t = 100)]
    batch_size: usize,
}

fn parse_seed(seed_str: &str) -> Result<[u8; 32]> {
    // Match the emitter's parse_seed exactly:
    // Remove brackets and spaces, split by comma, parse as u8
    let cleaned = seed_str
        .trim_start_matches('[')
        .trim_end_matches(']')
        .replace(' ', "");

    let bytes: Vec<u8> = cleaned
        .split(',')
        .map(|s| s.parse::<u8>())
        .collect::<Result<Vec<_>, _>>()
        .context("Failed to parse seed as comma-separated bytes")?;

    if bytes.len() != 32 {
        anyhow::bail!("Seed must be exactly 32 bytes, got {}", bytes.len());
    }

    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

/// Create USD1 mint payload
/// Calls {usd1_contract}::usd1::mint(recipient, amount)
fn create_usd1_mint_payload(
    usd1_contract: AccountAddress,
    recipient: AccountAddress,
    amount: u64,
) -> TransactionPayload {
    let module_id = ModuleId::new(usd1_contract, Identifier::new("usd1").unwrap());
    let function_name = Identifier::new("mint").unwrap();

    let args = vec![
        bcs::to_bytes(&recipient).unwrap(),
        bcs::to_bytes(&amount).unwrap(),
    ];

    TransactionPayload::EntryFunction(EntryFunction::new(
        module_id,
        function_name,
        vec![], // no type arguments
        args,
    ))
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let args = Args::parse();

    let usd1_contract =
        AccountAddress::from_str(&args.usd1_contract).context("Invalid USD1 contract address")?;

    // Parse minter account
    let minter_key = args.coin_source_key.trim_start_matches("0x");

    // Create client with optional API key
    let client = if let Some(api_key) = &args.node_api_key {
        Client::builder(AptosBaseUrl::Custom(reqwest::Url::parse(&args.rpc_url)?))
            .api_key(api_key)?
            .build()
    } else {
        Client::new(reqwest::Url::parse(&args.rpc_url)?)
    };

    // Create minter account (from_private_key expects hex string)
    let minter_account = LocalAccount::from_private_key(minter_key, 0)
        .context("Failed to create minter account from key")?;

    // Get current sequence number
    let account_info = client
        .get_account(minter_account.address())
        .await
        .context("Failed to get minter account info")?
        .into_inner();
    minter_account.set_sequence_number(account_info.sequence_number);

    // Get chain ID
    let ledger_info = client.get_ledger_information().await?.into_inner();
    let chain_id = ChainId::new(ledger_info.chain_id);

    let usd1_human = args.usd1_amount as f64 / 100_000_000.0;

    // Determine target addresses: either single recipient, self-fund, or generated from seed
    let target_addresses = if args.self_fund {
        // Self-fund mode - mint to the minter's own address
        let addr = minter_account.address();

        println!("USD1 Minting Configuration (Self-Fund):");
        println!("  RPC URL: {}", args.rpc_url);
        println!("  Minter account: {}", addr);
        println!("  USD1 contract: {}", usd1_contract);
        println!(
            "  Amount: {} USD1 ({} units)",
            usd1_human, args.usd1_amount
        );
        println!("  Chain ID: {}", chain_id);
        println!();

        vec![addr]
    } else if let Some(recipient) = &args.recipient {
        // Single recipient mode
        let addr = AccountAddress::from_str(recipient)
            .context("Invalid recipient address")?;

        println!("USD1 Minting Configuration:");
        println!("  RPC URL: {}", args.rpc_url);
        println!("  Minter account: {}", minter_account.address());
        println!("  USD1 contract: {}", usd1_contract);
        println!("  Recipient: {}", addr);
        println!(
            "  Amount: {} USD1 ({} units)",
            usd1_human, args.usd1_amount
        );
        println!("  Chain ID: {}", chain_id);
        println!();

        vec![addr]
    } else if let Some(seed_str) = &args.account_minter_seed {
        // Generate from seed mode
        println!("USD1 Minting Configuration:");
        println!("  RPC URL: {}", args.rpc_url);
        println!("  Minter account: {}", minter_account.address());
        println!("  USD1 contract: {}", usd1_contract);
        println!(
            "  Amount per account: {} USD1 ({} units)",
            usd1_human, args.usd1_amount
        );
        println!("  Number of accounts: {}", args.num_accounts);
        println!("  Chain ID: {}", chain_id);
        println!();

        let seed = parse_seed(seed_str)?;
        let mut rng = StdRng::from_seed(seed);

        let mut addrs = Vec::with_capacity(args.num_accounts);
        for _ in 0..args.num_accounts {
            let account = LocalAccount::generate(&mut rng);
            addrs.push(account.address());
        }

        println!("Generated {} target addresses", addrs.len());
        println!("First 5 addresses:");
        for (i, addr) in addrs.iter().take(5).enumerate() {
            println!("  [{}] {}", i + 1, addr);
        }
        println!();

        addrs
    } else {
        anyhow::bail!("Either --recipient or --account-minter-seed must be provided");
    };

    // Create transaction factory
    let txn_factory = TransactionFactory::new(chain_id)
        .with_gas_unit_price(100)
        .with_max_gas_amount(10_000);

    // Wrap client in Arc for sharing across tasks
    let client = Arc::new(client);

    // Mint USD1 to accounts in batches
    let mut success_count = 0u64;
    let mut fail_count = 0u64;

    for (batch_idx, chunk) in target_addresses.chunks(args.batch_size).enumerate() {
        println!(
            "Processing batch {} ({} accounts)...",
            batch_idx + 1,
            chunk.len()
        );

        // Pre-sign all transactions in the batch (fast, CPU-bound)
        let signed_txns: Vec<SignedTransaction> = chunk
            .iter()
            .map(|addr| {
                let payload = create_usd1_mint_payload(usd1_contract, *addr, args.usd1_amount);
                minter_account.sign_with_transaction_builder(txn_factory.payload(payload))
            })
            .collect();

        // Submit all transactions concurrently
        let submit_futures: Vec<_> = signed_txns
            .iter()
            .map(|txn| {
                let client = Arc::clone(&client);
                async move { client.submit(txn).await }
            })
            .collect();

        let results = join_all(submit_futures).await;

        // Collect results
        let mut last_pending = None;
        for result in results {
            match result {
                Ok(response) => {
                    last_pending = Some(response.into_inner());
                    success_count += 1;
                }
                Err(e) => {
                    eprintln!("  Failed to submit: {:?}", e);
                    fail_count += 1;
                }
            }
        }

        // Wait for last transaction in batch to complete
        if let Some(pending) = last_pending {
            match client.wait_for_transaction(&pending).await {
                Ok(_) => println!("  Batch {} committed", batch_idx + 1),
                Err(e) => eprintln!("  Batch {} wait error: {:?}", batch_idx + 1, e),
            }
        }
    }

    println!();
    println!("Minting complete!");
    println!("  Successful: {}", success_count);
    println!("  Failed: {}", fail_count);
    println!(
        "  Total USD1 minted: {} USD1",
        usd1_human * success_count as f64
    );

    Ok(())
}
