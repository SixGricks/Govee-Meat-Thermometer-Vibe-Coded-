"""The Govee BBQ Alarms integration."""
from __future__ import annotations

import logging
import os

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CARD_FILENAME, CARD_URL, DOMAIN, PLATFORMS
from .coordinator import GoveeBBQCoordinator

_LOGGER = logging.getLogger(__name__)
_CARD_REGISTERED = False


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Govee BBQ Alarms from a config entry."""
    await _async_register_card(hass)

    coordinator = GoveeBBQCoordinator(hass, entry)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    # Platforms create the entities, which register themselves with the
    # coordinator in their async_added_to_hass.
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    await coordinator.async_setup()
    coordinator.async_request_evaluate()

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        coordinator: GoveeBBQCoordinator = hass.data[DOMAIN].pop(entry.entry_id)
        coordinator.async_unload()
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload when options change."""
    await hass.config_entries.async_reload(entry.entry_id)


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the bundled Lovelace card and add it to the frontend once."""
    global _CARD_REGISTERED  # noqa: PLW0603
    if _CARD_REGISTERED:
        return
    path = os.path.join(os.path.dirname(__file__), "www", CARD_FILENAME)
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, path, False)]
    )
    add_extra_js_url(hass, CARD_URL)
    _CARD_REGISTERED = True
    _LOGGER.debug("Registered Govee BBQ card at %s", CARD_URL)
