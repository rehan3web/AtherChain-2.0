import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface WheelDatePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date;
  title?: string;
  mode?: "past" | "future";
}

const ITEM_HEIGHT = 46;
const VISIBLE_ITEMS = 5;
const HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_VERTICAL = ITEM_HEIGHT * 2;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function WheelDatePicker({
  visible,
  onClose,
  onConfirm,
  initialDate = new Date(),
  title = "Select Date",
  mode = "past",
}: WheelDatePickerProps) {
  const colors = useColors();

  // Create Year list based on mode
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  if (mode === "past") {
    // 100 years in the past to current year
    for (let y = currentYear; y >= currentYear - 100; y--) {
      years.push(y);
    }
  } else {
    // current year to 30 years in future
    for (let y = currentYear; y <= currentYear + 30; y++) {
      years.push(y);
    }
  }

  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  // Dynamically calculate days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const daysCount = getDaysInMonth(selectedYear, selectedMonth);
  const days: number[] = [];
  for (let d = 1; d <= daysCount; d++) {
    days.push(d);
  }

  // Cap selected day if month days changed (e.g. Feb 30 -> Feb 28)
  useEffect(() => {
    if (selectedDay > daysCount) {
      setSelectedDay(daysCount);
      // scroll day wheel to the new last day
      scrollToIndex(dayScrollRef, daysCount - 1);
    }
  }, [daysCount]);

  // Scroll Refs
  const monthScrollRef = useRef<ScrollView>(null);
  const dayScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);

  // Scroll to initial positions when modal becomes visible
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        // Find indices
        const monthIndex = selectedMonth;
        const dayIndex = selectedDay - 1;
        const yearIndex = years.indexOf(selectedYear);

        scrollToIndex(monthScrollRef, monthIndex, false);
        scrollToIndex(dayScrollRef, dayIndex, false);
        if (yearIndex !== -1) {
          scrollToIndex(yearScrollRef, yearIndex, false);
        }
      }, 100);
    }
  }, [visible]);

  const scrollToIndex = (ref: React.RefObject<ScrollView | null>, index: number, animated = true) => {
    if (ref.current) {
      ref.current.scrollTo({ y: index * ITEM_HEIGHT, animated });
    }
  };

  const handleScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
    type: "month" | "day" | "year"
  ) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);

    if (type === "month") {
      const newMonth = Math.max(0, Math.min(index, 11));
      if (newMonth !== selectedMonth) {
        setSelectedMonth(newMonth);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      scrollToIndex(monthScrollRef, newMonth);
    } else if (type === "day") {
      const newDay = Math.max(1, Math.min(index + 1, daysCount));
      if (newDay !== selectedDay) {
        setSelectedDay(newDay);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      scrollToIndex(dayScrollRef, newDay - 1);
    } else if (type === "year") {
      const idx = Math.max(0, Math.min(index, years.length - 1));
      const newYear = years[idx];
      if (newYear !== selectedYear) {
        setSelectedYear(newYear);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      scrollToIndex(yearScrollRef, idx);
    }
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const date = new Date(selectedYear, selectedMonth, selectedDay);
    onConfirm(date);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header Row */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={onClose} style={styles.headerBtn}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            
            <Pressable onPress={handleConfirm} style={[styles.headerBtn, styles.confirmBtnWrap]}>
              <Text style={[styles.confirmText, { color: colors.primary }]}>Confirm</Text>
            </Pressable>
          </View>

          {/* Wheel Picker Container */}
          <View style={styles.pickerContainer}>
            {/* Highlighted selection window in the middle */}
            <View 
              style={[
                styles.selectionHighlight, 
                { 
                  borderColor: colors.primary, 
                  backgroundColor: colors.primaryPale, 
                  opacity: 0.1 
                }
              ]} 
              pointerEvents="none" 
            />
            <View 
              style={[
                styles.selectionHighlightBorder, 
                { 
                  borderColor: colors.border,
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                }
              ]} 
              pointerEvents="none" 
            />

            {/* MONTH WHEEL */}
            <View style={styles.wheelColumn}>
              <ScrollView
                ref={monthScrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
                onMomentumScrollEnd={(e) => handleScrollEnd(e, "month")}
              >
                {MONTH_NAMES.map((name, i) => {
                  const isSelected = i === selectedMonth;
                  return (
                    <View key={name} style={styles.itemWrapper}>
                      <Text 
                        style={[
                          styles.itemText, 
                          { 
                            color: isSelected ? colors.primary : colors.mutedForeground,
                            fontFamily: isSelected ? "Inter_700Bold" : "Inter_500Medium",
                            fontSize: isSelected ? 16 : 14,
                          }
                        ]}
                      >
                        {name.substring(0, 3)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* DAY WHEEL */}
            <View style={styles.wheelColumn}>
              <ScrollView
                ref={dayScrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
                onMomentumScrollEnd={(e) => handleScrollEnd(e, "day")}
              >
                {days.map((d) => {
                  const isSelected = d === selectedDay;
                  return (
                    <View key={d} style={styles.itemWrapper}>
                      <Text 
                        style={[
                          styles.itemText, 
                          { 
                            color: isSelected ? colors.primary : colors.mutedForeground,
                            fontFamily: isSelected ? "Inter_700Bold" : "Inter_500Medium",
                            fontSize: isSelected ? 16 : 14,
                          }
                        ]}
                      >
                        {String(d).padStart(2, "0")}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* YEAR WHEEL */}
            <View style={styles.wheelColumn}>
              <ScrollView
                ref={yearScrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
                onMomentumScrollEnd={(e) => handleScrollEnd(e, "year")}
              >
                {years.map((y) => {
                  const isSelected = y === selectedYear;
                  return (
                    <View key={y} style={styles.itemWrapper}>
                      <Text 
                        style={[
                          styles.itemText, 
                          { 
                            color: isSelected ? colors.primary : colors.mutedForeground,
                            fontFamily: isSelected ? "Inter_700Bold" : "Inter_500Medium",
                            fontSize: isSelected ? 16 : 14,
                          }
                        ]}
                      >
                        {y}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  headerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  confirmBtnWrap: {
    borderRadius: 8,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  confirmText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  pickerContainer: {
    flexDirection: "row",
    height: HEIGHT,
    paddingHorizontal: 24,
    marginVertical: 12,
    position: "relative",
  },
  selectionHighlight: {
    position: "absolute",
    left: 24,
    right: 24,
    top: PADDING_VERTICAL,
    height: ITEM_HEIGHT,
    borderRadius: 12,
  },
  selectionHighlightBorder: {
    position: "absolute",
    left: 24,
    right: 24,
    top: PADDING_VERTICAL,
    height: ITEM_HEIGHT,
  },
  wheelColumn: {
    flex: 1,
    height: "100%",
  },
  itemWrapper: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    textAlign: "center",
  },
});
