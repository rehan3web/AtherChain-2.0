'use client';

import { Layout } from "@/components/ui/Layout";

import LinkNext from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, ExternalLink, ShieldCheck, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const truncate = (addr: string) => {
    if (!addr || addr.length < 32) return addr;
    return `${addr.slice(0, 11)}....${addr.slice(-21)}`;
  };

  const txHash = searchParams.get('hash') || "Unavailable";
  const isMining = txHash.startsWith('mine_');
  const amount = searchParams.get('amount') || "0.00";
  const fromAddress = searchParams.get('from') || "Unknown";
  const recipient = searchParams.get('to') || "Unknown";
  const historyPending = searchParams.get('historyPending') === 'true';
  const fee = searchParams.get('fee') || "0";
  const [showReceipt, setShowReceipt] = useState(false);

  return (
    <div className="w-full font-sans selection:bg-foreground selection:text-background">
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="mb-8"
        >
          <div className="relative">
            <CheckCircle2 className="w-20 h-20 text-foreground" />
            <motion.div
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-foreground/10 blur-xl rounded-full"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-4 mb-8">
            <LinkNext href="/dashboard/wallet">
              <button
                className="w-10 h-10 flex items-center justify-center bg-secondary border border-border hover:bg-secondary/80 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
            </LinkNext>
            <h2 className="text-2xl font-light tracking-tight text-foreground uppercase">Transaction Confirmed</h2>
          </div>
          <p className="text-muted-foreground text-sm font-mono mb-8 uppercase tracking-widest">
            Internal ledger transfer confirmed
          </p>
          {historyPending && <p role="status" className="text-sm text-amber-600 mb-4">Your transfer is confirmed. Transaction history may still be syncing.</p>}

          <div className="bg-card border border-border p-6 mb-8 text-left w-full space-y-4">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Transaction Hash</p>
              <p className="text-xs font-mono text-foreground break-all opacity-80">{txHash}</p>
            </div>
            <div className="flex justify-between border-t border-border pt-4">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Amount</p>
                <p className="text-sm font-mono text-foreground font-bold">{amount} {isMining ? 'AT' : 'ATH'}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                <div className="text-sm font-mono text-foreground flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
                  {isMining ? 'NETWORK SETTLED' : 'FINALIZED'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 w-full">
            <LinkNext href="/dashboard/wallet">
              <button className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-foreground text-background text-sm font-bold tracking-widest hover:opacity-90 transition-all uppercase">
                Back to Wallet
              </button>
            </LinkNext>
            <button
              onClick={() => setShowReceipt(true)}
              className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-transparent border border-border text-foreground text-sm font-bold tracking-widest hover:bg-secondary transition-all uppercase"
            >
              <ExternalLink className="w-4 h-4" />
              Transaction Receipt
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showReceipt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-card border border-border relative overflow-hidden shadow-2xl"
            >
              {/* Receipt Background Texture */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

              <div className="p-8 relative">
                <button
                  onClick={() => setShowReceipt(false)}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-8">
                  <ShieldCheck className="w-6 h-6 text-foreground" />
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.4em]">Node-Auth-Receipt</span>
                </div>

                <div className="space-y-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-2xl font-light text-foreground tracking-tighter">SUCCESSFUL</h3>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Digital Asset Transfer</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-mono font-bold text-foreground tracking-tighter">{amount} {isMining ? 'AT' : 'ATH'}</p>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Network Settled</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-6 text-sm font-mono pt-8 border-t border-border">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">TYPE</p>
                      <p className="text-foreground text-xs">{isMining ? 'MINING_CLAIM' : 'ASSET_SEND'}</p>
                    </div>
                    {!isMining && (
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">SETTLEMENT</p>
                        <p className="text-foreground text-xs">Internal ledger</p>
                      </div>
                    )}
                    {isMining ? (
                      <>
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">FROM_ADDRESS</p>
                          <p className="text-foreground text-xs font-bold tracking-tight">System Protocol</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">TO_ADDRESS</p>
                          <p className="text-foreground text-xs font-bold tracking-tight">Your Node Account</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">FROM_ADDR</p>
                          <p className="text-foreground text-[10px] break-all opacity-80">{truncate(fromAddress)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">RECIPIENT_ADDR</p>
                          <p className="text-foreground text-[10px] break-all opacity-80">{truncate(recipient)}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">NETWORK</p>
                      <p className="text-foreground text-xs font-bold tracking-tight">AtherChain</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">PROTOCOL</p>
                      <p className="text-foreground text-xs">Internal ledger</p>
                    </div>

                    {!isMining ? (
                      <>
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">FEE</p>
                          <p className="text-foreground text-xs">{fee} ATH</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">DATE</p>
                          <p className="text-foreground text-xs">{new Date().toLocaleString()}</p>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">DATE</p>
                        <p className="text-foreground text-xs">{new Date().toLocaleString()}</p>
                      </div>
                    )}

                    <div className="col-span-2 border-t border-border/30 pt-4">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">TXN_HASH</p>
                      <p className="text-foreground text-[10px] break-all opacity-60 leading-relaxed">{txHash}</p>
                    </div>
                  </div>


                  <div className="pt-8 flex flex-col items-center gap-4">
                    <div className="w-full h-8 flex items-center justify-between opacity-10">
                      {[...Array(40)].map((_, i) => (
                        <div key={i} className="w-0.5 h-full bg-white" />
                      ))}
                    </div>
                    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.5em]">Auth-Verification-Stamp</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
