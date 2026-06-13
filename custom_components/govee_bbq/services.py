"""Services that let the dashboard card edit options (notify targets, presets).

These are thin wrappers around ``config_entries.async_update_entry``: they write
the new value into the entry's options, which triggers the integration's update
listener and reloads it so the change takes effect (and the hub sensor the card
reads is refreshed). The card supplies the target device via its ``entry_id``.
"""
from __future__ import annotations

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv

from .const import (
    ATTR_ENTRY_ID,
    CONF_NOTIFY_SERVICES,
    CONF_PRESETS,
    DEFAULT_PRESET_CATEGORY,
    DEFAULT_PRESETS,
    DOMAIN,
    SERVICE_ADD_PRESET,
    SERVICE_DELETE_PRESET,
    SERVICE_SET_NOTIFY_SERVICES,
    TARGET_MAX,
    TARGET_MIN,
)

_SET_NOTIFY_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTRY_ID): cv.string,
        vol.Required(CONF_NOTIFY_SERVICES, default=list): vol.All(
            cv.ensure_list, [cv.string]
        ),
    }
)

_ADD_PRESET_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTRY_ID): cv.string,
        vol.Required("name"): cv.string,
        vol.Optional("high", default=0): vol.All(
            vol.Coerce(float), vol.Range(min=TARGET_MIN, max=TARGET_MAX)
        ),
        vol.Optional("low", default=0): vol.All(
            vol.Coerce(float), vol.Range(min=TARGET_MIN, max=TARGET_MAX)
        ),
        vol.Optional("category", default=DEFAULT_PRESET_CATEGORY): cv.string,
    }
)

_DELETE_PRESET_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTRY_ID): cv.string,
        vol.Required("name"): cv.string,
    }
)


def _get_entry(hass: HomeAssistant, entry_id: str) -> ConfigEntry:
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None or entry.domain != DOMAIN:
        raise ServiceValidationError(f"Unknown Govee BBQ device: {entry_id}")
    return entry


def _update_options(hass: HomeAssistant, entry: ConfigEntry, **changes) -> None:
    """Persist option changes; the update listener reloads the entry."""
    hass.config_entries.async_update_entry(
        entry, options={**entry.options, **changes}
    )


@callback
def async_register_services(hass: HomeAssistant) -> None:
    """Register the integration-wide services once."""
    if hass.services.has_service(DOMAIN, SERVICE_SET_NOTIFY_SERVICES):
        return

    async def _set_notify(call: ServiceCall) -> None:
        entry = _get_entry(hass, call.data[ATTR_ENTRY_ID])
        # Strip any "notify." prefix so the coordinator can call the service.
        services = [s.split(".", 1)[-1] for s in call.data[CONF_NOTIFY_SERVICES]]
        _update_options(hass, entry, **{CONF_NOTIFY_SERVICES: services})

    async def _add_preset(call: ServiceCall) -> None:
        entry = _get_entry(hass, call.data[ATTR_ENTRY_ID])
        name = call.data["name"].strip()
        if not name:
            raise ServiceValidationError("Preset name is required.")
        category = (call.data["category"] or DEFAULT_PRESET_CATEGORY).strip()
        # Replace any existing preset with the same name (case-insensitive).
        presets = [
            dict(p)
            for p in entry.options.get(CONF_PRESETS, DEFAULT_PRESETS)
            if str(p.get("name", "")).strip().lower() != name.lower()
        ]
        presets.append(
            {
                "name": name,
                "high": call.data["high"],
                "low": call.data["low"],
                "category": category or DEFAULT_PRESET_CATEGORY,
            }
        )
        _update_options(hass, entry, **{CONF_PRESETS: presets})

    async def _delete_preset(call: ServiceCall) -> None:
        entry = _get_entry(hass, call.data[ATTR_ENTRY_ID])
        name = call.data["name"].strip().lower()
        presets = [
            dict(p)
            for p in entry.options.get(CONF_PRESETS, DEFAULT_PRESETS)
            if str(p.get("name", "")).strip().lower() != name
        ]
        _update_options(hass, entry, **{CONF_PRESETS: presets})

    hass.services.async_register(
        DOMAIN, SERVICE_SET_NOTIFY_SERVICES, _set_notify, schema=_SET_NOTIFY_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_ADD_PRESET, _add_preset, schema=_ADD_PRESET_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_DELETE_PRESET, _delete_preset, schema=_DELETE_PRESET_SCHEMA
    )


@callback
def async_unregister_services(hass: HomeAssistant) -> None:
    """Remove the services when the last entry is unloaded."""
    for service in (
        SERVICE_SET_NOTIFY_SERVICES,
        SERVICE_ADD_PRESET,
        SERVICE_DELETE_PRESET,
    ):
        hass.services.async_remove(DOMAIN, service)
