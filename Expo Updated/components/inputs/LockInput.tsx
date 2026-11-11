import React, { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import tw from 'twrnc';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';

export interface LockInputProps extends Omit<TextInputProps, 'editable'> {
  /** Visible label rendered above the input */
  label?: string;
  /** Helper text below the input (hidden while an error shows) */
  description?: string;
  /** Error message; presence triggers danger styling */
  error?: string | null;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

const SPRING = { useNativeDriver: true, damping: 20, stiffness: 380, mass: 0.7 } as const;

/** LockInput: focus ring scales from 0.94 to 1 and the border locks in, like the web original. */
export const LockInput = forwardRef<React.ComponentRef<typeof TextInput>, LockInputProps>(
  ({ label, description, error, leftIcon, rightIcon, disabled, containerStyle, style, onFocus, onBlur, testID, accessibilityLabel, accessibilityHint, ...props }, ref) => {
    const c = useColors();
    const { scheme } = useTheme();
    const [focused, setFocused] = useState(false);
    const ring = useRef(new Animated.Value(0)).current;
    const errIn = useRef(new Animated.Value(error ? 1 : 0)).current;

    useEffect(() => {
      Animated.spring(ring, { toValue: focused ? 1 : 0, ...SPRING }).start();
    }, [focused, ring]);
    useEffect(() => {
      if (error) {
        errIn.setValue(0);
        Animated.spring(errIn, { toValue: 1, ...SPRING }).start();
      }
    }, [error, errIn]);

    const danger = !!error;
    const ringColor = danger ? 'rgba(220,38,38,0.35)' : 'rgba(79,128,232,0.35)';
    const borderActive = danger ? c.walletError : c.walletBlue[3];

    return (
      <View style={[styles.wrap, containerStyle]}>
        {!!label && <Text style={[styles.label, { color: c.walletInk }]} importantForAccessibility="no">{label}</Text>}
        <View style={[styles.field, disabled && styles.disabled]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { borderColor: ringColor, opacity: ring, transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}
          />
          <View style={[styles.box, { backgroundColor: c.walletField, borderColor: danger ? 'rgba(220,38,38,0.5)' : c.walletDisabled }]}>
            {!!leftIcon && <View pointerEvents="none" style={[styles.icon, { opacity: focused ? 1 : 0.6 }]}>{leftIcon}</View>}
            <TextInput
              ref={ref}
              editable={!disabled}
              placeholderTextColor={c.walletMuted}
              keyboardAppearance={scheme}
              accessibilityLabel={accessibilityLabel ?? label}
              accessibilityHint={error ?? accessibilityHint ?? description}
              accessibilityState={{ disabled: !!disabled }}
              testID={testID}
              onFocus={(e) => { setFocused(true); onFocus?.(e); }}
              onBlur={(e) => { setFocused(false); onBlur?.(e); }}
              style={[styles.input, { color: c.walletInk }, style]}
              {...props}
            />
            {!!rightIcon && <View pointerEvents="none" style={[styles.icon, { opacity: focused ? 1 : 0.6 }]}>{rightIcon}</View>}
          </View>
          <Animated.View pointerEvents="none" style={[styles.border, { borderColor: borderActive, opacity: ring }]} />
        </View>
        {!!description && !error && <Text style={[styles.desc, { color: c.walletSubtle }]}>{description}</Text>}
        {!!error && (
          <Animated.Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID={testID ? `${testID}-error` : undefined}
            style={[styles.error, { color: c.walletError, opacity: errIn, transform: [{ translateY: errIn.interpolate({ inputRange: [0, 1], outputRange: [-2, 0] }) }] }]}
          >
            {error}
          </Animated.Text>
        )}
      </View>
    );
  },
);
LockInput.displayName = 'LockInput';

const styles = {
  wrap: tw`w-full gap-1.5`,
  label: tw.style('text-sm tracking-tight', { fontFamily: 'DMSans_500Medium' }),
  field: tw`relative`,
  disabled: tw`opacity-40`,
  box: tw`min-h-12 rounded-2xl border flex-row items-center px-3.5 gap-2.5`,
  icon: tw`items-center justify-center`,
  input: tw.style('flex-1 min-h-[46px] text-base py-0', { fontFamily: 'DMSans_400Regular' }),
  ring: tw`absolute -inset-[3px] rounded-[19px] border-2`,
  border: tw`absolute inset-0 rounded-2xl border`,
  desc: tw.style('text-xs leading-[17px]', { fontFamily: 'DMSans_400Regular' }),
  error: tw.style('text-xs', { fontFamily: 'DMSans_500Medium' }),
};
