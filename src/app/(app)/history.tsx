import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '@/api';
import { isRideActive, listRides, type HistoryRow } from '@/api/endpoints/rides';
import { keys } from '@/features/account/queries';
import { currentLanguage, errorMessage } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Banner, EmptyState, HeroHeader, Icon, OfflineBar, Pressable, Skeleton, Text } from '@/ui';

type Item = { type: 'month'; key: string; label: string } | { type: 'ride'; key: string; row: HistoryRow };

// Ride history (docs/spec/03-screens.md §7.12): newest first, grouped by month, loads more as you scroll.
export default function History() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lang = currentLanguage();

  const query = useInfiniteQuery({
    queryKey: keys.history,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listRides(api(), pageParam, 20),
    getNextPageParam: (last) => last.nextCursor,
  });

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    let month = '';
    const formatter = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
    for (const row of query.data?.pages.flatMap((p) => p.rows) ?? []) {
      const label = formatter.format(new Date(row.requested_at));
      if (label !== month) {
        month = label;
        out.push({ type: 'month', key: `m-${label}`, label });
      }
      out.push({ type: 'ride', key: row.id, row });
    }
    return out;
  }, [query.data, lang]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <OfflineBar />
      <HeroHeader title={t('history.title')} onBack={() => router.back()} />
      {query.isPending ? (
        <View style={styles.pad}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={76} rounded={radius.lg} />
          ))}
        </View>
      ) : query.error && items.length === 0 ? (
        <View style={styles.pad}>
          <Banner tone="danger" body={errorMessage(query.error)} action={{ label: t('common.retry'), onPress: () => void query.refetch() }} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon="clock" title={t('history.empty')} body={t('history.emptyBody')} action={{ label: t('history.book'), onPress: () => router.replace('/home') }} />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.type}
          contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[6] }}
          onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accent} />}
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.more} /> : null}
          renderItem={({ item }) =>
            item.type === 'month' ? (
              <Text variant="label" color="textMuted" style={styles.month} accessibilityRole="header">
                {item.label}
              </Text>
            ) : (
              <RideRow row={item.row} />
            )
          }
        />
      )}
    </View>
  );
}

function RideRow({ row }: { row: HistoryRow }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = currentLanguage();
  const active = isRideActive(row);
  const status = row.trip_status === 'completed' ? 'completed' : (row.trip_status ?? row.status);
  const when = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(row.requested_at));
  const amount = row.final_fare ?? (status === 'completed' ? row.estimated_fare : null);
  const statusLabel = t(`history.status.${status}`, { defaultValue: t('history.status.other') });

  return (
    <Pressable
      onPress={() =>
        active
          ? router.push({ pathname: '/ride/[id]', params: { id: row.id } })
          : status === 'completed'
            ? router.push({ pathname: '/receipt/[rideId]', params: { rideId: row.id } })
            : router.push({ pathname: '/ride/[id]', params: { id: row.id } })
      }
      accessibilityRole="button"
      accessibilityLabel={[when, row.pickup_label, row.destination_label, amount ? formatMoney(amount) : '', statusLabel].filter(Boolean).join(', ')}
      style={[styles.row, { backgroundColor: colors.surface }]}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name={active ? 'navigation' : status === 'completed' ? 'check' : 'x'} size={18} color={status === 'completed' || active ? 'text' : 'textMuted'} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {row.destination_label ?? t('history.unknownPlace')}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {t('history.from', { place: row.pickup_label ?? '' })}
        </Text>
        <Text variant="caption" color="textMuted">
          {when}
        </Text>
      </View>
      <View style={styles.right}>
        <Text variant="bodyStrong" tabular>
          {amount ? formatMoney(amount) : '—'}
        </Text>
        <Text variant="caption" color={active ? 'infoText' : status === 'completed' ? 'successText' : 'textMuted'}>
          {statusLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  pad: { padding: space[4], gap: space[3] },
  month: { marginTop: space[3], marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.lg, marginBottom: space[3] },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end', gap: 2 },
  more: { padding: space[4] },
});
