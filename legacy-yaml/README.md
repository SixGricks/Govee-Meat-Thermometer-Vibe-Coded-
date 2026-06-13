# Legacy YAML approach (superseded)

These files are the original **package + automations + helper-based card**
approach, kept for reference. The **Govee BBQ Alarms integration** (in
`custom_components/govee_bbq/`) replaces all of this with a UI setup — you do
**not** need both.

| File | What it was |
|---|---|
| `govee_bbq.yaml` | HA package: input helpers, template binary sensors, notify group |
| `bbq_automations.yaml` | The 3 alarm automations to import into the UI |
| `configuration.yaml.example` | The `packages:` include snippet |
| `govee-bbq-card.js` | The helper-based card (reads `input_*` entities) |

If you ever want the manual route instead of the integration, the probe entity
IDs are already filled in (`sensor.kitchen_meat_thermometer_temperature_probe_1`
… `_6`); you'd still need to set your phone's `mobile_app_*` notify service.
Otherwise, ignore this folder.
