import { useLocation, useNavigate } from "react-router-dom";
import { Home, Search, TrendingUp } from "lucide-react";

// Portfolio wallet icon
function PortfolioIcon({ active }: { active: boolean }) {
  const color = active ? "#2E5CFF" : "#8297a3";
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      {/* Wallet body */}
      <rect x="2" y="6" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Wallet flap */}
      <path d="M2 10h20" strokeLinecap="round" strokeLinejoin="round" />
      {/* Card/money slots */}
      <circle cx="16" cy="14" r="1.5" fill={color} stroke="none" />
    </svg>
  );
}

interface NavItem {
  path: string;
  label: string;
  icon?: typeof Home;
  customIcon?: "portfolio";
}

const navItems: NavItem[] = [
  { path: "/polymarket", label: "Home", icon: Home },
  { path: "/polymarket/search", label: "Search", icon: Search },
  { path: "/polymarket/breaking", label: "Trending", icon: TrendingUp },
  { path: "/portfolio", label: "$0.00", customIcon: "portfolio" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/polymarket") {
      return location.pathname === "/polymarket" || location.pathname.startsWith("/market/") || location.pathname.startsWith("/outcome/");
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#152231] border-t border-[#2c3f4f] z-50">
      <div className="flex items-center justify-around h-18 max-w-lg mx-auto py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center flex-1 h-full transition-colors"
            >
              {item.customIcon === "portfolio" ? (
                <PortfolioIcon active={active} />
              ) : Icon ? (
                <Icon
                  size={28}
                  color={active ? "#2E5CFF" : "#8297a3"}
                  strokeWidth={2.5}
                />
              ) : null}
              <span
                className={`text-xs mt-1.5 font-medium ${
                  active ? "text-poly-blue" : "text-[#8297a3]"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
