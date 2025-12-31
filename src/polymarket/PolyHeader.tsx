import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown, Wallet, LogOut, Copy, Check, Loader2, Plus } from "lucide-react";
import { WalletSelector, getWalletIcon } from "../components/WalletSelector";
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

// Global Aptos client for balance fetching
const aptosClient = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// Polymarket P logo without background (white version)
function PolymarketLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
      <path d="M375.84 389.422C375.84 403.572 375.84 410.647 371.212 414.154C366.585 417.662 359.773 415.75 346.15 411.927L127.22 350.493C119.012 348.19 114.907 347.038 112.534 343.907C110.161 340.776 110.161 336.513 110.161 327.988V184.012C110.161 175.487 110.161 171.224 112.534 168.093C114.907 164.962 119.012 163.81 127.22 161.507L346.15 100.072C359.773 96.2495 366.585 94.338 371.212 97.8455C375.84 101.353 375.84 108.428 375.84 122.578V389.422ZM164.761 330.463L346.035 381.337V279.595L164.761 330.463ZM139.963 306.862L321.201 256L139.963 205.138V306.862ZM164.759 181.537L346.035 232.406V130.663L164.759 181.537Z" fill="white"/>
    </svg>
  );
}

// Aptos logo with Polymarket blue ring
function AptosKeylessIcon() {
  return (
    <div className="relative w-6 h-6">
      {/* Blue ring */}
      <div className="absolute inset-0 rounded-full border-2 border-[#3b82f6]" />
      {/* Official Aptos logo centered */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 600 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <path d="M30.6608 171.033C18.0837 197.498 9.30164 226.119 5 256.181H255.339L309.999 171.033H30.6608Z" fill="white"/>
        <path d="M594.999 256.182C590.687 226.111 581.915 197.499 569.338 171.034H419.288L364.648 85.8753H508.549C454.803 33.2026 381.199 0.716797 299.994 0.716797C218.79 0.716797 145.195 33.2026 91.4395 85.8653H364.648L309.988 171.024L364.648 256.172H594.989L594.999 256.182Z" fill="white"/>
        <path d="M146.04 426.5L91.3809 511.648C145.136 564.311 218.601 597.284 299.805 597.284C381.01 597.284 455.718 565.99 509.672 511.648H200.7L146.04 426.5Z" fill="white"/>
        <path d="M200.68 341.331H5C9.31157 371.412 18.0837 400.024 30.6608 426.489H146.04L200.68 341.331Z" fill="white"/>
        <path d="M255.339 426.499H569.339C581.916 400.034 590.698 371.413 595 341.351H309.999L255.339 256.192L200.68 341.341" fill="white"/>
      </svg>
    </div>
  );
}

// Faucet deployer key for demo (testnet only)
const FAUCET_KEY = "0x466C93219D56FC91BBFDD22B127FC9CB717FA9752CB4ED91DF3A1D7B33307BD2";
const FUND_AMOUNT_APT = 50; // $50 worth of APT

export function PolyHeader() {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundStatus, setFundStatus] = useState<"idle" | "success" | "error">("idle");
  const [balance, setBalance] = useState<number>(0);

  // Use Aptos wallet adapter
  const { account, connected, disconnect, wallet } = useWallet();

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    if (!connected || !account?.address) {
      setBalance(0);
      return;
    }
    try {
      const resources = await aptosClient.getAccountResource({
        accountAddress: account.address.toString(),
        resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
      });
      const balanceOctas = (resources as any).coin?.value || 0;
      setBalance(Number(balanceOctas) / 100_000_000);
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance(0);
    }
  }, [connected, account?.address]);

  // Fetch balance on mount and when account changes
  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Check if connected via X-Chain (derived wallet from EVM/Solana)
  const isXChainWallet = wallet?.name?.toLowerCase().includes('ethereum') ||
                          wallet?.name?.toLowerCase().includes('metamask') ||
                          wallet?.name?.toLowerCase().includes('phantom') ||
                          wallet?.name?.toLowerCase().includes('solana');

  // Check if connected via Aptos Keyless (Google/Apple social login)
  const isKeylessWallet = wallet?.name?.toLowerCase().includes('google') ||
                          wallet?.name?.toLowerCase().includes('apple') ||
                          wallet?.url?.includes('web.petra.app');

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Determine which icon to show based on login method
  const isGoogleLogin = wallet?.name?.toLowerCase().includes('google');
  const isAppleLogin = wallet?.name?.toLowerCase().includes('apple');

  const walletDisplayName = isGoogleLogin
    ? 'Google'
    : isAppleLogin
    ? 'Apple'
    : isKeylessWallet
    ? 'Aptos'
    : wallet?.name?.replace(' (Solana)', '').replace(' (Ethereum)', '') || 'Wallet';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = () => {
    setShowWalletSelector(true);
  };

  const handleLogout = () => {
    disconnect();
    setShowDropdown(false);
  };

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fund user with APT directly from our faucet account
  const handleFundWallet = async () => {
    if (!account?.address || isFunding) return;

    setIsFunding(true);
    setFundStatus("idle");

    try {
      const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
      const faucetAccount = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(FAUCET_KEY),
      });

      const amountOctas = Math.floor(FUND_AMOUNT_APT * 100_000_000);
      const recipientAddress = account.address.toString();

      const txn = await aptos.transaction.build.simple({
        sender: faucetAccount.accountAddress,
        data: {
          function: "0x1::aptos_account::transfer",
          functionArguments: [recipientAddress, amountOctas],
        },
      });

      const pending = await aptos.signAndSubmitTransaction({
        signer: faucetAccount,
        transaction: txn,
      });

      const result = await aptos.waitForTransaction({
        transactionHash: pending.hash,
      });

      if (result.success) {
        setFundStatus("success");
        // Refresh local balance immediately
        setTimeout(fetchBalance, 1000);
        // Dispatch event for portfolio page to refresh balance
        window.dispatchEvent(new CustomEvent('wallet-funded', { detail: { amount: FUND_AMOUNT_APT } }));
        setTimeout(() => setFundStatus("idle"), 3000);
      } else {
        setFundStatus("error");
        setTimeout(() => setFundStatus("idle"), 3000);
      }
    } catch (error) {
      console.error("Funding error:", error);
      setFundStatus("error");
      setTimeout(() => setFundStatus("idle"), 3000);
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <header className="sticky top-0 z-[60] px-4 py-2 flex items-center justify-between border-b border-[#2c3f4f]" style={{ backgroundColor: '#1c2b3a' }}>
      {/* Logo */}
      <button
        onClick={() => navigate("/polymarket")}
        className="flex items-center hover:opacity-90 transition-opacity"
      >
        <PolymarketLogo />
        <span className="text-white text-lg font-bold tracking-tight">
          Polymarket
        </span>
      </button>

      {/* Auth buttons or logged-in state */}
      {connected && account ? (
        <div className="flex items-center gap-2">
          {/* Balance Badge */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2a3d52]">
            <span className="text-sm">💵</span>
            <span className="text-[#22c55e] text-sm font-semibold">
              ${balance.toFixed(2)}
            </span>
          </div>

          {/* Wallet Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2a3d4e] hover:bg-[#3a4f60] transition-colors"
            >
            {/* Wallet icon - Aptos logo with blue ring for keyless */}
            {isKeylessWallet ? (
              <AptosKeylessIcon />
            ) : (
              getWalletIcon(wallet?.name || '', wallet?.icon) ? (
                <img src={getWalletIcon(wallet?.name || '', wallet?.icon)} alt={walletDisplayName} className="w-6 h-6 rounded-lg" />
              ) : (
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-green-500" />
              )
            )}
            {/* Address */}
            <span className="text-white text-sm font-medium">
              {formatAddress(account.address.toString())}
            </span>
            {/* X-Chain Badge only */}
            {isXChainWallet && (
              <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-semibold rounded">
                X-CHAIN
              </span>
            )}
            <ChevronDown
              size={16}
              className={`text-[#8297a3] transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Clean Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#1c2b3a] border border-[#3a4f60] rounded-xl shadow-2xl overflow-hidden z-50">
              {/* Wallet Info */}
              <div className="p-4 border-b border-[#3a4f60]">
                <div className="flex items-center gap-3 mb-3">
                  {isKeylessWallet ? (
                    <div className="w-10 h-10 flex items-center justify-center">
                      <div className="relative w-10 h-10">
                        <div className="absolute inset-0 rounded-full border-[3px] border-[#3b82f6]" />
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 600 600"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        >
                          <path d="M30.6608 171.033C18.0837 197.498 9.30164 226.119 5 256.181H255.339L309.999 171.033H30.6608Z" fill="white"/>
                          <path d="M594.999 256.182C590.687 226.111 581.915 197.499 569.338 171.034H419.288L364.648 85.8753H508.549C454.803 33.2026 381.199 0.716797 299.994 0.716797C218.79 0.716797 145.195 33.2026 91.4395 85.8653H364.648L309.988 171.024L364.648 256.172H594.989L594.999 256.182Z" fill="white"/>
                          <path d="M146.04 426.5L91.3809 511.648C145.136 564.311 218.601 597.284 299.805 597.284C381.01 597.284 455.718 565.99 509.672 511.648H200.7L146.04 426.5Z" fill="white"/>
                          <path d="M200.68 341.331H5C9.31157 371.412 18.0837 400.024 30.6608 426.489H146.04L200.68 341.331Z" fill="white"/>
                          <path d="M255.339 426.499H569.339C581.916 400.034 590.698 371.413 595 341.351H309.999L255.339 256.192L200.68 341.341" fill="white"/>
                        </svg>
                      </div>
                    </div>
                  ) : (
                    getWalletIcon(wallet?.name || '', wallet?.icon) ? (
                      <img src={getWalletIcon(wallet?.name || '', wallet?.icon)} alt={walletDisplayName} className="w-10 h-10 rounded-xl" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-green-500" />
                    )
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{walletDisplayName}</span>
                      {isXChainWallet && (
                        <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-semibold rounded">
                          X-CHAIN
                        </span>
                      )}
                    </div>
                    <button
                      onClick={copyAddress}
                      className="flex items-center gap-1 text-[#8297a3] text-xs font-mono hover:text-white transition-colors"
                    >
                      {formatAddress(account.address.toString())}
                      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                {/* Keyless Info */}
                {isKeylessWallet && (
                  <div className="p-2.5 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-lg mb-3">
                    <div className="text-[#60a5fa] text-xs">
                      Aptos Keyless via {wallet?.name?.includes('Google') ? 'Google' : 'Apple'}
                    </div>
                  </div>
                )}

                {/* X-Chain Info */}
                {isXChainWallet && (
                  <div className="p-2.5 bg-orange-500/10 border border-orange-500/30 rounded-lg mb-3">
                    <div className="text-orange-400 text-xs">
                      Connected via X-Chain (AIP-113)
                    </div>
                  </div>
                )}

                {/* Fund Button */}
                <button
                  onClick={handleFundWallet}
                  disabled={isFunding}
                  className={`flex items-center justify-center gap-2 w-full py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${
                    fundStatus === "success"
                      ? "bg-green-600"
                      : fundStatus === "error"
                      ? "bg-red-600"
                      : isFunding
                      ? "bg-[#3b82f6]/50 cursor-not-allowed"
                      : "bg-[#3b82f6] hover:bg-[#2563eb]"
                  }`}
                >
                  {isFunding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : fundStatus === "success" ? (
                    <Check size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  {fundStatus === "success"
                    ? "+$50 Added!"
                    : fundStatus === "error"
                    ? "Failed - Try Again"
                    : isFunding
                    ? "Adding funds..."
                    : "Add $50 Cash"}
                </button>
              </div>

              {/* Disconnect */}
              <div className="p-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="font-medium">Disconnect</span>
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogin}
            className="text-[#8297a3] hover:text-white text-sm font-medium transition-colors px-3 py-1.5"
          >
            Log In
          </button>
          <button
            onClick={handleLogin}
            className="bg-[#289cdd] hover:bg-[#2089c4] px-3 py-1.5 rounded-md text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
          >
            <Wallet size={14} />
            Sign Up
          </button>
        </div>
      )}

      {/* Wallet Selector Modal */}
      <WalletSelector
        isOpen={showWalletSelector}
        onClose={() => setShowWalletSelector(false)}
      />
    </header>
  );
}

// Export for use in other components
export { PolymarketLogo };
