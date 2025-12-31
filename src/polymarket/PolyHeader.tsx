import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Settings, Trophy, DollarSign, Rocket, Code2, Moon, ChevronUp, ExternalLink, Wallet } from "lucide-react";

// Polymarket P logo without background (white version)
function PolymarketLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
      <path d="M375.84 389.422C375.84 403.572 375.84 410.647 371.212 414.154C366.585 417.662 359.773 415.75 346.15 411.927L127.22 350.493C119.012 348.19 114.907 347.038 112.534 343.907C110.161 340.776 110.161 336.513 110.161 327.988V184.012C110.161 175.487 110.161 171.224 112.534 168.093C114.907 164.962 119.012 163.81 127.22 161.507L346.15 100.072C359.773 96.2495 366.585 94.338 371.212 97.8455C375.84 101.353 375.84 108.428 375.84 122.578V389.422ZM164.761 330.463L346.035 381.337V279.595L164.761 330.463ZM139.963 306.862L321.201 256L139.963 205.138V306.862ZM164.759 181.537L346.035 232.406V130.663L164.759 181.537Z" fill="white"/>
    </svg>
  );
}

// Gradient avatar component
function GradientAvatar({ size = 40, onClick }: { size?: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full overflow-hidden hover:opacity-90 transition-opacity"
      style={{ width: size, height: size }}
    >
      <div
        className="w-full h-full"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #22c55e 50%, #f472b6 100%)",
        }}
      />
    </button>
  );
}

