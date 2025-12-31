import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Trophy, DollarSign, Rocket, Code2, Moon, ChevronUp } from "lucide-react";

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

  // Check localStorage for auth state
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("polymarket_logged_in") === "true";
  });

  // Listen for storage changes
  useEffect(() => {
    const checkAuth = () => {
      setIsLoggedIn(localStorage.getItem("polymarket_logged_in") === "true");
    };
    window.addEventListener("storage", checkAuth);
    window.addEventListener("focus", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("focus", checkAuth);
    };
  }, []);

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
    localStorage.removeItem("polymarket_logged_in");
    setIsLoggedIn(false);
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
      {isLoggedIn ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#1c2b3a] transition-colors"
          >
            <GradientAvatar size={38} />
            <ChevronUp
              size={18}
              color="#8297a3"
              strokeWidth={2.5}
              className={`transition-transform duration-200 ${showDropdown ? "" : "rotate-180"}`}
            />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#1c2b3a] border-2 border-[#3a4f60] rounded-2xl shadow-xl overflow-hidden z-50">
              {/* User info with Portfolio/Cash */}
              <div className="p-4 border-b-2 border-[#3a4f60]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <GradientAvatar size={44} />
                    <span className="text-white text-lg font-semibold">User</span>
                  </div>
                  <button
                    onClick={() => { navigate("/portfolio"); setShowDropdown(false); }}
                    className="p-2 hover:bg-[#2a3d4e] rounded-lg transition-colors"
                  >
                    <Settings size={20} color="#8297a3" strokeWidth={2.5} />
                  </button>
                </div>
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
                  Logout
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
            className="bg-[#4A90C2] hover:bg-[#3A80B2] px-5 py-2.5 rounded text-white text-base font-bold transition-colors"
          >
            Sign Up
          </button>
        </div>
      )}
    </header>
  );
}

// Export for use in other components
export { GradientAvatar, PolymarketLogo };
