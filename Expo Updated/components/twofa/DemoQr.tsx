import React, { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { toQR } from 'toqr';
import { useColors } from '@/hooks/useColors';

/** Offline QR rendered as row runs, same approach as the wallet receive sheet. */
export function DemoQr({ value }: { value: string }) {
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const qr = useMemo(() => {
    const cells = toQR(value, 3);
    const side = Math.sqrt(cells.length);
    const runs: { row: number; start: number; length: number }[] = [];
    for (let row = 0; row < side; row++) {
      let col = 0;
      while (col < side) {
        if (!cells[row * side + col]) { col++; continue; }
        const start = col;
        while (col < side && cells[row * side + col]) col++;
        runs.push({ row, start, length: col - start });
      }
    }
    return { side, runs };
  }, [value]);
  const max = Math.min(220, width - 96, height * 0.3);
  const cell = Math.max(1, Math.floor(max / (qr.side + 8)));
  const size = (qr.side + 8) * cell;
  return (
    <View testID="twofa-qr" accessible accessibilityRole="image"
      accessibilityLabel="Private authenticator setup QR code"
      style={{ alignSelf: 'center', width: size, height: size, borderRadius: 16, overflow: 'hidden', backgroundColor: c.walletQRBackground }}>
      {qr.runs.map((r, i) => (
        <View key={i} style={{ position: 'absolute', top: (r.row + 4) * cell, left: (r.start + 4) * cell, width: r.length * cell, height: cell, backgroundColor: c.walletQRInk }} />
      ))}
    </View>
  );
}
