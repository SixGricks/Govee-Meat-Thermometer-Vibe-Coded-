"""Number entities: per-probe high/low targets and the global approach offset."""
from __future__ import annotations

from homeassistant.components.number import NumberMode, RestoreNumber
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_APPROACH_OFFSET,
    CONF_NAME,
    DEFAULT_APPROACH_OFFSET,
    DOMAIN,
    OFFSET_MAX,
    OFFSET_MIN,
    TARGET_MAX,
    TARGET_MIN,
    TARGET_STEP,
)
from .coordinator import GoveeBBQCoordinator


def _device_info(entry: ConfigEntry) -> DeviceInfo:
    return DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=entry.data.get(CONF_NAME, "BBQ"),
        manufacturer="Govee BBQ Alarms",
        model="BBQ probe alarms",
    )


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: GoveeBBQCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list = []
    for probe in range(1, coordinator.probe_count + 1):
        entities.append(GoveeBBQTarget(coordinator, entry, probe, "high"))
        entities.append(GoveeBBQTarget(coordinator, entry, probe, "low"))
    entities.append(GoveeBBQApproachOffset(coordinator, entry))
    async_add_entities(entities)


class GoveeBBQTarget(RestoreNumber):
    """A high or low target for one probe (0 = that alarm disabled)."""

    _attr_has_entity_name = True
    _attr_native_min_value = TARGET_MIN
    _attr_native_max_value = TARGET_MAX
    _attr_native_step = TARGET_STEP
    _attr_mode = NumberMode.BOX
    _attr_native_unit_of_measurement = "°"
    _attr_should_poll = False

    def __init__(
        self, coordinator: GoveeBBQCoordinator, entry: ConfigEntry, probe: int, kind: str
    ) -> None:
        self.coordinator = coordinator
        self._probe = probe
        self._kind = kind
        self._attr_unique_id = f"{entry.entry_id}_probe_{probe}_{kind}"
        self._attr_name = f"Probe {probe} {'high' if kind == 'high' else 'low'} target"
        self._attr_icon = (
            "mdi:thermometer-chevron-up" if kind == "high" else "mdi:thermometer-chevron-down"
        )
        self._attr_native_value = 0
        self._attr_device_info = _device_info(entry)

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_number_data()
        if last is not None and last.native_value is not None:
            self._attr_native_value = last.native_value
        self.coordinator.register_target(self._kind, self._probe, self)
        self.coordinator.async_request_evaluate()

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = max(TARGET_MIN, min(TARGET_MAX, value))
        self.async_write_ha_state()
        self.coordinator.async_request_evaluate()


class GoveeBBQApproachOffset(RestoreNumber):
    """Global 'approaching target' offset in degrees (0 = disabled)."""

    _attr_has_entity_name = True
    _attr_native_min_value = OFFSET_MIN
    _attr_native_max_value = OFFSET_MAX
    _attr_native_step = 1
    _attr_mode = NumberMode.BOX
    _attr_native_unit_of_measurement = "°"
    _attr_icon = "mdi:thermometer-alert"
    _attr_entity_category = EntityCategory.CONFIG
    _attr_name = "Approaching-target offset"
    _attr_should_poll = False

    def __init__(self, coordinator: GoveeBBQCoordinator, entry: ConfigEntry) -> None:
        self.coordinator = coordinator
        self._attr_unique_id = f"{entry.entry_id}_approach_offset"
        self._attr_native_value = entry.options.get(
            CONF_APPROACH_OFFSET, DEFAULT_APPROACH_OFFSET
        )
        self._attr_device_info = _device_info(entry)

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_number_data()
        if last is not None and last.native_value is not None:
            self._attr_native_value = last.native_value
        self.coordinator.register_approach(self)
        self.coordinator.async_request_evaluate()

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = max(OFFSET_MIN, min(OFFSET_MAX, value))
        self.async_write_ha_state()
        self.coordinator.async_request_evaluate()
