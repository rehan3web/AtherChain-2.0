import { View } from 'react-native';
import { Wallet } from '@/components/wallet';
import { useColors } from '@/hooks/useColors';
import { useDockClearance } from '@/components/navigation/GlassDock';

export default function WalletScreen() {
  const c = useColors();
  const { clearance } = useDockClearance();
  return (
    <View style={{ flex: 1, backgroundColor: c.walletCardBottom, paddingBottom: clearance }}>
      <Wallet fullScreen />
    </View>
  );
}
