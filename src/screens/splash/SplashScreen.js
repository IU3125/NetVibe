import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onReady }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const fadeInTitle = useRef(new Animated.Value(0)).current;
  const fadeInFooter = useRef(new Animated.Value(0)).current;
  const loadingAnim = useRef(new Animated.Value(-0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.9,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.timing(fadeInTitle, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(800),
      Animated.timing(fadeInFooter, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(loadingAnim, {
        toValue: 1.3,
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ).start();

    const timer = setTimeout(() => {
      onReady();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const loadingBarWidthVal = 140;
  const progressWidth = loadingBarWidthVal * 0.3;
  const loadingTranslate = loadingAnim.interpolate({
    inputRange: [-0.3, 1.3],
    outputRange: [-progressWidth, loadingBarWidthVal],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1e1e', '#131313']}
        locations={[0, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.atmosphere}>
        <View style={[styles.glow, styles.glowTop]} />
        <View style={[styles.glow, styles.glowBottom]} />
      </View>

      <View style={styles.content}>
        <Animated.Image
          source={require('../../../assets/logo1.png')}
          style={[
            styles.logo,
            {
              transform: [{ scale: pulseAnim }],
              opacity: pulseOpacity,
            },
          ]}
          resizeMode="contain"
        />

        <Animated.View style={[styles.brandSection, { opacity: fadeInTitle }]}>
          <Text style={styles.brandName}>NETVIBE</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: fadeInFooter }]}>
        <View style={styles.loadingBar}>
          <Animated.View
            style={[
              styles.loadingProgress,
              { transform: [{ translateX: loadingTranslate }] },
            ]}
          />
        </View>
        <Text style={styles.credit}>NETVIBE</Text>
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </Animated.View>
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
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  glow: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.2,
  },
  glowTop: {
    top: '-10%',
    left: '-10%',
    width: '40%',
    height: '40%',
    backgroundColor: COLORS.primary,
  },
  glowBottom: {
    bottom: '-10%',
    right: '-10%',
    width: '40%',
    height: '40%',
    backgroundColor: COLORS.secondary,
    opacity: 0.1,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logo: {
    width: 160,
    height: 160,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 24,
  },
  brandName: {
    fontFamily: FONTS.headlineLg,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 4.8,
    color: COLORS.onSurface,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  footer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 16,
  },
  loadingBar: {
    width: 140,
    height: 2,
    backgroundColor: '#2a2a2a',
    borderRadius: 1,
    overflow: 'hidden',
  },
  loadingProgress: {
    position: 'absolute',
    height: '100%',
    width: '30%',
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
  credit: {
    fontFamily: FONTS.labelMd,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.onSurfaceVariant,
    opacity: 0.4,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    opacity: 0.3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
});
