use aptos_sdk::{
    move_types::{
        account_address::AccountAddress, identifier::Identifier, language_storage::ModuleId,
    },
    types::transaction::{EntryFunction, TransactionPayload},
};
use aptos_transaction_generator_lib::publishing::{
    entry_point_trait::{AutomaticArgs, EntryPointTrait, PreBuiltPackages},
    publish_util::Package,
};
use aptos_transaction_workloads_lib::EntryPoints;
use rand::Rng;
use rand::rngs::StdRng;

// Delegate to EntryPoints::Nop for prebuilt packages
static NOP_ENTRY_POINT: EntryPoints = EntryPoints::Nop;

#[derive(Debug, Clone)]
pub struct BuyOutcomeEntryPoint {
    pub contract_address: AccountAddress,
    pub market_addresses: Vec<AccountAddress>,
    pub num_outcomes: u64,
}

impl BuyOutcomeEntryPoint {
    pub fn new(
        contract_address: AccountAddress,
        market_addresses: Vec<AccountAddress>,
        num_outcomes: u64,
    ) -> Self {
        Self {
            contract_address,
            market_addresses,
            num_outcomes,
        }
    }
}

impl EntryPointTrait for BuyOutcomeEntryPoint {
    fn pre_built_packages(&self) -> &'static dyn PreBuiltPackages {
        // Delegate to EntryPoints::Nop for prebuilt packages
        NOP_ENTRY_POINT.pre_built_packages()
    }

    fn package_name(&self) -> &'static str {
        // Use a simple package - it will be deployed but we'll ignore it
        "simple"
    }

    fn module_name(&self) -> &'static str {
        "simple"
    }

    fn create_payload(
        &self,
        _package: &Package, // Ignore the deployed package
        _module_name: &str,
        rng: Option<&mut StdRng>,
        _other: Option<&AccountAddress>,
    ) -> TransactionPayload {
        let rng = rng.expect("RNG required");

        // Randomly select a market from the list
        let market_index = rng.gen_range(0, self.market_addresses.len());
        let market_address = self.market_addresses[market_index];

        let outcome_index = rng.gen_range(0, self.num_outcomes);
        // 1 - 5 USD1 (8 decimals)
        let collateral_in = rng.gen_range(1_0000_000u64, 5_0000_000u64);
        let min_tokens_out = 0u64;

        // Create payload for OUR contract, not the deployed simple package
        let module_id = ModuleId::new(
            self.contract_address,
            Identifier::new("multi_outcome_market").unwrap(),
        );
        let function_name = Identifier::new("buy_outcome").unwrap();

        let args = vec![
            bcs::to_bytes(&market_address).unwrap(),
            bcs::to_bytes(&outcome_index).unwrap(),
            bcs::to_bytes(&collateral_in).unwrap(),
            bcs::to_bytes(&min_tokens_out).unwrap(),
        ];

        TransactionPayload::EntryFunction(EntryFunction::new(
            module_id,
            function_name,
            vec![],
            args,
        ))
    }

    fn automatic_args(&self) -> AutomaticArgs {
        AutomaticArgs::Signer
    }
}
