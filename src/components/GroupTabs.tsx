import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Group, GROUPS, GROUP_TAB_LABELS } from '../types';
import { colors, mono, serif, fonts } from '../theme';

type Props = {
  active: Group;
  onChange: (group: Group) => void;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Library index tabs: three groups, one underline in terracotta. */
export function GroupTabs({ active, onChange }: Props) {
  return (
    <View style={styles.index}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {GROUPS.map(group => {
          const selected = group === active;
          return (
            <Pressable
              key={group}
              onPress={() => onChange(group)}
              hitSlop={8}
              style={styles.tab}
            >
              <Text style={[styles.label, selected && styles.labelActive]}>
                {GROUP_TAB_LABELS[group]}
              </Text>
              {selected ? <View style={styles.underline} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Counter({ shown, total }: { shown: number; total: number }) {
  return (
    <Text style={styles.counter}>
      {pad2(shown)} / {pad2(total)}
    </Text>
  );
}

const styles = StyleSheet.create({
  index: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    // The search box sits directly under this strip now, so the gap is what
    // separates two surfaces rather than two rules.
    marginBottom: 14,
  },
  row: {
    gap: 8,
    paddingBottom: 8,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    ...serif(15, { color: colors.inkSecondary, fontFamily: fonts.serifItalic }),
  },
  labelActive: {
    fontFamily: fonts.serifMedium,
    color: colors.ink,
  },
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -9,
    height: 2,
    backgroundColor: colors.terracotta,
  },
  counter: {
    ...mono(12),
  },
});
