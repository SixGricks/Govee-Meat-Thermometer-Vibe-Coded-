# Govee H5055 BBQ Alarms & Card for Home Assistant

Targets, alarms, push notifications, and a 6-probe dashboard card for the Govee H5055 BBQ thermometer — all inside Home Assistant.

## 1. What this is

The H5055 broadcasts its probe temperatures over Bluetooth Low Energy every few seconds. An ESP32 running ESPHome's Bluetooth proxy relays those advertisements to Home Assistant, where the official Govee BLE integration turns them into temperature sensors. That part you already have. This project adds everything the Govee app does on top of those sensors: per-probe names, high/low targets, an "approaching target" pre-alert, push notifications to your phone with a Pause button, and a custom Lovelace card to drive it all.

```
H5055 -)) BLE advertisements -)) ESP32 Bluetooth proxy -)) HA Govee BLE integration -)) sensors
                                                                                          |
                                          +-----------------------------------------------+
                                          |
                                          +--> govee_bbq.yaml   (this package: targets / alarms / notifications)
                                          +--> govee-bbq-card.js (this card: dashboard UI)
```

Two files:

| File | What it is | Where it goes |
|---|---|---|
| `govee_bbq.yaml` | HA package: helpers, template binary sensors, automations, notify group, preset script | `config/packages/` |
| `govee-bbq-card.js` | Custom Lovelace card (`custom:govee-bbq-card`) | `config/www/` |

## 2. Why targets live in HA, not on the device

The data path is **passive and read-only**. The H5055 just shouts advertisements into the air; the ESP32 proxy and the Govee BLE integration only listen. There is no supported way to write a target temperature back to the base station over this connection — and you don't need one. Keeping targets in Home Assistant is strictly better:

- **Alerts reach your phone anywhere.** The Govee app alarms only work while your phone is in BLE range of the base station. HA push notifications work from the grocery store.
- **Targets survive the device.** They're HA helpers, so they persist across base-station battery swaps, restarts, and signal dropouts.
- **They're automatable.** Named probes, presets, pre-alerts, reminders, "turn on the kitchen lights when the brisket stalls" — anything HA can do.

## 3. Install — the package

### 3.1 Enable packages (skip if you already use them)

Create the folder `config/packages/` if it doesn't exist, then add this to `configuration.yaml` (merge into your existing `homeassistant:` block if you have one):

```yaml
homeassistant:
  packages: !include_dir_named packages
```

See [`configuration.yaml.example`](configuration.yaml.example) for the exact block plus the "what if I already have a `homeassistant:` block" case and an optional recorder tweak for longer cook history.

**Editing files from the UI (no SSH/Samba):** install the **File editor** add-on (Settings > Add-ons > Add-on Store), or **Studio Code Server** for a full editor with find-and-replace. Either one lets you edit `configuration.yaml` and `govee_bbq.yaml` right in the browser. After editing, run **Developer Tools > YAML > Check configuration** before restarting.

### 3.2 Copy the file

Copy `govee_bbq.yaml` into `config/packages/`.

### 3.3 Probe entity IDs — ✅ already filled in

This copy of `govee_bbq.yaml` already has **your** probe entity IDs baked in (all 54 references), so there's nothing to replace here. For reference, this is the mapping that was applied:

| Probe | Live temperature sensor |
|---|---|
| 1 | `sensor.kitchen_meat_thermometer_temperature_probe_1` |
| 2 | `sensor.kitchen_meat_thermometer_temperature_probe_2` |
| 3 | `sensor.kitchen_meat_thermometer_temperature_probe_3` |
| 4 | `sensor.kitchen_meat_thermometer_temperature_probe_4` |
| 5 | `sensor.kitchen_meat_thermometer_temperature_probe_5` |
| 6 | `sensor.kitchen_meat_thermometer_temperature_probe_6` |

> The device also exposes `..._temperature_alarm_probe_*`, `..._low_temperature_alarm_probe_1`, and `..._battery` sensors. Those mirror the **Govee app's own** alarm settings (read-only) and battery — they're *not* the live readings, so this package doesn't use them. If you ever re-pair the thermometer and the entity IDs change, just find-and-replace the six IDs above in `govee_bbq.yaml`.

### 3.4 Required edit (b): your phone's notify service