export function PolyHeader() {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Use Aptos wallet adapter
  const { account, connected, disconnect, wallet } = useWallet();

  // Check if connected via X-Chain (derived wallet from EVM/Solana)
  const isXChainWallet = wallet?.name?.toLowerCase().includes('ethereum') ||
                          wallet?.name?.toLowerCase().includes('metamask') ||
                          wallet?.name?.toLowerCase().includes('phantom') ||
                          wallet?.name?.toLowerCase().includes('solana');

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
    navigate("/login");
  };

  const handleLogout = () => {
    disconnect();
    setShowDropdown(false);
  };

  return (
    <header className="sticky top-0 z-[60] px-4 py-3 flex items-center justify-between border-b-2 border-[#2c3f4f]" style={{ backgroundColor: '#1c2b3a' }}>
      {/* Logo */}
      <button
        onClick={() => navigate("/polymarket")}
        className="flex items-center hover:opacity-90 transition-opacity"
      >
        <PolymarketLogo />
        <span className="text-white text-xl font-bold tracking-tight">
          Polymarket
        </span>
      </button>

      {/* Auth buttons or logged-in state */}
      {connected && account ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#2a3d4e] transition-colors"
          >
            {/* X-Chain Badge */}
            {isXChainWallet && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 rounded-full">
                <span className="text-[10px] font-semibold text-orange-400">X-CHAIN</span>
              </div>
            )}
            {/* Connected indicator */}
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            {/* Wallet icon or avatar */}
            {wallet?.icon ? (
              <img src={wallet.icon} alt={wallet.name} className="w-6 h-6 rounded-full" />
            ) : (
              <GradientAvatar size={28} />
            )}
            {/* Address */}
            <span className="text-white text-sm font-mono">
              {formatAddress(account.address.toString())}
            </span>
            <ChevronUp
              size={18}
              color="#8297a3"
              strokeWidth={2.5}
              className={`transition-transform duration-200 ${showDropdown ? "" : "rotate-180"}`}
            />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#1c2b3a] border-2 border-[#3a4f60] rounded-2xl shadow-xl overflow-hidden z-50">
              {/* Wallet info */}
              <div className="p-4 border-b-2 border-[#3a4f60]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {wallet?.icon ? (
                      <img src={wallet.icon} alt={wallet.name} className="w-10 h-10 rounded-lg" />
                    ) : (
                      <GradientAvatar size={40} />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-base font-semibold">{wallet?.name || 'Wallet'}</span>
                        {isXChainWallet && (
                          <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-semibold rounded-full">
                            X-CHAIN
                          </span>
                        )}
                      </div>
                      <span className="text-[#8297a3] text-xs font-mono">
                        {formatAddress(account.address.toString())}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => { navigate("/portfolio"); setShowDropdown(false); }}
                    className="p-2 hover:bg-[#2a3d4e] rounded-lg transition-colors"
                  >
                    <Settings size={20} color="#8297a3" strokeWidth={2.5} />
                  </button>
                </div>

                {/* X-Chain Info Banner */}
                {isXChainWallet && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl mb-3">
                    <div className="text-orange-400 text-xs font-semibold mb-1">
                      Cross-Chain Connection Active
                    </div>
                    <div className="text-[#8297a3] text-xs leading-relaxed">
                      Your {wallet?.name} wallet is connected to Aptos via Derived Account Abstraction (AIP-113)
                    </div>
                  </div>
                )}

                {/* Faucet Button */}
                <a
                  href={`https://aptos.dev/en/network/faucet?address=${account?.address.toString()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#22c55e]/20 text-[#22c55e] text-sm font-medium rounded-xl hover:bg-[#22c55e]/30 transition-colors"
                >
                  <Wallet size={16} />
                  Get Testnet APT (Faucet)
                  <ExternalLink size={14} />
                </a>
              </div>

              {/* Portfolio Stats */}
              <div className="px-4 py-3 border-b-2 border-[#3a4f60]">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[#8297a3] text-xs font-medium">Portfolio</p>
                    <p className="text-[#22c55e] text-lg font-bold">$0.00</p>
                  </div>
                  <div>
                    <p className="text-[#8297a3] text-xs font-medium">Cash</p>
                    <p className="text-[#22c55e] text-lg font-bold">$0.00</p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#2a3d4e] transition-colors">
                  <Trophy size={20} color="#f59e0b" strokeWidth={2.5} />
                  <span className="text-white font-medium">Leaderboard</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#2a3d4e] transition-colors">
                  <DollarSign size={20} color="#22c55e" strokeWidth={2.5} />
                  <span className="text-white font-medium">Rewards</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#2a3d4e] transition-colors">
                  <Rocket size={20} color="#ec4899" strokeWidth={2.5} />
                  <span className="text-white font-medium">APIs</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#2a3d4e] transition-colors">
                  <Code2 size={20} color="#8297a3" strokeWidth={2.5} />
                  <span className="text-white font-medium">Builders</span>
                </button>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Moon size={20} color="#60a5fa" strokeWidth={2.5} />
                    <span className="text-white font-medium">Dark mode</span>
                  </div>
                  <div className="w-11 h-6 bg-[#3b82f6] rounded-full flex items-center justify-end px-0.5">
                    <div className="w-5 h-5 bg-white rounded-full" />
                  </div>
                </div>
              </div>

              {/* Full Address */}
              <div className="px-4 py-2 border-t border-[#3a4f60]">
                <div className="text-[10px] text-[#6b7a8a] mb-1">Full Aptos Address</div>
                <div className="text-[11px] text-[#8297a3] font-mono break-all">
                  {account?.address.toString()}
                </div>
              </div>

              {/* Footer Links */}
              <div className="border-t-2 border-[#3a4f60] p-2">
                <button className="w-full text-left px-3 py-2 text-[#8297a3] hover:text-white transition-colors">Accuracy</button>
                <button className="w-full text-left px-3 py-2 text-[#8297a3] hover:text-white transition-colors">Support</button>
                <button className="w-full text-left px-3 py-2 text-[#8297a3] hover:text-white transition-colors">Documentation</button>
                <button className="w-full text-left px-3 py-2 text-[#8297a3] hover:text-white transition-colors">Terms of Use</button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-[#ef4444] hover:text-[#f87171] transition-colors"
                >
                  Disconnect Wallet
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogin}
            className="text-[#5BA3D9] text-base font-semibold hover:opacity-80 transition-opacity px-3 py-2"
          >
            Log In
          </button>
          <button
            onClick={handleLogin}
            className="bg-[#4A90C2] hover:bg-[#3A80B2] px-5 py-2.5 rounded text-white text-base font-bold transition-colors flex items-center gap-2"
          >
            <Wallet size={18} />
            Connect
          </button>
        </div>
      )}
    </header>
  );
}

// Export for use in other components
export { GradientAvatar, PolymarketLogo };
