"""Alarm logic for Govee BBQ: thresholds, push notifications, reminders, pause.

This replaces the three YAML automations from the old package approach. It
watches the probe temperature sensors, compares them to the target number
entities, debounces threshold crossings, fires push notifications (with the
"Pause alerts" action button and 5-minute reminders), and handles the pause
action coming back from the phone.
"""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_interval,
)
from homeassistant.util import dt as dt_util

from .const import (
    ALARM_CHANNEL,
    CONF_NOTIFY_SERVICES,
    CONF_PRESETS,
    CONF_PROBES,
    CONF_REMINDER_MINUTES,
    DEFAULT_DEBOUNCE_SECONDS,
    DEFAULT_PRESET_CATEGORY,
    DEFAULT_PRESETS,
    DEFAULT_REMINDER_MINUTES,
    NOTIFICATION_ACTION_EVENT,
    NOTIFY_TAG_PREFIX,
    PRESET_CATEGORIES,
    PAUSE_ACTION_PREFIX,
    STATUS_APPROACH,
    STATUS_HIGH,
    STATUS_LOW,
    STATUS_OK,
    STATUS_UNAVAILABLE,
    STATUS_CHANNEL,
    CONF_DEBOUNCE_SECONDS,
    signal_update,
)

_LOGGER = logging.getLogger(__name__)

_KINDS = ("high", "low", "approach")


