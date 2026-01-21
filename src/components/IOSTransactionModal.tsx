import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, ChevronRight } from "lucide-react";

interface IOSTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueInBrowser: () => void;
}

// Generate Petra deep link to open current page in Petra's mobile browser
const getPetraDeepLink = () => {
  if (typeof window === 'undefined') return '';
  // Use current URL so user lands on the same page in Petra
  const currentUrl = window.location.href;
  return `https://petra.app/explore?link=${encodeURIComponent(currentUrl)}`;
};

export function IOSTransactionModal({
  isOpen,
  onClose,
}: IOSTransactionModalProps) {
  const petraDeepLink = getPetraDeepLink();

  const handleOpenInPetra = () => {
    window.location.href = petraDeepLink;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-sm bg-[#1c2b3a] border border-[#3a4f60] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 hover:bg-[#2a3d4e] rounded-lg transition-colors z-10"
            >
              <X size={18} className="text-[#8297a3]" />
            </button>

            {/* Header */}
            <div className="pt-6 pb-4 px-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#6C5CE7]/30 to-[#8B5CF6]/30 flex items-center justify-center">
                <Smartphone size={32} className="text-[#8B5CF6]" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Open in Petra App
              </h2>
              <p className="text-[#8297a3] text-sm">
                iOS Safari has display issues with wallet pages.
                Please use the Petra App for the best experience.
              </p>
            </div>

            {/* Single Action */}
            <div className="px-6 pb-6 space-y-3">
              {/* Open in Petra App - Primary action */}
              <button
                onClick={handleOpenInPetra}
                className="w-full p-4 bg-gradient-to-r from-[#6C5CE7] to-[#8B5CF6] hover:from-[#5B4ED6] hover:to-[#7C4DDB] rounded-xl transition-all group"
              >
                <div className="flex items-center justify-center gap-3">
                  <Smartphone size={24} className="text-white" />
                  <span className="text-white font-semibold text-lg">Open Petra App</span>
                  <ChevronRight size={20} className="text-white/70 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              {/* Info text */}
              <div className="p-3 bg-[#2a3d4e]/50 rounded-lg border border-[#3a4f60]/50">
                <p className="text-[#8297a3] text-xs text-center">
                  The Petra App will open this page in its built-in browser where transactions work perfectly.
                </p>
              </div>

              {/* Don't have the app? */}
              <div className="text-center pt-2">
                <p className="text-[#6b7a8a] text-xs mb-2">Don't have Petra installed?</p>
                <a
                  href="https://apps.apple.com/app/petra-wallet/id6446259840"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#8B5CF6] text-xs hover:underline"
                >
                  Download from App Store
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default IOSTransactionModal;
