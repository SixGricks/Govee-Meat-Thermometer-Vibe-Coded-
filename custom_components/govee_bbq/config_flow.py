"""Config and options flow for Govee BBQ Alarms (full UI setup, no YAML)."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_APPROACH_OFFSET,
    CONF_NAME,
    CONF_NOTIFY_SERVICES,
    CONF_PRESETS,
    CONF_PROBES,
    CONF_REMINDER_MINUTES,
    DEFAULT_APPROACH_OFFSET,
    DEFAULT_NAME,
    DEFAULT_PRESET_CATEGORY,
    DEFAULT_PRESETS,
    DEFAULT_REMINDER_MINUTES,
    DOMAIN,
    MAX_PROBES,
    OFFSET_MAX,
    OFFSET_MIN,
)


def _notify_options(hass) -> list[str]:
    """Available notify services, mobile_app_* first."""
    services = list(hass.services.async_services().get("notify", {}).keys())
    services.sort(key=lambda name: (0 if name.startswith("mobile_app_") else 1, name))
    return services


def _parse_presets(text: str) -> list[dict]:
    """Parse 'Name | high | low | category' lines into preset dicts."""
    presets: list[dict] = []
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|")]
        name = parts[0]
        if not name:
            continue
        try:
            high = float(parts[1]) if len(parts) > 1 and parts[1] else 0
        except ValueError:
            high = 0
        try:
            low = float(parts[2]) if len(parts) > 2 and parts[2] else 0
        except ValueError:
            low = 0
        category = parts[3] if len(parts) > 3 and parts[3] else DEFAULT_PRESET_CATEGORY
        presets.append(
            {"name": name, "high": high, "low": low, "category": category}
        )
    return presets


class GoveeBBQConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the initial setup."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            probes = user_input.get(CONF_PROBES, [])
            notify = user_input.get(CONF_NOTIFY_SERVICES, [])
            if not probes:
                errors[CONF_PROBES] = "no_probes"
            elif len(probes) > MAX_PROBES:
                errors[CONF_PROBES] = "too_many"
            elif not notify:
                errors[CONF_NOTIFY_SERVICES] = "no_notify"
            else:
                name = (user_input.get(CONF_NAME) or DEFAULT_NAME).strip()
                return self.async_create_entry(
                    title=name,
                    data={
                        CONF_NAME: name,
                        CONF_PROBES: probes,
                    },
                    # notify_services lives in OPTIONS so it can be changed
                    # later from Configure (a dropdown), not just at setup.
                    options={
                        CONF_NOTIFY_SERVICES: notify,
                        CONF_APPROACH_OFFSET: user_input.get(
                            CONF_APPROACH_OFFSET, DEFAULT_APPROACH_OFFSET
                        ),
                        CONF_REMINDER_MINUTES: DEFAULT_REMINDER_MINUTES,
                        CONF_PRESETS: DEFAULT_PRESETS,
                    },
                )

        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default=DEFAULT_NAME): str,
                vol.Required(CONF_PROBES): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="sensor", multiple=True)
                ),
                vol.Required(CONF_NOTIFY_SERVICES): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        options=_notify_options(self.hass),
                        multiple=True,
                        custom_value=True,
                        mode=selector.SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Optional(
                    CONF_APPROACH_OFFSET, default=DEFAULT_APPROACH_OFFSET
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=OFFSET_MIN,
                        max=OFFSET_MAX,
                        step=1,
                        mode=selector.NumberSelectorMode.BOX,
                    )
                ),
            }
        )
        return self.async_show_form(
            step_id="user", data_schema=schema, errors=errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return GoveeBBQOptionsFlow(config_entry)


class GoveeBBQOptionsFlow(OptionsFlow):
    """Edit the reminder cadence and presets after setup."""

    def __init__(self, config_entry: ConfigEntry) -> None:
        # Stored under a private name to avoid the deprecation that newer HA
        # raises when an OptionsFlow sets `self.config_entry` directly.
        self._entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        options = dict(self._entry.options)
        if user_input is not None:
            presets = _parse_presets(user_input.get("presets_text", ""))
            return self.async_create_entry(
                title="",
                data={
                    CONF_NOTIFY_SERVICES: user_input.get(CONF_NOTIFY_SERVICES, []),
                    CONF_REMINDER_MINUTES: int(
                        user_input.get(CONF_REMINDER_MINUTES, DEFAULT_REMINDER_MINUTES)
                    ),
                    CONF_PRESETS: presets or DEFAULT_PRESETS,
                    CONF_APPROACH_OFFSET: options.get(
                        CONF_APPROACH_OFFSET, DEFAULT_APPROACH_OFFSET
                    ),
                },
            )

        current_notify = options.get(
            CONF_NOTIFY_SERVICES, self._entry.data.get(CONF_NOTIFY_SERVICES, [])
        )
        # Live notify services plus any currently-selected ones (so a phone
        # that is briefly offline still shows up as selected).
        notify_choices = sorted(set(_notify_options(self.hass)) | set(current_notify))
        notify_choices.sort(key=lambda name: (0 if name.startswith("mobile_app_") else 1, name))

        current_presets = options.get(CONF_PRESETS, DEFAULT_PRESETS)
        presets_text = "\n".join(
            f"{p['name']} | {p.get('high', 0)} | {p.get('low', 0)} | "
            f"{p.get('category', DEFAULT_PRESET_CATEGORY)}"
            for p in current_presets
        )
        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_NOTIFY_SERVICES, default=current_notify
                ): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        options=notify_choices,
                        multiple=True,
                        custom_value=True,
                        mode=selector.SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Optional(
                    CONF_REMINDER_MINUTES,
                    default=options.get(CONF_REMINDER_MINUTES, DEFAULT_REMINDER_MINUTES),
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=1, max=120, step=1, mode=selector.NumberSelectorMode.BOX
                    )
                ),
                vol.Optional("presets_text", default=presets_text): selector.TextSelector(
                    selector.TextSelectorConfig(multiline=True)
                ),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
