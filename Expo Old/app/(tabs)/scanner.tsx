import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";

import { useColors } from "@/hooks/useColors";
import { authApi } from "@/services/api";
import Header from "@/components/Header";

export default function ScannerScreen() {
    const colors = useColors();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const topPad = Platform.OS === "web" ? 60 : insets.top;
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (!permission) {
            requestPermission();
        }
    }, [permission]);

    if (!permission) {
        return <View style={[styles.container, { backgroundColor: colors.background }]} />;
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.foreground, textAlign: 'center', marginBottom: 20 }}>
                    We need your permission to show the camera
                </Text>
                <Pressable
                    style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 8 }}
                    onPress={requestPermission}
                >
                    <Text style={{ color: colors.primaryForeground, fontWeight: 'bold' }}>Grant Permission</Text>
                </Pressable>
            </View>
        );
    }

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned) return;
        setScanned(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Optional: Require biometric authentication before approving
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
            const authResult = await LocalAuthentication.authenticateAsync({
                promptMessage: "Authenticate to approve login",
                fallbackLabel: "Use Passcode",
            });

            if (!authResult.success) {
                Alert.alert("Authentication Failed", "You must authenticate to approve this login.", [
                    { text: "OK", onPress: () => setScanned(false) }
                ]);
                return;
            }
        }

        try {
            await authApi.approveQRLogin(data);
            Alert.alert("Success", "Login approved successfully!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Failed to approve login.", [
                { text: "Try Again", onPress: () => setScanned(false) }
            ]);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 12 }]}>
            <View style={{ paddingHorizontal: 20 }}>
                <Header />
            </View>

            <View style={styles.cameraWrapper}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                    }}
                />

                {/* Scanner Overlay UI */}
                <View style={styles.overlay}>
                    <View style={styles.topOverlay} />
                    <View style={styles.middleOverlay}>
                        <View style={styles.sideOverlay} />
                        <View style={styles.scannerHole}>
                            <View style={[styles.corner, styles.topLeftCorner]} />
                            <View style={[styles.corner, styles.topRightCorner]} />
                            <View style={[styles.corner, styles.bottomLeftCorner]} />
                            <View style={[styles.corner, styles.bottomRightCorner]} />
                        </View>
                        <View style={styles.sideOverlay} />
                    </View>
                    <View style={styles.bottomOverlay}>
                        <Text style={styles.instructionText}>
                            Point your camera at the QR code on the website to log in.
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const overlayColor = "rgba(0,0,0,0.6)";

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    cameraWrapper: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: 8,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    topOverlay: {
        flex: 1,
        backgroundColor: overlayColor,
    },
    middleOverlay: {
        flexDirection: "row",
    },
    sideOverlay: {
        flex: 1,
        backgroundColor: overlayColor,
    },
    scannerHole: {
        width: 250,
        height: 250,
        backgroundColor: "transparent",
        position: "relative",
    },
    bottomOverlay: {
        flex: 1,
        backgroundColor: overlayColor,
        justifyContent: "center",
        alignItems: "center",
    },
    instructionText: {
        color: "#ffffff",
        fontSize: 14,
        textAlign: "center",
        paddingHorizontal: 40,
    },
    corner: {
        position: "absolute",
        width: 40,
        height: 40,
        borderColor: "#9fe870",
    },
    topLeftCorner: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 16,
    },
    topRightCorner: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 16,
    },
    bottomLeftCorner: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 16,
    },
    bottomRightCorner: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 16,
    },
});
