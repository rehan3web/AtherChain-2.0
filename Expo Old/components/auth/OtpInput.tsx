import React, { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

interface OtpInputProps {
  length?: number;
  value: string[];
  onChange: (value: string[]) => void;
  autoFocus?: boolean;
}

export function OtpInput({ length = 6, value, onChange, autoFocus = false }: OtpInputProps) {
  const colors = useColors();
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => refs.current[0]?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleChange = (text: string, index: number) => {
    // Handle paste: if multiple chars land in first box
    if (text.length > 1) {
      const digits = text.replace(/[^0-9]/g, '').slice(0, length).split('');
      const newVal = Array(length).fill('');
      digits.forEach((d, i) => {
        if (i < length) newVal[i] = d;
      });
      onChange(newVal);
      const nextIndex = Math.min(digits.length, length - 1);
      refs.current[nextIndex]?.focus();
      return;
    }

    const digit = text.replace(/[^0-9]/g, '');
    const newVal = [...value];
    newVal[index] = digit;
    onChange(newVal);

    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!value[index] && index > 0) {
        const newVal = [...value];
        newVal[index - 1] = '';
        onChange(newVal);
        refs.current[index - 1]?.focus();
      } else {
        const newVal = [...value];
        newVal[index] = '';
        onChange(newVal);
      }
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={el => {
            refs.current[i] = el;
          }}
          style={[
            styles.box,
            {
              backgroundColor: colors.input,
              borderColor: value[i] ? colors.primary : colors.border,
              borderRadius: colors.radius / 2,
              color: colors.text,
            },
          ]}
          value={value[i] ?? ''}
          onChangeText={text => handleChange(text, i)}
          onKeyPress={e => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={i === 0 ? length : 1}
          selectTextOnFocus
          textAlign="center"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 12,
  },
  box: {
    width: 48,
    height: 58,
    borderWidth: 1.5,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
});
