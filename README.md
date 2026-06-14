# Govee BBQ Alarms — Home Assistant integration

[![hacs][hacs-badge]][hacs] [![Validate](https://github.com/SixGricks/Govee-Meat-Thermometer-Vibe-Coded-/actions/workflows/validate.yml/badge.svg)](https://github.com/SixGricks/Govee-Meat-Thermometer-Vibe-Coded-/actions/workflows/validate.yml)

Turn a Govee multi-probe BBQ thermometer (already in Home Assistant via the
Govee BLE integration + a Bluetooth proxy) into a full alarm system — **named
probes, high/low targets, an "approaching target" pre-alert, push
notifications with a Pause button and 5-minute reminders, and a dashboard
card** — all set up from the UI. No YAML.

> Not affiliated with or endorsed by Govee. "Govee" is a trademark of its
> respective owner.

```
H5055 -)) BLE advertisements -)) ESP32 Bluetooth proxy -)) Govee BLE integration -)) probe sensors
                                                                                         │
                                                                  Govee BBQ Alarms (this integration)
                                                                  ├─ targets / arming / presets (entities)
                                                                  ├─ alarm logic + push notifications
                                                                  └─ the Govee BBQ dashboard card
```

## Why an integration (and not the device's own app)?

The thermometer's data is **passive, read-only** BLE — nothing can be written
back to it. So targets and alarms live in Home Assistant, which is strictly
better: alerts reach your phone **anywhere** (not just within Bluetooth range),
they survive battery swaps and dropouts, and they're automatable. The one thing
it can't do is make the base station itself beep.

## Features

- **Per-probe targets** — high and low, `0` disables that alarm.
- **Named probes** — "Brisket flat", "Pit temp"… (tap to rename on the card).
- **Push notifications** to your phone via the HA Companion app: a dedicated
  "BBQ Alarm" channel, a **Pause alerts** action button, and a reminder every
  5 minutes while a probe stays past target.
- **Approaching-target pre-alert** — one heads-up a configurable number of
  degrees before the high target.
- **Presets** — Chicken / Ribs / Brisket out of the box, grouped into food
  **categories** (Beef, Poultry, Fish, Pork, Other). Create new presets right
  from the card.
- **Dashboard card** — each probe is its own mini-card with a large **current
  temperature** and an **alarm preset** summary. Tap a probe for a details
  popup (rename, targets, arm, presets), or use the inline **Edit alarm**
  dropdown. Optional **battery** readout, a toggle to **hide unavailable
  probes**, and a **Notifications** pill to choose which phones get alerts —
  all bundled and auto-registered (no manual resource).
- **Unit-agnostic** — follows whatever unit your probe sensors report.

## Requirements

1. Your Govee BBQ thermometer already shows **temperature probe sensors** in HA
   (via the Govee BLE integration + an ESP32/Bluetooth proxy in range).
2. The **Home Assistant Companion app** installed and signed in on your
   phone(s) — that's what receives the push notifications.

## Install (HACS)

1. HACS → **⋮ (top right) → Custom repositories**.
2. Repository: `https://github.com/SixGricks/Govee-Meat-Thermometer-Vibe-Coded-` · Category:
   **Integration** → **Add**.
3. Find **"Govee BBQ Alarms"** in HACS, click **Download**.
4. **Restart Home Assistant.**

<sub>Once published to the default HACS store you can skip the custom-repository
step.</sub>

## Set it up (all UI)

1. **Settings → Devices & Services → + Add Integration → "Govee BBQ Alarms"**.
2. Fill the form:
   - **Name** — e.g. `Smoker`.
   - **Probe temperature sensors** — pick your live `…temperature_probe_N`
     sensors (not the `…_alarm_…` or `…_battery` ones). Selection order becomes
     Probe 1, 2, 3…
   - **Notify service(s)** — your phone, e.g. `mobile_app_pixel_9`. Add more
     than one to alert several phones. (If none appear, install/sign-in the HA
     app on your phone first.)
   - **Approaching-target offset** — `0` to start (set it later if you want a
     pre-alert).
3. Submit. The integration creates all the entities and bundles the card.

## Add the card

Edit a dashboard → **Add card** → search **"Govee BBQ"**. It **auto-detects**
your device — just set an optional title. The visual editor also has toggles to
**hide unavailable probes** and **show battery level**. (Multiple BBQ devices?
Pick which one in the editor.)

<details><summary>YAML config (optional)</summary>

```yaml
type: custom:govee-bbq-card
title: Smoker
# entity: sensor.smoker   # optional — omit to auto-detect
# hide_unavailable: true  # hide probes with no live signal
# show_battery: true      # show the device battery on each probe
```
</details>

## Using it

- **Rename a probe** — tap its name on the card (or open the probe's details
  popup and edit the name there).
- **Probe details popup** — tap a probe's temperature/alarm area to open a popup
  with everything: rename, targets, arm toggle, and the preset picker.
- **Set targets** — open **Edit alarm** (or the details popup) and use the
  `−`/`+` steppers, or tap the number to type one. **`0` = that alarm off.**
  Most cooks only need a high target.
- **Arm the bell** — no bell, no notification. Targets still show on the card
  while disarmed.
- **Presets** — pick one from the **Edit alarm** dropdown (grouped by category).
  Use the **New preset** pill to add your own and file it under Beef, Poultry,
  Fish, Pork, or Other.
- **Notifications** — the **Notifications** pill at the bottom lets you tick
  which phones/apps receive this device's alerts.
- **Battery** — enable **Show battery level** in the card editor to show the
  device battery on each probe.
- **Hide unavailable** — enable **Hide unavailable probes** in the card editor
  to drop probes that have no live signal.
- **Approaching alert** — set the offset in the card footer (e.g. `10` → an
  armed probe targeting 203° pings you once at 193°).
- **The notification** — "🔥 Brisket flat hit 203°" on the BBQ Alarm channel,
  with a **Pause alerts** button (tap it from the lock screen to disarm that
  probe). Reminders repeat every 5 minutes until you pause or pull the meat.

## Options (after setup)

**Settings → Devices & Services → Govee BBQ Alarms → Configure**:

- **Reminder interval** (minutes).
- **Presets** — one per line, `Name | high | low | category` (use `0` for low to
  leave it alone; category is Beef/Poultry/Fish/Pork/Other), e.g.
  `Turkey (165) | 165 | 0 | Poultry`. You can also add presets straight from the
  card with the **New preset** pill.

## Entities created

Per probe: a high-target and low-target **number**, an alerts **switch**, a
name **text**, and `above_high` / `below_low` / `approaching` **binary
sensors**. Plus a global approach-offset **number** and a hub **sensor** (the
one the card reads; its state = number of probes currently in alarm).

## Govee app parity

| Govee app feature | Here | How |
|---|---|---|
| Temperature per probe | ✅ | Govee BLE integration (you already have this) |
| High/low targets & alarms | ✅ | This integration |
| Named probes & presets | ✅ | This integration + card |
| Advance / "almost there" alert | ✅ | Approaching-target offset |
| Alarm on your phone | ✅ and better | Push — works anywhere, not just in BLE range |
| Temperature graphs / export | ✅ | HA history / recorder (the probe sensors) |
| Multiple phones | ✅ | Add more notify services in setup |
| Make the base station beep | ❌ | Passive BLE is read-only — can't write back |

## Troubleshooting

- **No probes/temps** — confirm the Govee BLE integration shows live
  `…temperature_probe_N` sensors and your Bluetooth proxy is online and in
  range.
- **Probe shows "no signal" / no temperature** — this is intentional for
  *empty* slots. An unplugged probe just holds its last (stale) reading, so the
  integration only shows a temperature once the sensor is actually being
  written a couple of times within ~2 minutes (proof the device is still
  streaming that probe). A real probe normally goes live within seconds; if a
  connected probe drops to "no signal", check the Bluetooth proxy range.
- **No notifications** — re-check the notify service in the integration
  options; on Android exempt the Companion app from battery optimization and
  check the "BBQ Alarm" notification channel isn't muted; on iOS confirm
  notification permission. Test directly in Developer Tools → Actions →
  `notify.<your service>`.
- **Card says "No Govee BBQ device found"** — make sure the integration is
  added and you've reloaded the page (hard-refresh / clear app cache).
- **°C vs °F** — targets are raw numbers in *your* HA unit; set them in the
  unit your probes report.

## Legacy YAML approach

The earlier package-based approach (helpers + automations + a separate card)
lives in [`legacy-yaml/`](legacy-yaml/) for reference. The integration replaces
it entirely — you don't need both.

## Publishing

This repo is wired for `github.com/SixGricks/Govee-Meat-Thermometer-Vibe-Coded-`.
Push it to that public repo, then add it to HACS as a custom repository (see
**Install** above). The `.github/workflows/validate.yml` action runs hassfest +
HACS validation on every push. Tag a release (e.g. `v1.0.0`) so HACS offers a
versioned download.

[hacs]: https://github.com/hacs/integration
[hacs-badge]: https://img.shields.io/badge/HACS-Custom-41BDF5.svg
