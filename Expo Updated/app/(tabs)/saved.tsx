import { DockScreen } from '@/components/screens/DockScreen';

export default function SavedScreen() {
  return <DockScreen testID="screen-saved" title="Saved" icon="bookmark" heading="No saved items yet" body="The backend does not support saved items yet. Nothing is stored here." />;
}
