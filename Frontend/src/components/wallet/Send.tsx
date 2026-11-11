'use client';

import { useState } from "react";
import { ArrowRight, Scan, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { QrScanner } from "@/components/ui/QrScanner";
import { CustomAlert, AlertType } from "@/components/CustomAlert";

interface SendProps {
  walletBalance?: string;
  fromAddress?: string;
  isTransferEnabled?: boolean;
  transferPaused?: boolean;
  isGloballyActive?: boolean;
  onSend: (data: { recipient: string, amount: string }) => Promise<any>;
  onLookup: (identifier: string, type: 'email' | 'username') => Promise<string>;
  onSuccess: (txData: any) => void;
  onCancel: () => void;
  onAlert: (type: AlertType, message: string) => void;
}

export default function Send({ walletBalance, fromAddress, isTransferEnabled, transferPaused, isGloballyActive, onSend, onLookup, onSuccess, onCancel, onAlert }: SendProps) {
  const [transferStep, setTransferStep] = useState<number>(1);
  const [transferMethod, setTransferMethod] = useState<string>("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const truncate = (addr: string) => {
    if (!addr || addr.length < 32) return addr;
    return `${addr.slice(0, 11)}....${addr.slice(-21)}`;
  };

  const nextStep = () => { setError(null); setTransferStep(prev => prev + 1); };
  const prevStep = () => {
    setError(null);
    if (transferStep === 1) {
      onCancel();
    } else {
      setTransferStep(prev => prev - 1);
    }
  };

  const handleScan = (decodedText: string) => {
    setRecipient(decodedText);
    setIsScanning(false);
    onAlert("success", "Address scanned successfully");
  };

  const handleNextStep2 = async () => {
    // If method is email or username, lookup first
    if (transferMethod === 'Email' || transferMethod === 'Username') {
      try {
        setIsProcessing(true);
        const address = await onLookup(recipient, transferMethod === 'Email' ? 'email' : 'username');
        // We keep the original input in recipient state? 
        // The reference Wallet.tsx didn't show the lookup logic explicitly in the snippet I read, 
        // but the Prompt Part 2 says "Backend returns wallet address... Wallet auto-fills".
        // So we should probably update recipient to the address OR keep it and show address in review.
        // Let's update recipient to address for simplicity and safety, or store display name separately.
        // For now, I'll update recipient to address so the user sees it resolved.
        setRecipient(address);
        setIsProcessing(false);
        nextStep();
      } catch (error: any) {
        setIsProcessing(false);
        setError(error.response?.data?.message || error.message || "User not found");
        return;
      }
    } else {
      const isAthAddress = recipient.startsWith('ATH_') && recipient.length >= 24;
      const isLegacyAddress = recipient.startsWith('0x') && recipient.length >= 42;

      if (transferMethod === 'Wallet Address' && !isAthAddress && !isLegacyAddress) {
        setError("Invalid wallet address format (Must be ATH_ or 0x address)");
        return;
      }
      nextStep();
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const result = await onSend({ recipient, amount });
      onSuccess({ ...result, recipient, amount, fee: "0.00" });
    } catch (err: any) {
      setIsProcessing(false);
      setError(err.response?.data?.message || err.message || "Transfer Failed");
    }
  };

  if (isScanning) {
    return (
      <div className="bg-card border border-border p-6 relative min-h-[400px]">
        <button onClick={() => setIsScanning(false)} className="absolute top-4 right-4 text-foreground z-10">Close</button>
        <QrScanner
          onScan={handleScan}
          onClose={() => setIsScanning(false)}
        />
        <p className="text-center mt-4 text-muted-foreground text-xs uppercase tracking-widest">Scan Recipient QR</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border p-8"
    >
      <div className="flex items-center justify-between mb-8 border-b border-border pb-4 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={prevStep}
            className="w-10 h-10 flex items-center justify-center bg-secondary border border-border hover:bg-secondary/80 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h3 className="text-xl font-light tracking-tight text-foreground uppercase">
            {transferStep === 1 ? "Select Method" :
              transferStep === 2 ? "Recipient Details" :
                transferStep === 3 ? "Enter Amount" : "Confirm Transfer"}
          </h3>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:block">
          Step {transferStep} of 4
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <CustomAlert type="error" onClose={() => setError(null)}>
              {error}
            </CustomAlert>
          </motion.div>
        )}
        {transferStep === 1 && (
          <div className="grid grid-cols-1 gap-3">
            {['Username', 'Email', 'Wallet Address'].map((method) => (
              <button
                key={method}
                onClick={() => {
                  if (isGloballyActive === false) {
                    onAlert('warning', 'Network Protocol Offline: The global transfer system is currently undergoing maintenance.');
                    return;
                  }
                  if (transferPaused) {
                    onAlert('danger', 'Transfer Access Restricted: Your account transfer protocol has been suspended by administration.');
                    return;
                  }
                  if (isTransferEnabled === false) {
                    onAlert('danger', 'Transfers are disabled for your account.');
                    return;
                  }
                  setTransferMethod(method);
                  nextStep();
                }}
                className="w-full p-4 bg-secondary/20 border border-border text-left hover:border-foreground/50 hover:bg-secondary/40 transition-all flex justify-between items-center group"
              >
                <span className="text-sm font-mono text-foreground uppercase tracking-widest">{method}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            ))}
          </div>
        )}

        {transferStep === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-xs font-mono uppercase text-muted-foreground">Recipient {transferMethod}</label>
                {transferMethod === 'Wallet Address' && (
                  <button
                    type="button"
                    onClick={() => setIsScanning(true)}
                    className="flex items-center gap-2 text-[10px] font-mono uppercase text-foreground hover:text-muted-foreground transition-colors"
                  >
                    <Scan className="w-3 h-3" /> SCAN QR
                  </button>
                )}
              </div>
              <input
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                className="w-full bg-secondary border border-border p-4 text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 transition-colors"
                placeholder={transferMethod === 'Email' ? "user@example.com" : transferMethod === 'Username' ? "@username" : "0x..."}
                required
              />
            </div>
            <button
              onClick={handleNextStep2}
              disabled={!recipient || isProcessing}
              className="w-full py-4 bg-foreground text-background font-bold tracking-widest hover:opacity-90 transition-colors disabled:opacity-50 uppercase text-sm flex justify-center items-center gap-2"
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              {isProcessing ? "Verifying..." : "Next Step"}
            </button>
          </div>
        )}

        {transferStep === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-xs font-mono uppercase text-muted-foreground">Amount (ATH)</label>
                {walletBalance && (
                  <button
                    type="button"
                    onClick={() => setAmount(walletBalance)}
                    className="group flex items-center gap-2"
                  >
                    <span className="text-[10px] font-mono uppercase text-muted-foreground group-hover:text-foreground transition-colors">Available:</span>
                    <span className="text-[10px] font-mono font-bold text-foreground group-hover:text-muted-foreground transition-colors">{parseFloat(walletBalance).toFixed(4)} ATH</span>
                    <span className="ml-1 px-1.5 py-0.5 bg-foreground text-background text-[9px] font-bold uppercase rounded-sm group-hover:bg-foreground/90 active:scale-95 transition-all">MAX</span>
                  </button>
                )}
              </div>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={e => {
                  const val = e.target.value;
                  if (val === "" || parseFloat(val) >= 0) {
                    setAmount(val.replace(/-/g, ""));
                  }
                }}
                className="w-full bg-secondary border border-border p-4 text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 transition-colors"
                placeholder="0.00"
                step="0.000001"
                required
              />
            </div>
            <button
              onClick={() => {
                nextStep();
              }}
              disabled={!amount || parseFloat(amount) <= 0 || isProcessing}
              className="w-full py-4 bg-foreground text-background font-bold tracking-widest hover:opacity-90 transition-colors disabled:opacity-50 uppercase text-sm flex justify-center items-center gap-2"
            >
              Review Transfer
            </button>
            <div className="space-y-4">
              <CustomAlert type="info">
                <p className="text-[10px] uppercase tracking-wider">
                  Double check the amount. Internal transfers are irreversible.
                </p>
              </CustomAlert>
              {walletBalance && parseFloat(amount) > parseFloat(walletBalance) && (
                <CustomAlert type="danger">
                  <p className="text-[10px] uppercase tracking-wider">
                    Balance Warning: Your amount ({amount} ATH) exceeds your current balance ({parseFloat(walletBalance).toFixed(4)} ATH).
                  </p>
                </CustomAlert>
              )}
            </div>
          </div>
        )}

        {transferStep === 4 && (
          <div className="space-y-8">
            <div className="bg-muted/20 border border-border p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between border-b border-border/50 pb-3">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">From Address</span>
                  <span className="text-[10px] font-mono text-foreground truncate max-w-[200px]">{truncate(fromAddress || "SYSTEM")}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-3">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Network</span>
                  <span className="text-[10px] font-mono text-foreground font-bold">AtherChain</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between border-b border-border/50 pb-3">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Recipient</span>
                  <span className="text-[10px] font-mono text-foreground truncate max-w-[200px]">{truncate(recipient)}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-3">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Amount</span>
                  <span className="text-sm font-mono text-foreground font-bold">{amount} ATH</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleTransfer}>
              <button
                disabled={isProcessing}
                type="submit"
                className="w-full py-4 bg-foreground text-background font-bold tracking-widest hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 uppercase text-sm"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                {isProcessing ? "SIGNING..." : "CONFIRM & SEND"}
              </button>
            </form>
          </div>
        )}


      </div>
    </motion.div >
  );
}
