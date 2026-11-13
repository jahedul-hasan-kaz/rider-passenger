# Passenger App Spec — 03 · Screens

[01 Overview & foundation](01-overview-foundation.md) · [02 Design system](02-design-system.md) · [03 Screens](03-screens.md) · [04 Integration](04-integration.md) · [05 Quality & delivery](05-quality-delivery.md)

---

## 6. Navigation map

```
Launch ─▶ session? ──no──▶ Welcome ▶ Phone ▶ Code + name ─┐
              │yes                                         ▼
              ▼                                   Location gate (required)
        /me + /config                                      │
              │                                    in service area? ──no──▶ Out-of-area
   active ride? ──yes──▶ Ride screen                       ▼
              │no                                         Home (choose vehicle)
              ▼                                            ▼
            Home ───────────────────────────────▶ Plan ride (destination) ⇄ Pin on map / Save place
                                                           ▼
                                                   Confirm (fare quote)
                                                           ▼
                           Ride screen: Searching ▶ Driver assigned ▶ Arriving ▶ Arrived ▶ In trip
                                                           ▼
                                                   Trip complete (pay ▸ receipt ▸ rate)

Side menu / profile: History ▸ Receipt · Wallet · Saved places · Safety · Support ▸ Ticket · Settings
```

No bottom tab bar: the app has one job. The avatar (top right of Home) opens the account sheet with the secondary destinations.

## 7. Screens

Each screen lists its purpose, content, behaviour and the states it must handle. Endpoints are relative to `/api/v1`.

### 7.1 Welcome
- **Content:** app name, language switch (English ⇄ বাংলা, applies instantly and is remembered), three value cards (Bike · average pickup · fare shown first), headline, 3-page auto-advancing carousel with dots, **Get started**, Terms and Privacy links.
- **Behaviour:** language defaults to the device locale. Terms/Privacy open in an in-app browser. Tapping Get started records consent version + timestamp locally and sends it at onboarding.
- **States:** none need the network — this screen must render offline.

### 7.2 Phone number (Step 1 of 3)
- **Content:** back, step indicator, title, `+880` prefix (fixed for v1) with a 10-digit field auto-formatted `17 1234 5678`, reassurance line (code by SMS, number hidden from drivers), two trust chips (Number masking · No password), **Send code**, divider, **Continue with Google**.
- **Behaviour:** numeric keypad opens immediately. Accepts pasted `01712345678`, `+8801712345678`, `8801712…` and normalises to E.164. Button enables only for a valid Bangladeshi mobile pattern (`1[3-9]` + 8 digits). Sends a Supabase phone OTP; CAPTCHA token attached when the backend requires it.
- **Errors:** invalid number (inline), too many attempts (shows the wait time from the server), SMS provider down ("We couldn't send the code. Try again or use Google"), offline.

### 7.3 Enter the code (Step 2 of 3)
- **Content:** masked number with **Edit**, six boxes, "Code detected from SMS → Autofill" row (Android SMS User Consent; iOS uses the keyboard one-time-code suggestion), "Didn't get it?" with a 30 s resend countdown, **name field** ("shown to driver") for new accounts only, **Verify & continue**.
- **Behaviour:** auto-advances between boxes, accepts a pasted 6-digit code, auto-submits on the sixth digit for returning users. After verification: `GET /me` → role `user` → `POST /onboarding/passenger {full_name}` (role becomes `passenger`; the API tolerates the stale token). Returning passengers skip the name field.
- **Role handling:** `driver` → "This number is registered as a driver. Use the driver app or another number." `admin` → same pattern. `status = suspended | deactivated` → account-blocked screen with a support link.
- **Errors:** wrong code (shake + clear, attempts left), expired code (offer resend), name 1–120 chars.

### 7.4 Location gate (Step 3 of 3 · required)
- **Content:** illustration with pulsing pin, title, three numbered reasons (exact pickup · accurate fares and trip sharing · SOS position), **Allow location access**, footnote "Used only while the app is open."
- **Behaviour:** this pre-prompt is shown *before* the OS dialog. Requests **foreground ("While using")** permission only. On grant → fetch position → `GET /zones/check`.
- **Denied / blocked:** bottom sheet "Location is off" with the three exact steps for the platform, **Open settings** and **Try again**. The app re-checks automatically when it returns to the foreground (no manual refresh).
- **Other states:** device location services off (prompt to enable), precise location off on iOS/Android 12+ (ask for precise; approximate location cannot place a pickup pin), GPS timeout after 10 s (offer "Set pickup on map").
- **Rule:** booking is impossible without location; History, Receipts, Support and Settings remain reachable so a passenger can still get help.

### 7.5 Out of service area
Friendly map of the covered zone name(s), "We're not in your area yet", option to set pickup on the map inside a covered zone, and a "Notify me" opt-in (push topic). Triggered by `in_service_area = false` or `OUT_OF_SERVICE_AREA` (422).

