"""Text entities: per-probe friendly names."""
from __future__ import annotations

from homeassistant.components.text import TextEntity, TextMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import CONF_NAME, DOMAIN
from .coordinator import GoveeBBQCoordinator

_MAX_LEN = 30


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
    async_add_entities(
        GoveeBBQName(coordinator, entry, probe)
        for probe in range(1, coordinator.probe_count + 1)
    )


class GoveeBBQName(TextEntity, RestoreEntity):
    """The display name for one probe (e.g. 'Brisket flat')."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:tag"
    _attr_native_min = 0
    _attr_native_max = _MAX_LEN
    _attr_mode = TextMode.TEXT
    _attr_should_poll = False

    def __init__(
        self, coordinator: GoveeBBQCoordinator, entry: ConfigEntry, probe: int
    ) -> None:
        self.coordinator = coordinator
        self._probe = probe
        self._attr_unique_id = f"{entry.entry_id}_probe_{probe}_name"
        self._attr_name = f"Probe {probe} name"
        self._attr_native_value = ""
        self._attr_device_info = _device_info(entry)

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last is not None and last.state not in ("unknown", "unavailable"):
            self._attr_native_value = last.state[:_MAX_LEN]
        self.coordinator.register_name(self._probe, self)
        self.coordinator.async_request_evaluate()

    async def async_set_value(self, value: str) -> None:
        self._attr_native_value = (value or "")[:_MAX_LEN]
        self.async_write_ha_state()
        self.coordinator.async_request_evaluate()
