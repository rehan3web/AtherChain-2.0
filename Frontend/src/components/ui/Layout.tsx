import { useNodeStatus } from "@/hooks/use-node";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: nodeStatus, isLoading } = useNodeStatus();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background transition-colors duration-300">
      <div className="flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-background sticky top-0 z-20 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-foreground animate-pulse" />
            <h1 className="text-xs font-bold uppercase tracking-[0.3em] text-foreground">Node Wallet</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary border border-border">
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className={`w-1.5 h-1.5 rounded-full ${nodeStatus?.status === 'Operational' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
                  <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-foreground/70">
                    {nodeStatus?.status || "CONNECTING..."}
                  </span>
                </>
              )}
            </div>
            <ModeToggle />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