### 7.6 Home — choose vehicle (booking step 1)
- **Content:** header with location status dot + pickup label (tap to change pickup), avatar, greeting "Hi {first name}, how do you want to ride?"; step indicator *1 Choose vehicle — 2 Destination*; vehicle cards from `GET /categories?lat&lng` (large card for the first/"Fastest", compact cards for the rest) showing name, ETA, seats, nearby count; context note for the selected category (e.g. "Bike carries 1 passenger. Helmet provided by driver."); **Next: where to?**; quick destinations (Home · Office with live minutes).
- **Behaviour:** the last-used category is pre-selected. Category names use `name_bn` in Bengali. Quick-destination chips jump straight to Confirm. Pull to refresh. Pickup label is reverse-geocoded; accuracy worse than 50 m shows "Adjust pickup" prompt.
- **Banners (priority order):** active ride ("Return to your ride") · outstanding cancellation fee from `GET /wallet` ("৳X from a cancelled ride will be added to your next fare") · offline · promo available.
- **States:** skeleton cards while loading; a category with no drivers nearby stays selectable but is labelled "Busy — longer wait"; only one category → skip the choice visually (single hero card).

### 7.7 Plan your ride — destination (booking step 2)
- **Content:** back, title, vehicle chip (tap to change), FROM / TO fields with the route dots and a swap button, saved-place tiles (Home, Office, "+ Set address" when empty), **Recent** (before typing) or **Results** (while typing, matched text in bold, distance and minutes per row), **Pick on map instead**, disabled **Select a destination** until one is chosen.
- **Behaviour:** TO is focused on entry. Search is debounced 300 ms, biased to the pickup, min 2 characters, cancels stale requests. Results outside the service area are shown greyed with "Outside service area". Selecting a row goes to Confirm. Editing FROM opens the same search for the pickup.
- **States:** no results ("Try a nearby landmark, or pick on the map"), search failure (retry + map fallback), offline (recents and saved places still work).

### 7.8 Pin on map / Save a place
- **Content:** full map with a fixed centre pin and "Move the map to adjust pin" hint, bottom sheet with address (reverse-geocoded after the map settles), and — when saving — a segmented label (Home / Office / Other with custom name), optional driver note (≤ 300 chars), "Suggest Office on weekday mornings" toggle, **Save {label}**.
- **Behaviour:** pin lifts while dragging and drops with a haptic when the map settles. "My location" recentre button. In *choose destination* mode the sheet shows **Confirm destination** and a small "Save this place" link instead.
- **Storage:** saved places sync to the account (§14, gap B6); until that endpoint exists they are stored on the device only and labelled as such.

### 7.9 Confirm ride — fare quote
- **Content:** map with pickup → destination route line and both markers; sheet with vehicle, **estimated fare** (large), pickup ETA, trip distance and time, payment method (Cash; others only when enabled in `/config`), promo row (flag `promo_codes`), pickup note (≤ 300 chars), "What can change the fare?" link, **Request {vehicle}**.
- **Behaviour:** `POST /quotes` on entry. Fare breakdown opens in a sheet (base, distance, time, surge, booking fee, minimum adjustment, total). Surge > 1 shows a warning chip "Fares are higher right now ×1.3". An outstanding fee is shown as a separate line "Previous cancellation fee". The quote lives for `quote_ttl_s` (default 300 s): at expiry the app re-quotes silently and, if the price changed, highlights the new fare and requires a fresh tap. `available_drivers = 0` shows "No drivers nearby right now — you can still try".
- **Request:** `POST /rides {quote_id, payment_method, pickup_note}` with a new idempotency key held for the whole attempt. The button shows progress and cannot be double-tapped.
- **Errors:** `QUOTE_EXPIRED` → re-quote; `ACTIVE_REQUEST_EXISTS` → go to the existing ride; `PRICING_UNAVAILABLE` / `OUT_OF_SERVICE_AREA` → explain and return to Plan; `PROMO_INVALID` → inline on the promo row; `ACCOUNT_SUSPENDED` → blocked screen.

### 7.10 Ride screen (one screen, state-driven)
One persistent map with a bottom sheet whose content follows the server state. The passenger can leave the app at any point and come back to the same state.

