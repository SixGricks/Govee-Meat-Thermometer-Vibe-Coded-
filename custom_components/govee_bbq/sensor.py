"""Hub sensor: the single entity the Lovelace card reads to render everything."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    ATTR_HUB,
    CONF_NAME,
    DOMAIN,
    STATUS_HIGH,
    STATUS_LOW,
    signal_update,
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
    async_add_entities([GoveeBBQHubSensor(coordinator, entry)])


class GoveeBBQHubSensor(SensorEntity):
    """State = number of probes currently in alarm; attributes drive the card."""

    _attr_has_entity_name = True
    _attr_name = None  # take the device name (e.g. "Smoker")
    _attr_icon = "mdi:grill"
    _attr_should_poll = False

    def __init__(self, coordinator: GoveeBBQCoordinator, entry: ConfigEntry) -> None:
        self.coordinator = coordinator
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_hub"
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

    @property
    def native_value(self) -> int:
        probes = self.coordinator.data.get("probes", [])
        return sum(1 for p in probes if p.get("status") in (STATUS_HIGH, STATUS_LOW))

    @property
    def extra_state_attributes(self) -> dict:
        data = self.coordinator.data
        return {
            ATTR_HUB: True,
            "entry_id": self._entry.entry_id,
            "name": self._entry.data.get(CONF_NAME, "BBQ"),
            "probes": data.get("probes", []),
            "presets": data.get("presets", []),
            "approach_offset": data.get("approach_offset", 0),
            "approach_offset_entity": data.get("approach_offset_entity"),
        }
