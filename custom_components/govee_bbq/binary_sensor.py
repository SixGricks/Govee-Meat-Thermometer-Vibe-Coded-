"""Binary sensors: per-probe above_high / below_low / approaching (debounced)."""
from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_NAME, DOMAIN, signal_update
from .coordinator import GoveeBBQCoordinator

# (snapshot key, name suffix, icon)
_KINDS = (
    ("above_high", "above high", "mdi:fire-alert"),
    ("below_low", "below low", "mdi:snowflake-alert"),
    ("approaching", "approaching high", "mdi:progress-clock"),
)


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
        for key, suffix, icon in _KINDS:
            entities.append(
                GoveeBBQBinarySensor(coordinator, entry, probe, key, suffix, icon)
            )
    async_add_entities(entities)


class GoveeBBQBinarySensor(BinarySensorEntity):
    """Reflects one debounced threshold flag from the coordinator snapshot."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(
        self,
        coordinator: GoveeBBQCoordinator,
        entry: ConfigEntry,
        probe: int,
        key: str,
        suffix: str,
        icon: str,
    ) -> None:
        self.coordinator = coordinator
        self._entry = entry
        self._probe = probe
        self._key = key
        self._attr_unique_id = f"{entry.entry_id}_probe_{probe}_{key}"
        self._attr_name = f"Probe {probe} {suffix}"
        self._attr_icon = icon
        self._attr_device_info = _device_info(entry)

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, signal_update(self._entry.entry_id), self._handle_update
            )
        )
        self._handle_update()

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()

    def _probe_data(self) -> dict | None:
        for probe in self.coordinator.data.get("probes", []):
            if probe["probe"] == self._probe:
                return probe
        return None

    @property
    def is_on(self) -> bool:
        data = self._probe_data()
        return bool(data and data.get(self._key))

    @property
    def available(self) -> bool:
        data = self._probe_data()
        return bool(data and data.get("available"))
