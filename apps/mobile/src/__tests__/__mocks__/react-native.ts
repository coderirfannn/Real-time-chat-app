export const StyleSheet = {
  create: (styles: Record<string, unknown>) => styles,
};

export const Platform = {
  OS: 'ios',
  select: (objs: Record<string, unknown>) => objs['ios'] || objs['default'],
};

export const View = 'View';
export const Text = 'Text';
export const SafeAreaView = 'SafeAreaView';
export const StatusBar = 'StatusBar';

export default {
  StyleSheet,
  Platform,
  View,
  Text,
  SafeAreaView,
  StatusBar,
};
