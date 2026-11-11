import { useState } from "react";
import { Layout } from "@/components/ui/Layout";
import { ArrowLeft, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { AlertType } from "@/components/CustomAlert";

interface ReceiveProps {
  walletAddress?: string;
  email?: string;
  username?: string;
  onBack: () => void;
  onAlert: (type: AlertType, message: string) => void;
}

export default function Receive({ walletAddress, email, username, onBack, onAlert }: ReceiveProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'address' | 'username' | 'email'>('address');

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    onAlert("success", `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} copied to clipboard`);
  };

  const getActiveValue = () => {
    switch (activeTab) {
      case 'username': return username;
      case 'email': return email;
      default: return walletAddress;
    }
  };

  const getTabLabel = () => {
    switch (activeTab) {
      case 'username': return "User Identifier";
      case 'email': return "Account Email";
      default: return "Native Asset Address (ATH)";
    }
  };

  const activeValue = getActiveValue();

  return (
    <div className="w-full font-sans selection:bg-foreground selection:text-background">
      <div className="max-w-md mx-auto space-y-8 pt-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center bg-secondary border border-border hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="text-xl font-light tracking-tight text-foreground uppercase">Receive Assets</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex border border-border bg-card overflow-hidden">
          {(['address', 'username', 'email'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === tab ? 'bg-foreground text-background' : 'hover:bg-secondary text-muted-foreground'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          key={activeTab} // Re-animate on tab switch
          className="bg-card border border-border p-8 text-center space-y-8"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="p-4 bg-white border-4 border-white/20">
              {activeValue ? (
                <QRCodeSVG value={activeValue} size={200} />
              ) : (
                <div className="w-[200px] h-[200px] bg-secondary animate-pulse" />
              )}
            </div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] mt-4">
              {getTabLabel()}
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-muted p-4 border border-border break-all font-mono text-xs text-foreground leading-relaxed opacity-80 min-h-[48px] flex items-center justify-center">
              {activeValue || (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  <span className="opacity-50 uppercase">Loading {activeTab}...</span>
                </div>
              )}
            </div>

            <button
              onClick={() => handleCopy(activeValue || "")}
              disabled={!activeValue}
              className="w-full py-4 bg-foreground text-background font-bold tracking-widest hover:opacity-90 transition-colors flex items-center justify-center gap-2 uppercase text-sm disabled:opacity-50"
            >
              <Copy className="w-4 h-4" /> Copy {activeTab}
            </button>
          </div>
        </motion.div>

        <div className="bg-muted/20 border border-border p-6 space-y-4">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Deposit Information</h3>
          <ul className="space-y-3 text-[11px] font-mono text-muted-foreground uppercase leading-relaxed">
            <li className="flex gap-2">
              <span className="text-foreground">01.</span> Send ATH using any of the identifiers above. Internal transfers are instant.
            </li>
            <li className="flex gap-2">
              <span className="text-foreground">02.</span> Network confirmations required: 12 blocks for external ATH deposits.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
