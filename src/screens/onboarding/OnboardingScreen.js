import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/theme';
import { useLocale } from '../../i18n/LocaleContext';

const { width } = Dimensions.get('window');

const imageHeight = width * 0.75;



const pages = [
  {
    id: '1',
    image: require('../../../assets/on1.png'),
    logo: null,
    title: 'Find Friends &\nGet Inspiration',
    subtitle:
      'Connect with a global community of creators and thinkers. Share your journey and discover stories that move you in a space designed for focus.',
  },
  {
    id: '2',
    image: require('../../../assets/on2.png'),
    logo: null,
    title: 'Expand Your Network\n& Get Inspired',
    subtitle:
      'Connect with like-minded people, discover new ideas, and grow your professional and social network step by step.',
  },
  {
    id: '3',
    image: require('../../../assets/on3.png'),
    logo: null,
    title: 'Meet Awesome People\n& Enjoy Yourself',
    subtitle:
      'Share experiences with professionals in your field, exchange insights, and unlock new opportunities together.',
  },
  {
    id: '4',
    image: require('../../../assets/on4.png'),
    logo: null,
    title: 'Stay Connected\n& Share Your Vibe',
    subtitle:
      'Join groups, share your moments, and manage both your social life and career seamlessly from one platform.',
  },
];

export default function OnboardingScreen({ onComplete }) {
  const { t } = useLocale();
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < pages.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const isLastPage = currentIndex === pages.length - 1;

  const renderPage = ({ item }) => (
    <View style={styles.page}>
      <View style={styles.imageContainer}>
        <Image source={item.image} style={styles.image} resizeMode="contain" />
        <LinearGradient
          colors={['transparent', COLORS.background]}
          style={styles.imageGradient}
        />

      </View>

      <View style={styles.contentArea}>
        <View style={styles.textSection}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>

        <View style={styles.dotPillContainer}>
          <View style={styles.dotPill}>
            {pages.map((_, i) => {
              const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [6, 24, 6],
                extrapolate: 'clamp',
              });
              const dotScale = scrollX.interpolate({
                inputRange,
                outputRange: [0.6, 1, 0.6],
                extrapolate: 'clamp',
              });
              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.25, 1, 0.25],
                extrapolate: 'clamp',
              });
              const isActive = i === currentIndex;
              const breatheScale = breatheAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.3, 1],
              });
              const breatheFloat = breatheAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, -4, 0],
              });
              const breatheGlow = breatheAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.5, 0],
              });
              const dotJsx = (
                <Animated.View
                  key={i}
                  style={[
                    styles.dotPillItem,
                    {
                      width: dotWidth,
                      opacity: dotOpacity,
                      transform: [{ scaleY: dotScale }],
                      backgroundColor:
                        isActive ? COLORS.primary : COLORS.surfaceVariant,
                    },
                  ]}
                />
              );
              if (!isActive) return dotJsx;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.dotPillWrapper,
                    {
                      transform: [
                        { scaleX: breatheScale },
                        { translateY: breatheFloat },
                      ],
                      shadowColor: COLORS.primary,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: breatheGlow,
                      shadowRadius: 8,
                      elevation: 4,
                    },
                  ]}
                >
                  {dotJsx}
                </Animated.View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={renderPage}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
      />

      <LinearGradient
        colors={['transparent', COLORS.background]}
        style={styles.bottomGradient}
      >
        <View style={styles.bottomSection}>
          {isLastPage ? (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onComplete}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>{t('signUp')}</Text>
                <MaterialIcons
                  name="arrow-forward"
                  size={22}
                  color={COLORS.onPrimaryContainer}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onComplete}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryButtonText}>{t('signIn')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>{t('next')}</Text>
              <MaterialIcons
                name="arrow-forward"
                size={22}
                color={COLORS.onPrimaryContainer}
              />
            </TouchableOpacity>
          )}
          <View style={styles.safeAreaSpacer} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  page: {
    width,
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  imageContainer: {
    width: width - 32,
    height: imageHeight,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
  },

  contentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
    paddingHorizontal: 32,
  },
  textSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontFamily: FONTS.headlineLg,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.02,
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.bodyLg,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 16,
  },
  dotPillContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  dotPill: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dotPillItem: {
    height: 6,
    borderRadius: 3,
  },
  dotPillWrapper: {
    height: 6,
    borderRadius: 3,
  },

  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 32,
  },
  bottomSection: {
    paddingHorizontal: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: FONTS.headlineMd,
    fontSize: 18,
    color: COLORS.onPrimaryContainer,
  },
  secondaryButton: {
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: FONTS.headlineMd,
    fontSize: 18,
    color: COLORS.onSurface,
  },
  safeAreaSpacer: {
    height: Platform.OS === 'ios' ? 34 : 24,
  },
});