Find your phone's notify action in **Developer Tools > Actions** — start typing `notify.mobile_app` and pick yours (it's named after your phone, e.g. `notify.mobile_app_pixel_9`). In `govee_bbq.yaml`, replace `mobile_app_YOUR_PHONE_HERE` with the part after `notify.` (e.g. `mobile_app_pixel_9`).

### 3.5 Restart and verify

Restart Home Assistant. **A full restart is required the first time** — the notify group (`notify.bbq_alert_targets`) is only created at startup, so **Reload all YAML configuration** is *not* enough on first install. (Reloading YAML is fine for later edits, like adding presets.)

Then verify:

1. **Developer Tools > States** — search `bbq_`. You should see the six name helpers, the high/low numbers, the alert toggles, `input_number.bbq_approach_offset`, `input_select.bbq_presets`, and 18 `binary_sensor.bbq_probe_*` threshold sensors.
2. **Developer Tools > Actions** — type `bbq` and confirm `notify.bbq_alert_targets` exists.
3. **One-time setup:** set `input_number.bbq_approach_offset` to `10` (or your preference). It ships unset (0 = approach alerts off) so that HA restarts never overwrite your choice.

## 4. Install — the card

1. Copy `govee-bbq-card.js` to `config/www/` (create the folder if needed). **If `config/www/` didn't exist before, restart Home Assistant once** — the `/local/` path is only registered at startup.
2. Register the resource: **Settings > Dashboards > ⋮ (top right) > Resources > Add Resource**:
   - URL: `/local/govee-bbq-card.js`
   - Type: **JavaScript module**

   Don't see a Resources menu? Enable **Advanced Mode** on your user profile (click your name in the bottom-left sidebar) and look again.
3. Hard-refresh your browser (Ctrl+F5) and/or clear the Companion app's frontend cache (app settings > Debugging > Clear frontend cache, or just force-close and reopen).

Then add the card to a dashboard. **Edit dashboard > Add card > search "Govee BBQ".** The card has a **visual editor** — no YAML needed:

- **Card title** (optional) — e.g. "Smoker".
- **Probes** — click **+ Add probe** for each one. For each row, pick the **number** (1–6, matching the physical probe port) and start typing in the **entity** box to choose your temperature sensor from the autocomplete list. Remove a row with the ✕.

That's it — the card fills in the rest. `number` is what links each probe to its `bbq_probe_N_*` helpers.

<details>
<summary>Prefer YAML? (Add card > Manual)</summary>

```yaml
type: custom:govee-bbq-card
title: Smoker
probes:
  - entity: sensor.kitchen_meat_thermometer_temperature_probe_1
    number: 1
  - entity: sensor.kitchen_meat_thermometer_temperature_probe_2
    number: 2
  - entity: sensor.kitchen_meat_thermometer_temperature_probe_3
    number: 3
  - entity: sensor.kitchen_meat_thermometer_temperature_probe_4
    number: 4
  - entity: sensor.kitchen_meat_thermometer_temperature_probe_5
    number: 5
  - entity: sensor.kitchen_meat_thermometer_temperature_probe_6
    number: 6
```

These are your real probe IDs — copy-paste ready. List only the probes you use; 1–6 entries are fine.
</details>

## 5. Using it

- **Rename a probe:** tap its name on the card and type a new one ("Brisket flat", "Pit temp"). Names persist across restarts.
- **Set targets:** use the preset chips or the +/− steppers on each probe's high and low targets. **A target of 0 means that alarm is disabled.** Most cooks only need a high target; low targets are useful for pit-temperature probes ("warn me if the smoker drops below 225").
- **Arm the bell:** each probe has an alerts toggle (`input_boolean.bbq_probe_N_alerts`). No bell, no notifications — targets alone don't fire anything. The threshold sensors keep tracking state even while disarmed, so the card always shows whether a probe is over/under target; if you re-arm a probe that's *already* past its target, the next 5-minute reminder picks it up.
- **Presets:** pick a preset (e.g. "Brisket (203)") and apply it to a probe — it fills in the targets for you. See section 6 to add your own.
- **Approaching alert:** `input_number.bbq_approach_offset` (exposed on the card) is a single global pre-alert offset. Set it to 10 and an armed probe with a high target of 203 notifies you once at 193 — time to go check the bark. Leave it at 0 to disable.
- **The notification:** when an armed probe crosses a target you get a push notification on the "BBQ Alarm" channel, high priority — title *"🔥 Brisket flat hit 203°"*, message *"Now 203° — high target is 203°."* On Android it includes a **Pause alerts** action button — tap it from your lock screen and that probe's bell turns off, no app required.
- **Reminders:** if a probe stays past its target and stays armed, you get a reminder every 5 minutes until you pause it or pull the meat.

