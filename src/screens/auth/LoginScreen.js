import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Login Screen</Text>
      <Text style={styles.subtext}>Kod daha sonra yazılacaq</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: FONTS.headlineLg,
    fontSize: 28,
    color: COLORS.onSurface,
  },
  subtext: {
    fontFamily: FONTS.bodyMd,
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    marginTop: 8,
  },
});
