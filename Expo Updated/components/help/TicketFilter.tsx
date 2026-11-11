import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { TicketStatus } from './tickets';
import { ToastSurface } from '@/components/toast/ToastProvider';

export type TicketFilterValue = 'All' | TicketStatus;
const OPTIONS: TicketFilterValue[] = ['All', 'Open', 'Resolved', 'Rejected', 'Closed'];

export function TicketFilter({ value, onChange }: { value: TicketFilterValue; onChange: (value: TicketFilterValue) => void }) {
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const trigger = useRef<React.ComponentRef<typeof View>>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ right: 16, bottom: 0 });
  const menuWidth = Math.min(208, width - 32);
  const show = () => trigger.current?.measureInWindow((x, y, w, h) => {
    setAnchor({ right: x + w, bottom: y + h });
    setOpen(true);
  });
  return (
    <>
      <Pressable ref={trigger} testID="help-filter-trigger" onPress={show} accessibilityRole="button" accessibilityLabel={`Filter tickets, ${value} selected`} accessibilityState={{ expanded: open }} aria-expanded={open} style={styles.trigger}>
        <Feather name="sliders" size={14} color={c.walletSubtle} />
        <Text style={[styles.triggerText, { color: c.walletSubtle }]}>Filter{value === 'All' ? '' : ` · ${value}`}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={c.walletSubtle} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {open && <ToastSurface>
        <View style={StyleSheet.absoluteFill}>
          <Pressable testID="help-filter-dismiss" onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close filter dropdown" style={StyleSheet.absoluteFill} />
          <View testID="help-filter-menu" accessibilityRole="menu" accessibilityLabel="Ticket status" style={[styles.menu, { backgroundColor: c.walletSheet, borderColor: c.walletDisabled, width: menuWidth, left: Math.max(16, Math.min(anchor.right - menuWidth, width - menuWidth - 16)), top: Math.max(16, Math.min(anchor.bottom + 4, height - 272)) }]}>
            {OPTIONS.map(option => (
              <Pressable key={option} testID={`help-filter-${option.toLowerCase()}`} accessibilityRole="menuitem" accessibilityState={{ selected: value === option }} aria-selected={value === option} onPress={() => { onChange(option); setOpen(false); }} style={({ pressed }) => [styles.option, { backgroundColor: value === option || pressed ? c.walletField : c.walletSheet }]}>
                <Text style={[styles.optionText, { color: c.walletInk }]}>{option === 'All' ? 'All tickets' : option}</Text>
                {value === option && <Feather name="check" size={17} color={c.walletInk} />}
              </Pressable>
            ))}
          </View>
        </View>
        </ToastSurface>}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  triggerText: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  menu: { position: 'absolute', padding: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18 },
  option: { minHeight: 48, paddingHorizontal: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
});
