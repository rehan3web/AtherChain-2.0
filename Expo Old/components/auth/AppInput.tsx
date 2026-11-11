import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface AppInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(
  ({ label, error, secureTextEntry, ...rest }, ref) => {
    const colors = useColors();
    const [hidden, setHidden] = useState(secureTextEntry ?? false);

    return (
      <View style={styles.wrapper}>
        {label && (
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        )}
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: colors.input,
              borderColor: error ? colors.destructive : colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <TextInput
            ref={ref}
            style={[styles.input, { color: colors.text }]}
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={hidden}
            autoCorrect={false}
            {...rest}
          />
          {secureTextEntry && (
            <TouchableOpacity
              onPress={() => setHidden(h => !h)}
              style={styles.eyeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather
                name={hidden ? 'eye-off' : 'eye'}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          )}
        </View>
        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : null}
      </View>
    );
  }
);

AppInput.displayName = 'AppInput';

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  eyeBtn: { marginLeft: 8 },
  error: { fontSize: 12, marginTop: 5, marginLeft: 4, fontFamily: 'Inter_400Regular' },
});
