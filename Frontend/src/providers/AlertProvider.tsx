"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CustomAlert, AlertType } from "@/components/CustomAlert";

interface Alert {
    id: string;
    type: AlertType;
    message: ReactNode;
    duration?: number;
}

interface AlertContextType {
    showAlert: (type: AlertType, message: ReactNode, duration?: number) => void;
    hideAlert: (id: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const [alerts, setAlerts] = useState<Alert[]>([]);

    const hideAlert = useCallback((id: string) => {
        setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    }, []);

    const showAlert = useCallback(
        (type: AlertType, message: ReactNode, duration = 5000) => {
            const id = Math.random().toString(36).substring(2, 9);
            const newAlert = { id, type, message, duration };

            setAlerts((prev) => [...prev, newAlert]);

            if (duration > 0) {
                setTimeout(() => {
                    hideAlert(id);
                }, duration);
            }
        },
        [hideAlert]
    );

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            {/* Alert Overlay */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none">
                <AnimatePresence mode="popLayout">
                    {alerts.map((alert) => (
                        <motion.div
                            key={alert.id}
                            layout
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="pointer-events-auto"
                        >
                            <CustomAlert type={alert.type} onClose={() => hideAlert(alert.id)}>
                                {alert.message}
                            </CustomAlert>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </AlertContext.Provider>
    );
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (context === undefined) {
        throw new Error("useAlert must be used within an AlertProvider");
    }
    return context;
}
