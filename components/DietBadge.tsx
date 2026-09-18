import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/Theme';

const DIET = {
  vegan: { text: 'VGN', bg: Theme.vegan, label: 'Vegan' },
  vegetarian: { text: 'VEG', bg: Theme.vegetarian, label: 'Vegetarian' },
  glutenFree: { text: 'GF', bg: Theme.glutenFree, label: 'Gluten free' },
  plantBased: { text: 'PB', bg: Theme.plantBased, label: 'Plant based' },
} as const;

export default function DietBadge({ kind }: { kind: keyof typeof DIET }) {
  const d = DIET[kind];
  return (
    <View style={[styles.badge, { backgroundColor: d.bg }]} accessible accessibilityLabel={d.label}>
      <Text style={styles.badgeText} importantForAccessibility="no" accessibilityElementsHidden>
        {d.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    color: Theme.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
