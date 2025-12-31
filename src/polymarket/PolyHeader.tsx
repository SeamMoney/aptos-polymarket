import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown, ExternalLink, Wallet, LogOut, Copy, Check } from "lucide-react";
import { WalletSelector, getWalletIcon } from "../components/WalletSelector";

// Polymarket P logo without background (white version)
function PolymarketLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
      <path d="M375.84 389.422C375.84 403.572 375.84 410.647 371.212 414.154C366.585 417.662 359.773 415.75 346.15 411.927L127.22 350.493C119.012 348.19 114.907 347.038 112.534 343.907C110.161 340.776 110.161 336.513 110.161 327.988V184.012C110.161 175.487 110.161 171.224 112.534 168.093C114.907 164.962 119.012 163.81 127.22 161.507L346.15 100.072C359.773 96.2495 366.585 94.338 371.212 97.8455C375.84 101.353 375.84 108.428 375.84 122.578V389.422ZM164.761 330.463L346.035 381.337V279.595L164.761 330.463ZM139.963 306.862L321.201 256L139.963 205.138V306.862ZM164.759 181.537L346.035 232.406V130.663L164.759 181.537Z" fill="white"/>
    </svg>
  );
}

export function PolyHeader() {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use Aptos wallet adapter
  const { account, connected, disconnect, wallet } = useWallet();

  // Check if connected via X-Chain (derived wallet from EVM/Solana)
  const isXChainWallet = wallet?.name?.toLowerCase().includes('ethereum') ||
                          wallet?.name?.toLowerCase().includes('metamask') ||
                          wallet?.name?.toLowerCase().includes('phantom') ||
                          wallet?.name?.toLowerCase().includes('solana');

  // Check if connected via Petra Web (Google/Apple social login)
  const isPetraWebWallet = wallet?.name?.toLowerCase().includes('google') ||
                            wallet?.name?.toLowerCase().includes('apple') ||
                            wallet?.url?.includes('web.petra.app');

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Petra - official logo with P+arrow on purple gradient
  const PETRA_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9InVybCgjcGV0cmFfYmcpIi8+CjxwYXRoIGQ9Ik0zMiAyOEg0OFY2OEgzMlYyOFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00OCAyOEg2OEM3OS4wNDYgMjggODggMzYuOTU0IDg4IDQ4Qzg4IDU5LjA0NiA3OS4wNDYgNjggNjggNjhINDhWMjhaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMzIgNjhINDhWMTAwSDMyVjY4WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTQ4IDY4TDk2IDY4TDcyIDEwMEw0OCA2OFoiIGZpbGw9IndoaXRlIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBldHJhX2JnIiB4MT0iNjQiIHkxPSIwIiB4Mj0iNjQiIHkyPSIxMjgiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzdCNjFGRiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM1QjVFRjAiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K';

  // Show Petra icon for Petra Web wallets, otherwise use wallet's icon
  const walletDisplayName = isPetraWebWallet
    ? 'Petra Web'
    : wallet?.name?.replace(' (Solana)', '').replace(' (Ethereum)', '') || 'Wallet';
  const walletIcon = isPetraWebWallet
    ? PETRA_ICON
    : getWalletIcon(wallet?.name || '', wallet?.icon);

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
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2a3d4e] hover:bg-[#3a4f60] transition-colors"
          >
            {/* Wallet icon */}
            {walletIcon ? (
              <img src={walletIcon} alt={walletDisplayName} className="w-6 h-6 rounded-lg" />
            ) : (
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-green-500" />
            )}
            {/* Address */}
            <span className="text-white text-sm font-medium">
              {formatAddress(account.address.toString())}
            </span>
            {/* Petra Web Badge */}
            {isPetraWebWallet && (
              <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-semibold rounded">
                KEYLESS
              </span>
            )}
            {/* X-Chain Badge */}
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
                  {walletIcon ? (
                    <img src={walletIcon} alt={walletDisplayName} className="w-10 h-10 rounded-xl" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-green-500" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{walletDisplayName}</span>
                      {isPetraWebWallet && (
                        <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-semibold rounded">
                          KEYLESS
                        </span>
                      )}
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

                {/* Petra Web Info */}
                {isPetraWebWallet && (
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-3">
                    <div className="text-purple-400 text-xs">
                      Connected via {wallet?.name?.includes('Google') ? 'Google' : 'Apple'} (Keyless)
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

                {/* Faucet Button */}
                <a
                  href={`https://aptos.dev/en/network/faucet?address=${account?.address.toString()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#22c55e] hover:bg-[#1ea54d] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Wallet size={16} />
                  Get Testnet APT
                  <ExternalLink size={14} />
                </a>
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
            className="bg-[#60a5fa] hover:bg-[#3b82f6] px-3 py-1.5 rounded-lg text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
          >
            <Wallet size={14} />
            Connect
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
