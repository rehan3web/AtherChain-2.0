import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const qrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    qrCodeRef.current = html5QrCode;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        onScan(decodedText);
        html5QrCode.stop();
      },
      () => {}
    ).catch((err) => {
      console.error("Camera start error:", err);
    });

    return () => {
      if (qrCodeRef.current?.isScanning) {
        qrCodeRef.current.stop();
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 relative">
        <div className="absolute -top-12 left-0 right-0 flex justify-between items-center px-2">
          <div className="flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Scanner Interface</h3>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Environment Camera Active</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative aspect-square bg-black overflow-hidden border border-white/20">
          <div id="reader" className="w-full h-full" />
          
          {/* Industrial Scanner UI Overlays */}
          <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
            <div className="w-full h-full border border-white/20 relative">
              {/* Corners */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white" />
              
              {/* Scanning Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/30 animate-[scan_2s_linear_infinite]" />
            </div>
          </div>
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em]">
            Align QR code within view-finder
          </p>
          <div className="flex justify-center gap-1 opacity-20">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1 h-1 bg-white" />
            ))}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(250px); opacity: 0; }
        }
        #reader video {
          object-fit: cover !important;
        }
        #reader__dashboard {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
