"""Constants for the Govee BBQ Alarms integration."""
from __future__ import annotations

DOMAIN = "govee_bbq"

# --- config entry data keys ---
CONF_NAME = "name"
CONF_PROBES = "probes"  # list of probe temperature sensor entity_ids
CONF_NOTIFY_SERVICES = "notify_services"  # list of notify service names (no "notify." prefix)

# --- options keys ---
CONF_APPROACH_OFFSET = "approach_offset_default"
CONF_PRESETS = "presets"
CONF_REMINDER_MINUTES = "reminder_minutes"
CONF_DEBOUNCE_SECONDS = "debounce_seconds"

# --- defaults ---
DEFAULT_NAME = "BBQ"
DEFAULT_APPROACH_OFFSET = 0
DEFAULT_REMINDER_MINUTES = 5
DEFAULT_DEBOUNCE_SECONDS = 10
MAX_PROBES = 6

TARGET_MIN = 0
TARGET_MAX = 600
TARGET_STEP = 1
OFFSET_MIN = 0
OFFSET_MAX = 50

# --- presets ---
# Presets group into food categories so the card can organize the picker.
PRESET_CATEGORIES = ["Beef", "Poultry", "Fish", "Pork", "Other"]
DEFAULT_PRESET_CATEGORY = "Other"

# Default presets: low 0 means "leave the probe's low target alone".
DEFAULT_PRESETS = [
    {"name": "Chicken (165)", "high": 165, "low": 0, "category": "Poultry"},
    {"name": "Pork ribs (195)", "high": 195, "low": 0, "category": "Pork"},
    {"name": "Brisket (203)", "high": 203, "low": 0, "category": "Beef"},
]

# --- services (called by the card to edit options without the UI flow) ---
SERVICE_SET_NOTIFY_SERVICES = "set_notify_services"
SERVICE_ADD_PRESET = "add_preset"
SERVICE_DELETE_PRESET = "delete_preset"
ATTR_ENTRY_ID = "entry_id"

# --- notifications ---
NOTIFY_TAG_PREFIX = "bbq-probe-"
ALARM_CHANNEL = "BBQ Alarm"
STATUS_CHANNEL = "BBQ Status"
PAUSE_ACTION_PREFIX = "BBQ_PAUSE_"
NOTIFICATION_ACTION_EVENT = "mobile_app_notification_action"

# --- status values (the card maps these to colours) ---
STATUS_UNAVAILABLE = "unavailable"
STATUS_OK = "ok"
STATUS_LOW = "low"
STATUS_APPROACH = "approach"
STATUS_HIGH = "high"

# --- hub sensor attribute marker (card auto-discovers by this) ---
ATTR_HUB = "govee_bbq_hub"

# --- frontend card ---
CARD_FILENAME = "govee-bbq-card.js"
CARD_URL = f"/{DOMAIN}/{CARD_FILENAME}"

PLATFORMS = ["number", "switch", "text", "binary_sensor", "sensor"]


def signal_update(entry_id: str) -> str:
    """Dispatcher signal fired when the computed snapshot changes."""
    return f"{DOMAIN}_{entry_id}_update"
