import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomAlert, type AlertType } from "@/components/CustomAlert";

const ALERT_TYPES: { type: AlertType; label: string; message: string }[] = [
  { type: "default", label: "Trigger Default", message: "This is a default alert" },
  { type: "primary", label: "Trigger Primary", message: "This is a primary alert" },
  { type: "secondary", label: "Trigger Secondary", message: "This is a secondary alert" },
  { type: "success", label: "Trigger Success", message: "This is a success alert" },
  { type: "warning", label: "Trigger Warning", message: "This is a warning alert" },
  { type: "danger", label: "Trigger Danger", message: "This is a danger alert" },
];

export default function Home() {
  const [activeAlerts, setActiveAlerts] = useState<{ id: number; type: AlertType; message: string }[]>([]);

  const handleTrigger = (type: AlertType, message: string) => {
    const newAlert = { id: Date.now(), type, message };
    setActiveAlerts((prev) => [newAlert, ...prev].slice(0, 6));
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans flex flex-col items-center justify-center gap-12">
      {/* 6 Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl">
        {ALERT_TYPES.map((alert) => (
          <button
            key={alert.type}
            data-testid={`button-trigger-${alert.type}`}
            onClick={() => handleTrigger(alert.type, alert.message)}
            className={`
              px-6 py-3 rounded-md text-sm font-bold uppercase tracking-wider transition-all
              active:scale-95 border border-white/10
              ${getButtonStyles(alert.type)}
            `}
          >
            {alert.label}
          </button>
        ))}
      </div>

      {/* 6 Alerts Display Area */}
      <div className="w-full max-w-3xl min-h-[400px] flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {activeAlerts.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <CustomAlert type={item.type} data-testid={`alert-${item.type}`}>
                {item.message}
              </CustomAlert>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function getButtonStyles(type: AlertType) {
  switch (type) {
    case 'default': return "bg-zinc-800 text-white hover:bg-zinc-700";
    case 'primary': return "bg-blue-600 text-white hover:bg-blue-500";
    case 'secondary': return "bg-purple-600 text-white hover:bg-purple-500";
    case 'success': return "bg-green-600 text-white hover:bg-green-500";
    case 'warning': return "bg-orange-600 text-white hover:bg-orange-500";
    case 'danger': return "bg-red-600 text-white hover:bg-red-500";
    default: return "bg-zinc-800";
  }
}
