import { DockScreen } from '@/components/screens/DockScreen';

export default function SavedScreen() {
  return <DockScreen testID="screen-saved" title="Saved" icon="bookmark" heading="No saved items yet" body="Saving isn't available in this demo wallet, so nothing has been kept here." />;
}
