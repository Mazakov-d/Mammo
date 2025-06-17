/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    primary: '#f88f39',
    danger: '#da2d2d',
    warning: '#b71c1c',
    sheetBackground: '#1a1a1a',
    sheetAltBackground: '#191919',
    gray: '#666',
    grayDark: '#444',
    white: '#fff',
    whiteAlt: '#fff2f2',
    black: '#000',
    textSecondary: '#e0e0e0',
    aboutBackground: '#25292e',
  },
  dark: {
    text: '#fff',
    background: '#11181C',
    tint: tintColorDark,
    icon: '#fff',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorDark,
    primary: '#f88f39',
    danger: '#da2d2d',
    warning: '#b71c1c',
    sheetBackground: '#1a1a1a',
    sheetAltBackground: '#191919',
    gray: '#666',
    grayDark: '#444',
    white: '#fff',
    whiteAlt: '#fff2f2',
    black: '#000',
    textSecondary: '#e0e0e0',
    aboutBackground: '#25292e',
  },
  primary: '#ff8c00',
  danger: '#fc2626',
  warning: '#da2d2d',
  sheetBackground: '#222222',
  sheetAltBackground: '#191919',
  gray: '#666',
  grayDark: '#444',
  white: '#fff',
  whiteAlt: '#fff2f2',
  black: '#000',
  textSecondary: '#e0e0e0',
  aboutBackground: '#25292e',
};

export const Layout = {
  // Spacing
  padding: 20,
  paddingLarge: 32,
  paddingSmall: 10,
  margin: 20,
  marginSmall: 10,
  marginLarge: 32,

  // Border radius
  radius: 10,
  radiusLarge: 25,
  radiusMedium: 14,
  radiusSmall: 3,
  radiusCircle: 32,

  // Font sizes
  fontSizeTitle: 24,
  fontSizeSubtitle: 22,
  fontSizeText: 18,
  fontSizeButton: 16,
  fontSizeButtonLarge: 19,
  fontSizeBig: 26,
  fontSizeSmall: 16,

  // Font weights
  fontWeightBold: "bold",

  // Heights/Widths
  buttonHeight: 50,
  buttonWidth: 50,
  indicatorWidth: 40,
  indicatorHeight: 4,
  progressBarHeight: 6,
  sheetMinHeight: 340,
  sheetContentHeight: 400,
  iconSize: 48,
  iconPadding: 8,

  // Shadows
  shadowOffset: { width: 0, height: 2 },
  shadowOffsetSheet: { width: 0, height: -4 },
  shadowOpacity: 0.25,
  shadowOpacitySheet: 0.3,
  shadowRadius: 4,
  shadowRadiusSheet: 12,
  elevation: 4,
  elevationSheet: 12,
  elevationButton: 3,
  shadowRadiusButton: 3.84,
};
