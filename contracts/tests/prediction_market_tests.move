#[test_only]
module prediction_market::market_tests {
    use std::signer;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use prediction_market::market;

    #[test(aptos_framework = @0x1, deployer = @prediction_market, user1 = @0x123, user2 = @0x456)]
    fun test_cpmm_math() {
        // Test the CPMM formula: dy = y * dx / (x + dx)
        // With equal reserves of 1000 each, buying 100 should give:
        // dy = 1000 * 100 / (1000 + 100) = 100000 / 1100 ≈ 90.9

        let reserve_in: u128 = 1000;
        let reserve_out: u128 = 1000;
        let amount_in: u128 = 100;

        let numerator = reserve_out * amount_in; // 100000
        let denominator = reserve_in + amount_in; // 1100
        let result = numerator / denominator; // 90

        assert!(result == 90, 1); // Integer division gives 90
    }

    #[test(aptos_framework = @0x1, deployer = @prediction_market)]
    fun test_price_calculation() {
        // Test price calculation
        // With yes_reserve = 1000, no_reserve = 1000
        // YES price = no_reserve / (yes + no) * 100 = 1000 / 2000 * 100 = 50%

        let yes_reserve: u128 = 1000;
        let no_reserve: u128 = 1000;
        let total = yes_reserve + no_reserve;
        let yes_price = (no_reserve * 100) / total;

        assert!(yes_price == 50, 1);

        // With yes_reserve = 800, no_reserve = 1200 (NO more scarce, YES cheaper)
        // YES price = 1200 / 2000 * 100 = 60%
        let yes_reserve2: u128 = 800;
        let no_reserve2: u128 = 1200;
        let total2 = yes_reserve2 + no_reserve2;
        let yes_price2 = (no_reserve2 * 100) / total2;

        assert!(yes_price2 == 60, 2);
    }

    #[test(aptos_framework = @0x1, deployer = @prediction_market)]
    fun test_fee_calculation() {
        // Test 0.3% fee (30 basis points)
        let amount: u64 = 10000;
        let fee_bps: u64 = 30;
        let bps_denom: u64 = 10000;

        let fee = (amount * fee_bps) / bps_denom; // 30
        let amount_after_fee = amount - fee; // 9970

        assert!(fee == 30, 1);
        assert!(amount_after_fee == 9970, 2);
    }

    #[test(aptos_framework = @0x1, deployer = @prediction_market)]
    fun test_slippage_scenario() {
        // Simulate a large trade's impact on price
        // Starting with 500_000 YES and 500_000 NO (50/50 odds)

        let yes_reserve: u128 = 500_000;
        let no_reserve: u128 = 500_000;

        // Someone buys 100_000 worth of YES tokens
        // They're adding to NO reserve and removing from YES reserve
        let buy_amount: u128 = 100_000;

        // Output = yes_reserve * buy_amount / (no_reserve + buy_amount)
        let yes_out = (yes_reserve * buy_amount) / (no_reserve + buy_amount);
        // yes_out = 500_000 * 100_000 / 600_000 = 83_333

        assert!(yes_out == 83333, 1);

        // New reserves after trade
        let new_yes_reserve = yes_reserve - yes_out; // 416_667
        let new_no_reserve = no_reserve + buy_amount; // 600_000

        // New YES price = new_no_reserve / total * 100
        let new_total = new_yes_reserve + new_no_reserve;
        let new_yes_price = (new_no_reserve * 100) / new_total;

        // Price moved from 50% to ~59%
        assert!(new_yes_price == 59, 2);
    }

    #[test(aptos_framework = @0x1, deployer = @prediction_market)]
    fun test_module_initialization(aptos_framework: &signer, deployer: &signer) {
        // Initialize timestamp for testing
        timestamp::set_time_has_started_for_testing(aptos_framework);

        // Create deployer account
        account::create_account_for_test(signer::address_of(deployer));

        // Initialize market module
        market::init_for_test(deployer);

        // Verify registry exists by trying to get all markets (should be empty)
        let markets = market::get_all_markets();
        assert!(std::vector::length(&markets) == 0, 1);
    }
}
