import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

// Home icon - filled when active, outlined when inactive (matches Polymarket)
function HomeIcon({ active }: { active: boolean }) {
  const color = active ? "#f2f2f2" : "#899cb2";
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" stroke={active ? "#1d2b3a" : color} />
    </svg>
  );
}

// Portfolio chart icon
function PortfolioIcon({ active }: { active: boolean }) {
  const color = active ? "#f2f2f2" : "#899cb2";
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <g stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M2.75,10.75l3.646-3.646c.195-.195,.512-.195,.707,0l3.293,3.293c.195,.195,.512,.195,.707,0l4.146-4.146" />
        <path d="M2.75,2.75V12.75c0,1.105,.895,2,2,2H15.25" />
      </g>
    </svg>
  );
}

// Breaking icon for navbar
function BreakingNavIcon({ active }: { active: boolean }) {
  const color = active ? "#f2f2f2" : "#899cb2";
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <path d="M16.5099 5.41065L11.4375 10.7299C11.2425 10.9249 10.9255 10.9249 10.7305 10.7299L7.27047 7.26992C7.07547 7.07492 6.75847 7.07492 6.56347 7.26992L2.23047 11.5989M16.5099 5.41065H12.4449M16.5099 5.41065V9.48355" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5787 12.0517C14.4269 14.5312 11.9143 16.25 9 16.25C4.996 16.25 1.75 13.004 1.75 9C1.75 4.996 4.996 1.75 9 1.75C10.279 1.75 11.4804 2.08107 12.5234 2.66215" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface NavItem {
  path: string;
  label: string;
  icon?: typeof Search;
  customIcon?: "home" | "portfolio" | "breaking";
}

const navItems: NavItem[] = [
  { path: "/polymarket", label: "Home", customIcon: "home" },
  { path: "/polymarket/search", label: "Search", icon: Search },
  { path: "/polymarket/breaking", label: "Breaking", customIcon: "breaking" },
  { path: "/portfolio", label: "Portfolio", customIcon: "portfolio" },
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
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#1d2b3a] border-t border-[#3d5266] z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto h-[60px]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-between flex-1 py-3 px-2 transition-colors"
            >
              {item.customIcon === "home" ? (
                <HomeIcon active={active} />
              ) : item.customIcon === "portfolio" ? (
                <PortfolioIcon active={active} />
              ) : item.customIcon === "breaking" ? (
                <BreakingNavIcon active={active} />
              ) : Icon ? (
                <Icon
                  size={18}
                  color={active ? "#f2f2f2" : "#899cb2"}
                  strokeWidth={2}
                />
              ) : null}
              <span
                className={`text-[11px] font-medium ${
                  active ? "text-[#f2f2f2]" : "text-[#899cb2]"
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
