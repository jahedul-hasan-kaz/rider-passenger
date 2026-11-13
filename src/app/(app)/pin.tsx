import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useBooking } from "@/features/booking/store";
import {
  addressLabel,
  currentFix,
  useLastFix,
} from "@/features/location/location";
import { RideMap } from "@/features/map/RideMap";
import { DHAKA, type MapPoint } from "@/features/map/types";
import { usePlaces, type PlaceKind } from "@/features/places/places-store";
import { errorMessage } from "@/i18n";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/haptics";
import { elevation, radius, space } from "@/theme/tokens";
import { useTheme } from "@/theme/theme";
import {
  Button,
  Card,
  Checkbox,
  Icon,
  MapPin,
  Pressable,
  SegmentedControl,
  Skeleton,
  Text,
  TextField,
  useToast,
} from "@/ui";

type Mode = "pickup" | "destination" | "save";

// Pin on map / Save a place (docs/spec/03-screens.md §7.8, mockup 8). The map moves under a fixed centre pin; the
// address is looked up once the map settles.
export default function PinScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ mode?: Mode; kind?: PlaceKind }>();
  const [mode, setMode] = useState<Mode>(params.mode ?? "destination");
  const booking = useBooking();
  const fix = useLastFix((s) => s.fix);
  const savePlace = usePlaces((s) => s.save);

  const start: MapPoint =
    (mode === "pickup" ? booking.pickup : booking.destination) ??
    (fix ? { lat: fix.lat, lng: fix.lng } : DHAKA);
  const [center, setCenter] = useState<MapPoint>(start);
  const [moving, setMoving] = useState(false);
  const [address, setAddress] = useState<{
    title: string;
    subtitle?: string;
  } | null>(null);
  const [looking, setLooking] = useState(true);
  const [recenter, setRecenter] = useState(0);
  const [recenterTo, setRecenterTo] = useState<MapPoint | undefined>(undefined);
  const lookup = useRef(0);

  // Save mode fields.
  const [kind, setKind] = useState<PlaceKind>(params.kind ?? "home");
  const [customName, setCustomName] = useState("");
  const [note, setNote] = useState("");
  const [mornings, setMornings] = useState(true);
  const [saving, setSaving] = useState(false);

  const onCenterChange = useCallback(
    (point: MapPoint, phase: "moving" | "settled") => {
      if (phase === "moving") {
        setMoving(true);
        return;
      }
      setMoving(false);
      setCenter(point);
      haptic("selection");
      const id = ++lookup.current;
      setLooking(true);
      void addressLabel(point.lat, point.lng).then((label) => {
        if (id !== lookup.current) return;
        setAddress(label);
        setLooking(false);
      });
    },
    [],
  );

  const label = address?.title ?? t("pin.droppedPin");

  const confirm = () => {
    const place = { lat: center.lat, lng: center.lng, label };
    if (mode === "pickup") {
      booking.setPickup(place);
      router.back();
      return;
    }
    booking.setDestination(place);
    track("destination_selected", { source: "map" });
    router.replace("/confirm");
  };

  const save = async () => {
    setSaving(true);
    try {
      await savePlace({
        kind,
        name: kind === "other" ? customName.trim() || label : undefined,
        lat: center.lat,
        lng: center.lng,
        label,
        subtitle: address?.subtitle,
        driverNote: note.trim() || undefined,
        suggestMornings: kind === "office" ? mornings : undefined,
      });
      toast({
        message: t("pin.saved", {
          place:
            kind === "other" ? customName.trim() || label : t(`places.${kind}`),
        }),
        tone: "success",
      });
      router.back();
    } catch (error) {
      toast({ message: errorMessage(error), tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const myLocation = async () => {
    try {
      const next = await currentFix(6_000);
      setRecenterTo({ lat: next.lat, lng: next.lng });
      setRecenter((n) => n + 1);
    } catch {
      toast({ message: t("home.gpsFailed"), tone: "danger" });
    }
  };

  const kindLabel = kind === "other" ? t("places.other") : t(`places.${kind}`);

  return (
    <View style={[styles.screen, { backgroundColor: colors.hero }]}>
      <View style={styles.mapArea}>
        <RideMap
          center={recenterTo ?? start}
          recenterKey={recenter}
          onCenterChange={onCenterChange}
          zoom={17}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[styles.top, { paddingTop: insets.top + space[3] }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("ui.back")}
            style={[
              styles.back,
              elevation.card,
              { backgroundColor: colors.surface, shadowColor: colors.shadow },
            ]}
          >
            <Icon name="chevron-left" size={22} />
          </Pressable>
          <View
            style={[
              styles.hint,
              elevation.card,
              { backgroundColor: colors.surface, shadowColor: colors.shadow },
            ]}
          >
            <Text variant="label">{t("pin.hint")}</Text>
          </View>
        </View>

        <View style={styles.pin} pointerEvents="none">
          <MapPin
            label={mode === "save" ? kindLabel : undefined}
            lifted={moving}
            pulsing={!moving}
          />
        </View>

        <Pressable
          onPress={() => void myLocation()}
          accessibilityRole="button"
          accessibilityLabel={t("pin.myLocation")}
          style={[
            styles.locate,
            elevation.card,
            { backgroundColor: colors.surface, shadowColor: colors.shadow },
          ]}
        >
          <Icon name="crosshair" size={20} />
        </Pressable>
      </View>

      <View
        style={[
          styles.sheet,
          elevation.sheet,
          {
            backgroundColor: colors.background,
            shadowColor: colors.shadow,
            paddingBottom: insets.bottom + space[4],
          },
        ]}
      >
        <View
          style={[styles.handle, { backgroundColor: colors.borderStrong }]}
        />
        {mode === "save" ? (
          <>
            <Text variant="title" accessibilityRole="header">
              {t("pin.saveAs")}
            </Text>
            <SegmentedControl<PlaceKind>
              accessibilityLabel={t("pin.saveAs")}
              segments={[
                { value: "home", label: t("places.home") },
                { value: "office", label: t("places.office") },
                { value: "other", label: t("places.other") },
              ]}
              value={kind}
              onChange={setKind}
            />
          </>
        ) : (
          <Text variant="title" accessibilityRole="header">
            {mode === "pickup"
              ? t("pin.pickupTitle")
              : t("pin.destinationTitle")}
          </Text>
        )}

        <Card>
          {looking && !address ? (
            <Skeleton height={20} width="70%" />
          ) : (
            <>
              <Text variant="bodyStrong" numberOfLines={2}>
                {label}
              </Text>
              {address?.subtitle ? (
                <Text variant="caption" color="textMuted">
                  {address.subtitle}
                </Text>
              ) : null}
            </>
          )}
        </Card>

        {mode === "save" ? (
          <>
            {kind === "other" ? (
              <TextField
                label={t("pin.placeName")}
                value={customName}
                onChangeText={setCustomName}
                maxLength={40}
                placeholder={t("pin.placeNameHint")}
              />
            ) : null}
            <TextField
              label={t("pin.noteLabel")}
              placeholder={t("pin.notePlaceholder")}
              value={note}
              onChangeText={setNote}
              maxLength={300}
            />
            {kind === "office" ? (
              <Checkbox
                label={t("pin.mornings")}
                checked={mornings}
                onChange={setMornings}
              />
            ) : null}
            <Button
              label={t("pin.save", { place: kindLabel })}
              onPress={() => void save()}
              loading={saving}
              disabled={moving}
            />
            <Text variant="caption" color="textMuted" align="center">
              {t("pin.storedOnAccount")}
            </Text>
          </>
        ) : (
          <>
            <Button
              testID="confirm-pin"
              label={
                mode === "pickup"
                  ? t("pin.confirmPickup")
                  : t("pin.confirmDestination")
              }
              onPress={confirm}
              disabled={moving}
            />
            {mode === "destination" ? (
              <Button
                label={t("pin.saveThis")}
                variant="ghost"
                size="md"
                onPress={() => setMode("save")}
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: {
    position: "absolute",
    left: space[4],
    right: space[4],
    flexDirection: "row",
    gap: space[3],
    alignItems: "center",
  },
  back: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    justifyContent: "center",
  },
  mapArea: { flex: 1 },
  // The pin's tip (bottom of its 140-dp box, above the 7-dp shadow) sits on the map's centre.
  pin: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    marginTop: -133,
    alignItems: "center",
  },
  locate: {
    position: "absolute",
    right: space[4],
    bottom: space[8],
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    marginTop: -space[6],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space[5],
    gap: space[4],
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginTop: -space[2],
  },
});