| Server state | Sheet content | Actions |
|---|---|---|
| `searching` | Radar pulse on pickup, "Finding your driver…", elapsed time, fare, vehicle | **Cancel** (free) |
| `no_driver_found` | Honest explanation, no blame | **Try again** (re-quote, same route) · Change vehicle · Close |
| `driver_assigned` / `driver_arriving` | Driver name, rating, photo placeholder, **plate (largest text)**, vehicle make/model/colour, live ETA, driver marker moving on map, pickup PIN when required | Call (masked) · Share trip · Cancel (with fee preview) · SOS |
| `arrived` | "Your driver is here" banner, waiting timer (free waiting then charged), PIN prominent | Call · Cancel · SOS |
| `in_progress` | Route to destination, ETA to drop-off, fare estimate, "Share live trip" | SOS · Share · Support. **No cancel** (backend forbids it) |
| `completed` | Goes to Trip complete (§7.11) | |
| `cancelled_by_driver` | "Your driver cancelled. You were not charged." | **Find another driver** (re-quote) |
| `cancelled_by_admin` / `failed` | Plain reason if provided, support link | Book again · Contact support |
| `cancelled_by_passenger` | Confirmation, fee if any | Done |

- **Live updates:** §9. Driver marker animates between positions (interpolated, rotated by heading); if the last position is older than 15 s the marker dims and shows "Updated 20 s ago" (blueprint §4.3: show last-updated).
- **Cancel flow:** `GET /rides/{id}/cancel-preview` → sheet shows "Free" or "৳X cancellation fee" with the free-window countdown (`cancellation_free_window_s` from `accepted_at`), optional reason chips → `POST /rides/{id}/cancel`. If `can_cancel = false`, explain and offer Support/SOS.
- **Pickup PIN (flag `pickup_pin`):** `GET /rides/{id}/pin` → 4 large digits "Tell your driver this code". If `locked`, show **Get a new code** → `POST /rides/{id}/pin/renew`.
- **Call driver:** only a masked number is ever available (`phone_masked`). Calling needs a number-masking bridge (§14, gap B8); until then the Call button is hidden rather than shown broken.
- **Screen stays awake** while this screen is open during an active ride.

### 7.11 Trip complete
- **Content:** success header, **amount to pay in cash** (large), route summary, distance and duration, itemised breakdown from `GET /trips/{id}/receipt`, a notice when the final fare differs from the estimate with the reason (waiting, route, previous fee), star rating (1–5) with optional comment (≤ 1000), **Done**, "Report a problem".
- **Behaviour:** rating is optional and can be skipped; `POST /trips/{id}/rate`. A 1–2 star rating offers "Tell us what went wrong" (opens a pre-filled support ticket). Unrated trips can be rated from History within `rating_window_days` (7).

### 7.12 History & receipt
- **History:** `GET /rides?limit=20&cursor=` infinite list (FlashList), grouped by month; each row: date, pickup → destination labels, fare (final or estimate), status chip. Cached for offline reading.
- **Receipt:** full breakdown, payment method, trip id (copyable), **Share / save as PDF**, **Rate** (if still allowed), **Get help with this trip**, **Book again** (prefills the route).
- **States:** empty ("Your rides will appear here" + Book a ride), cancelled rides show the fee or "No charge".

### 7.13 Wallet
`GET /wallet`: credit balance, outstanding cancellation fee with a plain explanation ("collected with your next fare"), and a short "How payments work" (cash only for now). Digital methods appear here only when `digital_payments` is on.

### 7.14 Safety
- **SOS:** red button on the ride screen and in the safety sheet. **Press and hold 2 s** (with a filling ring and haptics) to prevent accidents → `POST /trips/{id}/sos {note?}` (no idempotency key; never rate-limited; retried aggressively until it succeeds). Confirmation: "Our safety team has been alerted — incident #N" plus a **Call 999** button (national emergency number) and the option to add a note/photo/audio as evidence (`/incidents/{id}/evidence/*`).
- **Share trip:** sends a live-tracking link through the OS share sheet (§14, gap B5).
- **Trusted contacts:** up to 3 contacts for one-tap sharing (§14, gap B7; stored on-device until then).
- **Safety centre:** how PIN works, what masking means, how to report.

### 7.15 Support
- **New ticket:** category (payment, trip, driver, safety, account, other), subject (3–200), message (1–4000), optional linked trip → `POST /support/tickets`.
- **My tickets:** list with status (`open`, `in_progress`, `pending_user`, `resolved`, `closed`) → thread view, reply with `POST /support/tickets/{id}/messages`. A push arrives when support replies.
- **FAQ** bundled and translatable; works offline.

### 7.16 Profile & settings
- **Profile:** name (editable via `PATCH /me` with `expected_version`; `STALE_VERSION` → refetch and retry), phone (read-only), language.
- **Settings:** language, theme, notification categories (§10.3), saved places, legal, app version, **Sign out** (removes the device token first: `DELETE /me/devices`), **Delete account**.
- **Delete account:** explains what is removed and what is kept by law (financial and safety records), requires typing the confirmation word → `POST /me/deactivate {confirm: true, reason?}`. Refused by the server during an active ride or while money is owed — show the reason and the way to resolve it.

