"""The Govee BBQ Alarms integration."""
from __future__ import annotations

import logging
import os

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import CARD_FILENAME, CARD_URL, DOMAIN, PLATFORMS
from .coordinator import GoveeBBQCoordinator
from .services import async_register_services, async_unregister_services

_LOGGER = logging.getLogger(__name__)
_CARD_REGISTERED = False


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Govee BBQ Alarms from a config entry."""
    await _async_register_card(hass)
    async_register_services(hass)

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
        # Drop the shared services once the last BBQ device is gone.
        if not hass.data.get(DOMAIN):
            async_unregister_services(hass)
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload when options change."""
    await hass.config_entries.async_reload(entry.entry_id)


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the bundled Lovelace card and add it to the frontend once.

    The card is served with cache headers ON so the mobile app / tablet
    browsers keep it ready locally — re-fetching it on every dashboard open
    over a slow link is what makes Lovelace render before the custom element
    is defined ("Custom element doesn't exist: govee-bbq-card"). To still pick
    up new versions after a HACS update, the script URL carries a ?v=<version>
    query tied to the integration version, which busts the cache on upgrade.
    """
    global _CARD_REGISTERED  # noqa: PLW0603
    if _CARD_REGISTERED:
        return
    path = os.path.join(os.path.dirname(__file__), "www", CARD_FILENAME)
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, path, True)]
    )
    try:
        integration = await async_get_integration(hass, DOMAIN)
        version = str(integration.version) if integration.version else "dev"
    except Exception:  # noqa: BLE001 - versioning is best-effort, never block setup
        version = "dev"
    add_extra_js_url(hass, f"{CARD_URL}?v={version}")
    _CARD_REGISTERED = True
    _LOGGER.debug("Registered Govee BBQ card at %s?v=%s", CARD_URL, version)
