import { motion } from "framer-motion";
import {
  User,
  Wallet,
  Settings,
  HelpCircle,
  FileText,
  Shield,
  Bell,
  Moon,
  Globe,
  ChevronRight,
  LogOut,
  Zap,
} from "lucide-react";
import { PolyHeader } from "./PolyHeader";

interface MenuItem {
  icon: React.ElementType;
  label: string;
  description?: string;
  badge?: string;
  onClick?: () => void;
}

const menuSections: { title: string; items: MenuItem[] }[] = [
  {
    title: "Account",
    items: [
      { icon: User, label: "Profile", description: "View and edit your profile" },
      { icon: Wallet, label: "Wallet", description: "Manage your funds", badge: "$0.00" },
      { icon: Bell, label: "Notifications", description: "Notification preferences" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { icon: Moon, label: "Appearance", description: "Dark mode enabled" },
      { icon: Globe, label: "Language", description: "English (US)" },
      { icon: Settings, label: "Settings", description: "App settings" },
    ],
  },
  {
    title: "Support",
    items: [
      { icon: HelpCircle, label: "Help Center", description: "FAQs and support" },
      { icon: FileText, label: "Terms of Service" },
      { icon: Shield, label: "Privacy Policy" },
    ],
  },
];

export function MorePage() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-poly-bg pb-20"
    >
      <PolyHeader />

      {/* User Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-4 mt-2 mb-4 p-4 bg-poly-card rounded-xl border border-poly-border/30"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-poly-blue to-poly-green flex items-center justify-center shrink-0">
            <User size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-base font-semibold">Guest User</h2>
            <p className="text-poly-textMuted text-xs">Connect wallet to trade</p>
          </div>
          <button className="px-3 py-1.5 bg-poly-blue rounded-lg text-white text-xs font-medium hover:bg-poly-blue/80 transition-colors shrink-0">
            Connect
          </button>
        </div>
      </motion.div>

      {/* Demo Mode Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mx-4 mb-4 p-4 rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #2E5CFF 0%, #00D295 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-white shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-sm font-semibold">HFT Demo Mode</h3>
            <p className="text-white/80 text-xs">See real-time trading in action</p>
          </div>
          <a
            href="/demo"
            className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-xs font-medium hover:bg-white/30 transition-colors shrink-0"
          >
            Launch
          </a>
        </div>
      </motion.div>

      {/* Menu Sections */}
      {menuSections.map((section, sectionIndex) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + sectionIndex * 0.08 }}
          className="mb-4"
        >
          <h3 className="px-4 text-poly-textMuted text-[10px] uppercase tracking-wider mb-2">
            {section.title}
          </h3>
          <div className="mx-4 bg-poly-card rounded-xl border border-poly-border/30 overflow-hidden">
            {section.items.map((item, itemIndex) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`flex items-center w-full px-3 py-2.5 hover:bg-poly-cardHover transition-colors text-left ${
                  itemIndex < section.items.length - 1 ? "border-b border-poly-border/30" : ""
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-poly-surface/50 flex items-center justify-center mr-3 shrink-0">
                  <item.icon size={16} className="text-poly-textSecondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{item.label}</p>
                  {item.description && (
                    <p className="text-poly-textMuted text-xs">{item.description}</p>
                  )}
                </div>
                {item.badge && (
                  <span className="text-poly-textMuted text-xs mr-2">{item.badge}</span>
                )}
                <ChevronRight size={14} className="text-poly-textMuted shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Sign Out */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mx-4 mb-4"
      >
        <button className="flex items-center justify-center w-full py-2.5 bg-poly-card rounded-xl border border-poly-border/30 text-poly-red text-sm hover:bg-poly-cardHover transition-colors">
          <LogOut size={14} className="mr-2" />
          <span className="font-medium">Sign Out</span>
        </button>
      </motion.div>

      {/* Version */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-poly-textMuted text-[10px] pb-4"
      >
        Aptos Polymarket v1.0.0
      </motion.p>
    </motion.div>
  );
}
