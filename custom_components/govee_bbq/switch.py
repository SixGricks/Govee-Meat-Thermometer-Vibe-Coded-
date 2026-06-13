"""Switch entities: per-probe 'alerts armed'."""
from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import CONF_NAME, DOMAIN
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
    async_add_entities(
        GoveeBBQArmSwitch(coordinator, entry, probe)
        for probe in range(1, coordinator.probe_count + 1)
    )


class GoveeBBQArmSwitch(SwitchEntity, RestoreEntity):
    """When on, threshold crossings for this probe send push notifications."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:bell-ring"
    _attr_should_poll = False

    def __init__(
        self, coordinator: GoveeBBQCoordinator, entry: ConfigEntry, probe: int
    ) -> None:
        self.coordinator = coordinator
        self._probe = probe
        self._attr_unique_id = f"{entry.entry_id}_probe_{probe}_alerts"
        self._attr_name = f"Probe {probe} alerts"
        self._attr_is_on = False
        self._attr_device_info = _device_info(entry)

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last is not None:
            self._attr_is_on = last.state == "on"
        self.coordinator.register_arm(self._probe, self)
        self.coordinator.async_request_evaluate()

    async def async_turn_on(self, **kwargs: Any) -> None:
        self._attr_is_on = True
        self.async_write_ha_state()
        # If this probe already crossed its target while disarmed, alert now
        # (state is written first so the coordinator sees us as armed).
        self.coordinator.async_notify_latched(self._probe)
        self.coordinator.async_request_evaluate()

    async def async_turn_off(self, **kwargs: Any) -> None:
        self._attr_is_on = False
        self.async_write_ha_state()
        self.coordinator.async_request_evaluate()