A note on units: everything follows your HA unit system. If HA shows °F, set targets in °F; if °C, set them in °C. The card reads the unit from your sensor entities.

## 6. Add your own presets

Open `govee_bbq.yaml` and search for `TODO(user)` — there are exactly two spots, and they must stay in sync. To add "Turkey (165)":

```yaml
# 1) In input_select.bbq_presets, add an option:
        - "Turkey (165)"
# 2) In script.bbq_apply_preset's preset_map, add a matching entry:
            "Turkey (165)": {high: 165, low: 0}
```

The option text and the preset_map key must match exactly. Reload all YAML afterward.

## 7. Test it without cooking

No need to light the smoker:

1. Plug a probe in and leave it at room temperature (say it reads 72).
2. On the card: arm that probe's bell and set its **high** target *below* the current reading, e.g. 50.
3. Wait about 10 seconds — the binary sensors debounce with a 10s `delay_on` so a single noisy reading can't false-alarm.
4. A push notification should arrive on your phone.
5. Tap **Pause alerts** in the notification (Android). Watch the card: that probe's bell should turn off and reminders stop.
6. Reset the target to 0 (or a real value) and you're done.

If step 4 fails, see Troubleshooting below.

## 8. Govee app feature parity

| Govee app feature | In Home Assistant | How |
|---|---|---|
| Temperature per probe | ✅ | Govee BLE integration (you already have this) |
| High/low targets & alarms | ✅ | This package |
| Named probes | ✅ | This package + card (tap to rename) |
| Presets (chicken, brisket…) | ✅ | This package + card; add your own (section 6) |
| Advance / "almost there" alert | ✅ | `input_number.bbq_approach_offset` |
| Alarm on your phone | ✅ and better | Push notification — works anywhere, not just within BLE range |
| Temperature graphs | ✅ | Built-in history (click any probe sensor), or a card — see below |
| Data export | ✅ | HA recorder/history; download from History, or query the database |
| Multiple phones | ✅ | Add each phone's `mobile_app_*` service to the `bbq_alert_targets` notify group in `govee_bbq.yaml` |
| Make the H5055 base station beep | ❌ | Not possible — passive BLE is read-only; nothing can be written back to the device |

Graph card example:

```yaml
type: statistics-graph
title: Cook history
period: 5minute
stat_types:
  - mean
  - max
entities:
  - sensor.kitchen_meat_thermometer_temperature_probe_1
  - sensor.kitchen_meat_thermometer_temperature_probe_2
```

(A plain `history-graph` card with the same entities also works.)

## 9. Troubleshooting

**Probe entities show "unavailable"**
- An unplugged probe legitimately reports unavailable — that's normal, and the alarms auto-suppress for it (the binary sensors use availability checks, so no false alarms).
- If *all* six are unavailable: check the ESP32 Bluetooth proxy is online (Settings > Devices & Services > ESPHome) and within BLE range of the H5055, and that the H5055 has batteries/power.

**Targets seem wrong / °C vs °F confusion**
- Targets follow your HA-configured unit system. The numbers in `input_number.bbq_probe_N_high/low` are raw — `203` means 203° in *your* unit. If HA is set to °C, a brisket target is ~95, not 203. Same for the approach offset.

**No notifications arrive**
- Confirm you replaced `mobile_app_YOUR_PHONE_HERE` (section 3.4), then test the group directly: Developer Tools > Actions > `notify.bbq_alert_targets` with a test message.
- Android: exempt the Companion app from battery optimization, and check the **"BBQ Alarm"** notification channel isn't muted (Android Settings > Apps > Home Assistant > Notifications).
- iOS: make sure the Companion app has notification permission and you've granted it on this device.

**"Custom element doesn't exist: govee-bbq-card"**
- The resource isn't registered or isn't loading. Re-check section 4 step 2 (exact URL `/local/govee-bbq-card.js`, type *JavaScript module*), then hard-refresh (Ctrl+F5) or clear the app's frontend cache. Remember: the Resources menu only appears with Advanced Mode enabled on your profile.

**Helpers missing after restart**
- Check **Settings > System > Logs** for YAML errors, and confirm the `packages: !include_dir_named packages` line landed under the `homeassistant:` key (section 3.1).
