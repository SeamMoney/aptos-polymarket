import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, ExternalLink, ChevronRight, AlertTriangle } from "lucide-react";

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
  onContinueInBrowser,
}: IOSTransactionModalProps) {
  const petraDeepLink = getPetraDeepLink();

  const handleOpenInPetra = () => {
    window.location.href = petraDeepLink;
  };

  const handleContinue = () => {
    onContinueInBrowser();
    onClose();
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
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <AlertTriangle size={32} className="text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                iOS Safari Detected
              </h2>
              <p className="text-[#8297a3] text-sm">
                Safari's toolbar may hide wallet buttons. Choose how to proceed:
              </p>
            </div>

            {/* Options */}
            <div className="px-6 pb-6 space-y-3">
              {/* Recommended: Open in Petra App */}
              <button
                onClick={handleOpenInPetra}
                className="w-full p-4 bg-gradient-to-r from-[#6C5CE7] to-[#8B5CF6] hover:from-[#5B4ED6] hover:to-[#7C4DDB] rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Smartphone size={24} className="text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">Open in Petra App</span>
                      <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-medium rounded">
                        RECOMMENDED
                      </span>
                    </div>
                    <p className="text-white/70 text-xs mt-0.5">
                      Best experience - no viewport issues
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-white/70 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              {/* Alternative: Continue in Safari with instructions */}
              <button
                onClick={handleContinue}
                className="w-full p-4 bg-[#2a3d4e] hover:bg-[#324858] border border-[#3a4f60] rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#3a4f60] flex items-center justify-center shrink-0">
                    <ExternalLink size={20} className="text-[#8297a3]" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-white font-medium">Continue in Safari</span>
                    <p className="text-[#6b7a8a] text-xs mt-0.5">
                      Scroll down on Petra page to see buttons
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-[#6b7a8a] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              {/* Visual instruction for Safari option */}
              <div className="mt-4 p-3 bg-[#2a3d4e]/50 rounded-lg border border-[#3a4f60]/50">
                <p className="text-[#8297a3] text-xs text-center">
                  <strong className="text-amber-400">Tip:</strong> If you continue in Safari,
                  swipe up on the Petra page to reveal the Cancel/Approve buttons hidden below Safari's toolbar.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default IOSTransactionModal;