class GoveeBBQCoordinator:
    """Owns the alarm logic and the computed snapshot the card/sensors read."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.probe_sensors: list[str] = list(entry.data.get(CONF_PROBES, []))
        # notify_services live in options (editable from Configure); fall back
        # to data for entries created by an earlier version. Strip any
        # "notify." prefix so we can call hass.services.async_call("notify", x).
        raw_notify = entry.options.get(
            CONF_NOTIFY_SERVICES, entry.data.get(CONF_NOTIFY_SERVICES, [])
        )
        self.notify_services: list[str] = [s.split(".", 1)[-1] for s in raw_notify]
        # entity references, filled in by the platforms (keyed by 1-based probe)
        self.high: dict[int, Any] = {}
        self.low: dict[int, Any] = {}
        self.arm: dict[int, Any] = {}
        self.names: dict[int, Any] = {}
        self.approach_entity: Any = None
        # battery sensor belonging to the same device as the probes (resolved
        # once at setup from the entity/device registry — may be None).
        self.battery_entity: str | None = None
        # debounce + latch state, keyed (probe, kind)
        self._cond_since: dict[tuple[int, str], float] = {}
        self._latched: set[tuple[int, str]] = set()
        self._pending_timers: dict[tuple[int, str], Any] = {}
        # the computed snapshot (also exposed via the hub sensor attributes)
        self.data: dict[str, Any] = {"probes": [], "presets": [], "approach_offset": 0}
        self._unsubs: list = []

    # ------------------------------------------------------------------ #
    # lifecycle
    # ------------------------------------------------------------------ #
    async def async_setup(self) -> None:
        """Subscribe to sensor changes, the reminder timer, and pause events."""
        if self.probe_sensors:
            self._unsubs.append(
                async_track_state_change_event(
                    self.hass, self.probe_sensors, self._handle_temp_change
                )
            )
        # Auto-discover the device battery so the card can show it (opt-in).
        self.battery_entity = self._resolve_battery_entity()
        if self.battery_entity:
            self._unsubs.append(
                async_track_state_change_event(
                    self.hass, [self.battery_entity], self._handle_temp_change
                )
            )
        self._unsubs.append(
            async_track_time_interval(
                self.hass,
                self._handle_reminder,
                timedelta(minutes=self.reminder_minutes),
            )
        )
        self._unsubs.append(
            self.hass.bus.async_listen(NOTIFICATION_ACTION_EVENT, self._handle_pause_event)
        )

    @callback
    def async_unload(self) -> None:
        """Cancel all subscriptions and pending timers."""
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        for cancel in self._pending_timers.values():
            cancel()
        self._pending_timers.clear()

    # ------------------------------------------------------------------ #
    # options / config helpers
    # ------------------------------------------------------------------ #
    @property
    def probe_count(self) -> int:
        return len(self.probe_sensors)

    def _options(self) -> dict[str, Any]:
        return dict(self.entry.options or {})

    @property
    def presets(self) -> list[dict]:
        """Stored presets, each normalized to name/high/low/category."""
        raw = self._options().get(CONF_PRESETS, DEFAULT_PRESETS)
        out: list[dict] = []
        for preset in raw:
            try:
                high = float(preset.get("high", 0) or 0)
            except (TypeError, ValueError):
                high = 0.0
            try:
                low = float(preset.get("low", 0) or 0)
            except (TypeError, ValueError):
                low = 0.0
            out.append(
                {
                    "name": str(preset.get("name", "")).strip(),
                    "high": high,
                    "low": low,
                    "category": (preset.get("category") or DEFAULT_PRESET_CATEGORY),
                }
            )
        return out

    def notify_available(self) -> list[str]:
        """All notify service names currently registered (no 'notify.' prefix)."""
        return sorted(self.hass.services.async_services().get("notify", {}).keys())

    def _resolve_battery_entity(self) -> str | None:
        """Find a battery sensor on the same device(s) as the probe sensors."""
        if not self.probe_sensors:
            return None
        try:
            ent_reg = er.async_get(self.hass)
            device_ids: list[str] = []
            for sensor_id in self.probe_sensors:
                entry = ent_reg.async_get(sensor_id)
                if entry and entry.device_id and entry.device_id not in device_ids:
                    device_ids.append(entry.device_id)
            for device_id in device_ids:
                for entity in er.async_entries_for_device(
                    ent_reg, device_id, include_disabled_entities=False
                ):
                    if entity.domain != "sensor":
                        continue
                    if (entity.device_class or entity.original_device_class) == "battery":
                        return entity.entity_id
        except Exception as err:  # noqa: BLE001 - never let discovery break setup
            _LOGGER.debug("Govee BBQ: battery auto-discovery failed: %s", err)
        return None

    @property
    def battery_level(self) -> int | None:
        """Current device battery percent, or None if unknown/unavailable."""
        if not self.battery_entity:
            return None
        state = self.hass.states.get(self.battery_entity)
        if state is None or state.state in ("unknown", "unavailable", "", None):
            return None
        try:
            return int(round(float(state.state)))
        except (TypeError, ValueError):
            return None

    @property
    def reminder_minutes(self) -> int:
        return int(self._options().get(CONF_REMINDER_MINUTES, DEFAULT_REMINDER_MINUTES))

    @property
    def debounce_seconds(self) -> int:
        return int(self._options().get(CONF_DEBOUNCE_SECONDS, DEFAULT_DEBOUNCE_SECONDS))

    # ------------------------------------------------------------------ #
    # entity registration (called by the platform entities once added)
    # ------------------------------------------------------------------ #
    @callback
    def register_target(self, kind: str, probe: int, entity: Any) -> None:
        (self.high if kind == "high" else self.low)[probe] = entity

    @callback
    def register_arm(self, probe: int, entity: Any) -> None:
        self.arm[probe] = entity

    @callback
    def register_name(self, probe: int, entity: Any) -> None:
        self.names[probe] = entity

    @callback
    def register_approach(self, entity: Any) -> None:
        self.approach_entity = entity

    # ------------------------------------------------------------------ #
    # value getters
    # ------------------------------------------------------------------ #
    @staticmethod
    def _eid(entity: Any) -> str | None:
        return entity.entity_id if entity is not None else None

    @staticmethod
    def _num(entity: Any) -> float:
        if entity is None or entity.native_value is None:
            return 0.0
        try:
            return float(entity.native_value)
        except (TypeError, ValueError):
            return 0.0

    @property
    def approach_offset(self) -> float:
        return self._num(self.approach_entity)

    def probe_name(self, probe: int) -> str:
        entity = self.names.get(probe)
        if entity is not None and entity.native_value:
            value = str(entity.native_value).strip()
            if value and value.lower() not in ("unknown", "unavailable"):
                return value
        return f"Probe {probe}"

    def _is_armed(self, probe: int) -> bool:
        entity = self.arm.get(probe)
        return bool(entity is not None and entity.is_on)

    def _tag(self, probe: int) -> str:
        """Per-device notification tag (so multiple BBQ devices don't collide)."""
        return f"{NOTIFY_TAG_PREFIX}{self.entry.entry_id}_{probe}"

    def _pause_action(self, probe: int) -> str:
        return f"{PAUSE_ACTION_PREFIX}{self.entry.entry_id}_{probe}"

    def temp(self, probe: int) -> tuple[float | None, str, bool, Any]:
        """Return (value or None, unit, available, last_updated)."""
        idx = probe - 1
        if idx < 0 or idx >= len(self.probe_sensors):
            return None, "°", False, None
        state = self.hass.states.get(self.probe_sensors[idx])
        if state is None:
            return None, "°", False, None
        unit = state.attributes.get("unit_of_measurement", "°")
        if state.state in ("unavailable", "unknown", "", None):
            return None, unit, False, state.last_updated
        try:
            return float(state.state), unit, True, state.last_updated
        except (TypeError, ValueError):
            return None, unit, False, state.last_updated

    # ------------------------------------------------------------------ #
    # evaluation
    # ------------------------------------------------------------------ #
    @callback
    def _handle_temp_change(self, _event: Event) -> None:
        self.async_request_evaluate()

    @callback
    def async_request_evaluate(self) -> None:
        self.hass.async_create_task(self.async_evaluate())

    @callback
    def async_notify_latched(self, probe: int) -> None:
        """Immediately alert for an already-latched high/low on this probe.

        Called when a probe is armed AFTER it has already crossed its target
        (set a target, food is already done, then arm the bell) — otherwise the
        first alert would wait for the next reminder tick.
        """
        if not self._is_armed(probe):
            return
        if (probe, "high") in self._latched:
            self.hass.async_create_task(self._async_notify(probe, "high"))
        elif (probe, "low") in self._latched:
            self.hass.async_create_task(self._async_notify(probe, "low"))

    async def async_evaluate(self) -> None:
        """Recompute every probe's status, run debounce/notify, push snapshot."""
        offset = self.approach_offset
        probes: list[dict] = []
        for probe in range(1, self.probe_count + 1):
            temp, unit, available, last_updated = self.temp(probe)
            high = self._num(self.high.get(probe))
            low = self._num(self.low.get(probe))

            cond = {"high": False, "low": False, "approach": False}
            if available and temp is not None:
                if high > 0 and temp >= high:
                    cond["high"] = True
                if low > 0 and temp <= low:
                    cond["low"] = True
                if high > 0 and offset > 0 and (high - offset) <= temp < high:
                    cond["approach"] = True

            for kind in _KINDS:
                self._update_debounce(probe, kind, cond[kind])

            probes.append(
                {
                    "probe": probe,
                    "temp_entity": self.probe_sensors[probe - 1],
                    "temp": round(temp, 1) if temp is not None else None,
                    "unit": unit,
                    "available": available,
                    "last_updated": last_updated.isoformat() if last_updated else None,
                    "name": self.probe_name(probe),
                    "name_entity": self._eid(self.names.get(probe)),
                    "high": high,
                    "high_entity": self._eid(self.high.get(probe)),
                    "low": low,
                    "low_entity": self._eid(self.low.get(probe)),
                    "armed": self._is_armed(probe),
                    "arm_entity": self._eid(self.arm.get(probe)),
                    "status": self._status(available, temp, high, low, offset),
                    "above_high": (probe, "high") in self._latched,
                    "below_low": (probe, "low") in self._latched,
                    "approaching": (probe, "approach") in self._latched,
                }
            )

        self.data = {
            "probes": probes,
            "presets": self.presets,
            "preset_categories": PRESET_CATEGORIES,
            "approach_offset": offset,
            "approach_offset_entity": self._eid(self.approach_entity),
            "alarm_count": sum(1 for p in probes if p["status"] in (STATUS_HIGH, STATUS_LOW)),
            "battery": self.battery_level,
            "battery_entity": self.battery_entity,
            "notify_selected": list(self.notify_services),
            "notify_available": self.notify_available(),
        }
        async_dispatcher_send(self.hass, signal_update(self.entry.entry_id))

    @staticmethod
    def _status(
        available: bool, temp: float | None, high: float, low: float, offset: float
    ) -> str:
        if not available or temp is None:
            return STATUS_UNAVAILABLE
        if low > 0 and temp <= low:
            return STATUS_LOW
        if high > 0 and temp >= high:
            return STATUS_HIGH
        if high > 0 and offset > 0 and (high - offset) <= temp < high:
            return STATUS_APPROACH
        return STATUS_OK

    # ------------------------------------------------------------------ #
    # debounce (replicates the old 10s delay_on)
    # ------------------------------------------------------------------ #
    def _update_debounce(self, probe: int, kind: str, cond_now: bool) -> None:
        key = (probe, kind)
        if cond_now:
            if key not in self._cond_since:
                self._cond_since[key] = dt_util.utcnow().timestamp()
                self._schedule_recheck(key)
            elif key not in self._latched:
                elapsed = dt_util.utcnow().timestamp() - self._cond_since[key]
                if elapsed >= self.debounce_seconds:
                    self._latched.add(key)
                    self._cancel_recheck(key)
                    if self._is_armed(probe):
                        self.hass.async_create_task(self._async_notify(probe, kind))
        else:
            self._cond_since.pop(key, None)
            self._latched.discard(key)
            self._cancel_recheck(key)

    def _schedule_recheck(self, key: tuple[int, str]) -> None:
        self._cancel_recheck(key)
        self._pending_timers[key] = async_call_later(
            self.hass, self.debounce_seconds + 0.5, self._recheck_cb
        )

    def _cancel_recheck(self, key: tuple[int, str]) -> None:
        cancel = self._pending_timers.pop(key, None)
        if cancel is not None:
            cancel()

    @callback
    def _recheck_cb(self, _now) -> None:
        self.async_request_evaluate()

    # ------------------------------------------------------------------ #
    # notifications
    # ------------------------------------------------------------------ #
    async def _async_notify(self, probe: int, kind: str, reminder: bool = False) -> None:
        temp, unit, available, _ = self.temp(probe)
        if temp is None or not available:
            return
        name = self.probe_name(probe)
        high = self._num(self.high.get(probe))
        low = self._num(self.low.get(probe))
        value = round(temp, 1)

        if kind == "high":
            title = f"🔥 {name} hit {value}{unit}"
            message = f"Now {value}{unit} — high target is {round(high)}{unit}."
        elif kind == "low":
            title = f"🥶 {name} dropped to {value}{unit}"
            message = f"Now {value}{unit} — low target is {round(low)}{unit}."
        else:
            title = f"⏰ {name} approaching target"
            message = (
                f"Now {value}{unit} — high target is {round(high)}{unit} "
                f"({round(high - temp, 1)}{unit} to go)."
            )
        if reminder:
            message += " (Reminder)"

        data = {
            "tag": self._tag(probe),
            "channel": ALARM_CHANNEL,
            "importance": "high",
            "priority": "high",
            "ttl": 0,
            "sticky": "true",
            "actions": [{"action": self._pause_action(probe), "title": "Pause alerts"}],
            "push": {
                "sound": {"name": "default", "critical": 1, "volume": 1.0},
                "interruption-level": "time-sensitive",
            },
        }
        await self._async_send(title, message, data)

    async def _async_send(self, title: str, message: str, data: dict) -> None:
        for service in self.notify_services:
            try:
                await self.hass.services.async_call(
                    "notify",
                    service,
                    {"title": title, "message": message, "data": data},
                    blocking=True,
                )
            except Exception as err:  # noqa: BLE001 - surface any notify failure, keep going
                _LOGGER.warning("Govee BBQ: notify.%s failed: %s", service, err)

    async def _handle_reminder(self, _now) -> None:
        for probe in range(1, self.probe_count + 1):
            if not self._is_armed(probe):
                continue
            if (probe, "high") in self._latched:
                await self._async_notify(probe, "high", reminder=True)
            elif (probe, "low") in self._latched:
                await self._async_notify(probe, "low", reminder=True)

    async def _handle_pause_event(self, event: Event) -> None:
        action = event.data.get("action")
        if not action or not action.startswith(PAUSE_ACTION_PREFIX):
            return
        rest = action[len(PAUSE_ACTION_PREFIX):]
        entry_id, _, probe_str = rest.rpartition("_")
        if entry_id != self.entry.entry_id:
            return  # belongs to a different BBQ device
        try:
            probe = int(probe_str)
        except ValueError:
            return
        entity = self.arm.get(probe)
        if entity is None:
            return
        await entity.async_turn_off()
        name = self.probe_name(probe)
        await self._async_send(
            "🔕 Alerts paused",
            f"Alerts paused for {name}. Re-arm from the BBQ card when ready.",
            {
                "tag": self._tag(probe),
                "channel": STATUS_CHANNEL,
                "importance": "low",
                "priority": "normal",
            },
        )
        self.async_request_evaluate()
