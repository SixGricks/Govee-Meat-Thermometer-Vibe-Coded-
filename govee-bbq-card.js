/* ============================================================================
 * govee-bbq-card.js — custom Lovelace card for the Govee H5055 BBQ package
 * ============================================================================
 * Companion to govee_bbq.yaml (the HA package that creates all the helpers
 * this card talks to). See README.md for install + usage.
 *
 * No build step, no imports, no CDN: copy this single file to config/www/
 * and register it as a "JavaScript module" resource (/local/govee-bbq-card.js).
 *
 * Card config (README section 4):
 *   type: custom:govee-bbq-card
 *   title: Smoker            # optional
 *   probes:                  # 1-6 entries
 *     - entity: sensor.YOUR_PROBE_1_TEMPERATURE
 *       number: 1            # links to the bbq_probe_1_* helpers
 * ========================================================================= */
(() => {
  'use strict';

  const CARD_VERSION = '1.1.0';
  const OFFSET_ENTITY = 'input_number.bbq_approach_offset';
  const PRESETS_ENTITY = 'input_select.bbq_presets';
  const PRESET_PLACEHOLDER = 'presets…';

  // mdi:bell outline filled, plus a diagonal strike line shown when disarmed.
  const BELL_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29' +
    'C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29' +
    'C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21"/>' +
    '<line class="strike" x1="3" y1="3" x2="21" y2="21" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  const CSS = `
    :host { display: block; }
    ha-card { overflow: hidden; }
    .wrap { padding: 4px 0 10px; }
    .probe {
      --probe-color: var(--disabled-text-color, #9e9e9e);
      border-left: 4px solid var(--probe-color);
      padding: 10px 16px 12px 12px;
      transition: border-color .3s ease;
    }
    .probe + .probe { border-top: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
    .st-gray  { --probe-color: var(--disabled-text-color, #9e9e9e); }
    .st-green { --probe-color: var(--success-color, #43a047); }
    .st-blue  { --probe-color: var(--info-color, #2196f3); }
    .st-amber { --probe-color: var(--warning-color, #ffa600); }
    .st-red   { --probe-color: var(--error-color, #db4437); }
    .main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .left { display: flex; flex-direction: column; flex: 1 1 110px; min-width: 0; }
    button {
      font: inherit; color: inherit; background: none; border: none;
      padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent;
    }
    button:focus-visible, .preset:focus-visible {
      outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px;
    }
    .name {
      text-align: left; font-weight: 600; font-size: 1.05em;
      color: var(--primary-text-color); min-height: 36px; padding: 0 4px;
      border-radius: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .name:hover { background: rgba(127,127,127,.12); }
    .ago { font-size: .72em; color: var(--secondary-text-color); padding-left: 4px; }
    .name-input, .chip-input {
      font: inherit; color: var(--primary-text-color);
      background: var(--card-background-color, transparent);
      border: 1px solid var(--primary-color, #03a9f4); border-radius: 6px;
      min-height: 32px; padding: 0 6px; box-sizing: border-box;
    }
    .name-input { font-weight: 600; font-size: 1.05em; width: 140px; }
    .chip-input { width: 64px; text-align: center; -moz-appearance: textfield; }
    .chip-input::-webkit-outer-spin-button,
    .chip-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .tempwrap {
      display: flex; align-items: baseline; justify-content: flex-end;
      min-width: 84px; color: var(--probe-color); transition: color .3s ease;
    }
    .temp { font-size: 2em; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .unit { font-size: .95em; margin-left: 2px; opacity: .8; }
    .tempwrap.nosignal { color: var(--disabled-text-color, #9e9e9e); }
    .tempwrap.nosignal .temp { font-weight: 400; opacity: .6; }
    .st-red .temp { animation: bbq-pulse 1.6s ease-in-out infinite; }
    @keyframes bbq-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
    .controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .chip {
      display: inline-flex; align-items: center; min-height: 36px;
      border: 1px solid var(--divider-color, rgba(127,127,127,.35));
      border-radius: 18px; overflow: hidden;
    }
    .chip-label {
      font-size: .68em; text-transform: uppercase; letter-spacing: .06em;
      color: var(--secondary-text-color); padding: 0 2px 0 10px;
    }
    .step { min-width: 36px; min-height: 36px; font-size: 1.15em; color: var(--secondary-text-color); }
    .step:hover, .chip-val:hover, .bell:hover { background: rgba(127,127,127,.12); }
    .chip-val {
      min-width: 44px; min-height: 36px; padding: 0 2px; text-align: center;
      font-weight: 600; font-variant-numeric: tabular-nums; color: var(--primary-text-color);
    }
    .bell {
      min-width: 36px; min-height: 36px; display: inline-flex;
      align-items: center; justify-content: center; border-radius: 50%;
      color: var(--disabled-text-color, #9e9e9e);
    }
    .bell.armed { color: var(--accent-color, #ff9800); }
    .bell.missing { opacity: .4; cursor: default; }
    .bell svg { width: 22px; height: 22px; display: block; }
    .bell .strike { display: none; }
    .bell:not(.armed) .strike { display: initial; }
    .preset {
      min-height: 36px; max-width: 130px; font: inherit; font-size: .9em;
      border: 1px solid var(--divider-color, rgba(127,127,127,.35));
      border-radius: 18px; background: var(--card-background-color, transparent);
      color: var(--primary-text-color); padding: 0 10px; cursor: pointer;
    }
    .preset:disabled { opacity: .4; cursor: default; }
    .bar {
      height: 4px; border-radius: 2px; margin: 8px 0 0; overflow: hidden;
      background: var(--divider-color, rgba(127,127,127,.25));
    }
    .fill {
      height: 100%; width: 0%; border-radius: 2px; background: var(--probe-color);
      transition: width .4s ease, background-color .3s ease;
    }
    .foot {
      display: flex; align-items: center; gap: 10px; padding: 10px 16px 2px 16px;
      border-top: 1px solid var(--divider-color, rgba(127,127,127,.2));
    }
    .foot-label { font-size: .85em; color: var(--secondary-text-color); }
    .hint { padding: 8px 16px 0; font-size: .8em; color: var(--warning-color, #ffa600); }
  `;

  // 226.4 -> "226.4", 226.0 -> "226"
  const fmtNum = (v) => {
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  };

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  class GoveeBBQCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._hass = null;
      this._config = null;
      this._probes = null;
      this._rows = [];
      this._built = false;
      this._timer = null;
      this._offsetChip = null;
      this._hint = null;
    }

    /* ------------------------------------------------------------------ */
    /* Lovelace plumbing                                                   */
    /* ------------------------------------------------------------------ */

    static getStubConfig(hass, entities) {
      const list = Array.isArray(entities) ? entities : [];
      // Only consider live "..._temperature_probe_N" sensors (not the Govee
      // app's "..._temperature_alarm_probe_N" mirrors), preferring probe 1.
      const probes = list.filter(
        (e) => typeof e === 'string' && /^sensor\..*temperature_probe_\d/i.test(e)
      );
      const guess = probes.find((e) => /_probe_1\b/i.test(e)) || probes[0];
      return {
        title: 'Smoker',
        probes: [{ entity: guess || 'sensor.YOUR_PROBE_1_TEMPERATURE', number: 1 }],
      };
    }

    // Tells HA to show a graphical editor (form fields) when you add or edit
    // this card on a dashboard — no hand-written YAML required.
    static getConfigElement() {
      return document.createElement('govee-bbq-card-editor');
    }

    setConfig(config) {
      if (!config || typeof config !== 'object') {
        throw new Error('govee-bbq-card: invalid config — expected an object (see README section 4).');
      }
      const probes = config.probes;
      if (!Array.isArray(probes) || probes.length === 0) {
        throw new Error(
          "govee-bbq-card: 'probes' is required and must be a non-empty list of 1-6 entries, " +
          "each with 'entity' (a sensor id) and 'number' (1-6). See README section 4."
        );
      }
      if (probes.length > 6) {
        throw new Error(
          `govee-bbq-card: 'probes' supports at most 6 entries (the H5055 has 6 probe ports), got ${probes.length}.`
        );
      }
      this._probes = probes.map((p, i) => {
        if (!p || typeof p !== 'object') {
          throw new Error(`govee-bbq-card: probes[${i}] must be a mapping with 'entity' and 'number'.`);
        }
        if (typeof p.entity !== 'string' || !p.entity.includes('.')) {
          throw new Error(
            `govee-bbq-card: probes[${i}].entity must be an entity id string, e.g. 'sensor.my_probe_1_temperature'.`
          );
        }
        if (!Number.isInteger(p.number) || p.number < 1 || p.number > 6) {
          throw new Error(
            `govee-bbq-card: probes[${i}].number must be an integer 1-6 — it links the row to the ` +
            'bbq_probe_N_* helpers from govee_bbq.yaml.'
          );
        }
        const n = p.number;
        return {
          entity: p.entity,
          number: n,
          ids: {
            name: `input_text.bbq_probe_${n}_name`,
            high: `input_number.bbq_probe_${n}_high`,
            low: `input_number.bbq_probe_${n}_low`,
            alerts: `input_boolean.bbq_probe_${n}_alerts`,
          },
        };
      });
      this._config = config;
      this._built = false;
      if (this._hass) {
        this._build();
        this._update();
      }
    }

    getCardSize() {
      return 1 + (this._probes ? this._probes.length : 0);
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._probes) return; // setConfig not called yet
      if (!this._built) this._build();
      this._update();
    }

    get hass() {
      return this._hass;
    }

    connectedCallback() {
      // Keep the relative "updated Xs ago" labels fresh even when no new
      // state arrives (e.g. probe out of range).
      if (!this._timer) {
        this._timer = window.setInterval(() => this._refreshAgo(), 30000);
      }
      this._refreshAgo();
    }

    disconnectedCallback() {
      if (this._timer) {
        window.clearInterval(this._timer);
        this._timer = null;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Build: create the DOM once, keep refs, never re-render wholesale    */
    /* ------------------------------------------------------------------ */

    _build() {
      const root = this.shadowRoot;
      root.innerHTML = '';
      this._rows = [];

      const style = document.createElement('style');
      style.textContent = CSS;

      const card = document.createElement('ha-card');
      if (this._config.title) card.header = this._config.title;

      const wrap = el('div', 'wrap');

      for (const probe of this._probes) {
        const row = {
          cfg: probe,
          ids: probe.ids,
          editingName: false,
          status: 'gray',
          lastUpdated: null,
          entityMissing: false,
          optKey: null,
          els: {},
          lowChip: null,
          highChip: null,
        };

        const rowEl = el('div', 'probe st-gray');
        const main = el('div', 'main');

        // -- name + "updated Xs ago" --------------------------------------
        const left = el('div', 'left');
        const name = el('button', 'name', 'Probe ' + probe.number);
        name.type = 'button';
        name.title = 'Click to rename this probe';
        name.addEventListener('click', () => this._beginNameEdit(row));
        const ago = el('div', 'ago', '');
        left.append(name, ago);

        // -- big temperature ----------------------------------------------
        const tempWrap = el('div', 'tempwrap nosignal');
        const temp = el('span', 'temp', '—');
        const unit = el('span', 'unit', '');
        tempWrap.append(temp, unit);

        // -- controls: low/high chips, bell, preset picker ------------------
        const controls = el('div', 'controls');
        row.lowChip = this._buildNumberChip('Low', probe.ids.low, 5, 0, 600);
        row.highChip = this._buildNumberChip('High', probe.ids.high, 5, 0, 600);

        const bell = el('button', 'bell');
        bell.type = 'button';
        bell.title = 'Toggle alerts for this probe';
        bell.setAttribute('aria-label', `Toggle alerts for probe ${probe.number}`);
        bell.innerHTML = BELL_SVG;
        bell.addEventListener('click', () => {
          if (this._hass && this._hass.states[probe.ids.alerts]) {
            this._hass.callService('input_boolean', 'toggle', { entity_id: probe.ids.alerts });
          }
        });

        const preset = document.createElement('select');
        preset.className = 'preset';
        preset.title = 'Apply a preset to this probe';
        preset.setAttribute('aria-label', `Apply a preset to probe ${probe.number}`);
        preset.append(new Option(PRESET_PLACEHOLDER, ''));
        preset.addEventListener('change', () => {
          const value = preset.value;
          if (value && this._hass) {
            this._hass.callService('script', 'bbq_apply_preset', {
              probe: probe.number,
              preset: value,
            });
          }
          preset.value = ''; // snap back to the placeholder
        });

        controls.append(row.lowChip.root, row.highChip.root, bell, preset);
        main.append(left, tempWrap, controls);

        // -- thin progress bar (temp vs high target) -----------------------
        const bar = el('div', 'bar');
        bar.style.display = 'none';
        const fill = el('div', 'fill');
        bar.append(fill);

        rowEl.append(main, bar);
        wrap.append(rowEl);

        row.els = { row: rowEl, name, ago, tempWrap, temp, unit, bell, preset, bar, fill };
        this._rows.push(row);
      }

      // -- footer: global approach offset (README: "exposed on the card") --
      const foot = el('div', 'foot');
      foot.append(el('span', 'foot-label', 'Approach alert'));
      this._offsetChip = this._buildNumberChip('Offset', OFFSET_ENTITY, 1, 0, 50);
      foot.append(this._offsetChip.root);
      wrap.append(foot);

      // -- hint shown when the package's helpers are missing ---------------
      this._hint = el('div', 'hint', 'helpers not found — is govee_bbq.yaml loaded?');
      this._hint.style.display = 'none';
      wrap.append(this._hint);

      card.append(wrap);
      root.append(style, card);
      this._built = true;
    }

    /* ------------------------------------------------------------------ */
    /* A stepper chip bound to one input_number entity                     */
    /* ------------------------------------------------------------------ */

    _buildNumberChip(label, entityId, step, min, max) {
      const self = this;
      const root = el('div', 'chip');
      if (label) root.append(el('span', 'chip-label', label));
      const minus = el('button', 'step', '−');
      minus.type = 'button';
      minus.title = `${label || 'Value'} −${step}`;
      const val = el('button', 'chip-val', '?');
      val.type = 'button';
      val.title = 'Click to type a value (0 = off)';
      const plus = el('button', 'step', '+');
      plus.type = 'button';
      plus.title = `${label || 'Value'} +${step}`;
      root.append(minus, val, plus);

      // pending: optimistic value so rapid +/- taps accumulate instead of
      // re-reading a stale state between server round-trips.
      const state = { editing: false, pending: null, pendingTimer: null };

      const stateObj = () => (self._hass ? self._hass.states[entityId] : undefined);
      const current = () => {
        if (state.pending !== null) return state.pending;
        const obj = stateObj();
        if (!obj) return null;
        const v = parseFloat(obj.state);
        return Number.isFinite(v) ? v : null;
      };
      const display = (v) => {
        val.textContent = v === null ? '?' : v <= 0 ? 'off' : fmtNum(v);
      };
      const save = (v) => {
        v = Math.min(max, Math.max(min, v)); // clamp (>= 0 per contract)
        state.pending = v;
        if (state.pendingTimer) window.clearTimeout(state.pendingTimer);
        state.pendingTimer = window.setTimeout(() => {
          state.pending = null;
        }, 5000);
        display(v);
        if (self._hass && stateObj()) {
          self._hass.callService('input_number', 'set_value', { entity_id: entityId, value: v });
        }
      };

      minus.addEventListener('click', () => {
        const c = current();
        if (c !== null) save(c - step);
      });
      plus.addEventListener('click', () => {
        const c = current();
        if (c !== null) save(c + step);
      });

      // Click the value -> swap to a number input for direct entry.
      val.addEventListener('click', () => {
        if (state.editing || !stateObj()) return;
        state.editing = true;
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'chip-input';
        input.min = String(min);
        input.max = String(max);
        input.step = '1';
        const c = current();
        input.value = c === null ? '' : String(c);
        val.replaceWith(input);
        input.focus();
        input.select();
        let cancelled = false;
        const finish = (commit) => {
          if (!state.editing) return;
          state.editing = false;
          const raw = parseFloat(input.value);
          input.replaceWith(val);
          if (commit && Number.isFinite(raw)) save(raw);
          else display(current());
        };
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            finish(true);
          } else if (ev.key === 'Escape') {
            ev.stopPropagation(); // don't close a surrounding HA dialog
            cancelled = true;
            finish(false);
          }
        });
        input.addEventListener('blur', () => {
          if (!cancelled) finish(true);
        });
      });

      return {
        root,
        get editing() {
          return state.editing;
        },
        // Called on every hass update; skipped while the user is editing.
        update(obj) {
          if (state.editing) return;
          if (state.pending !== null) {
            const v = obj ? parseFloat(obj.state) : NaN;
            if (Number.isFinite(v) && Math.abs(v - state.pending) < 0.001) {
              state.pending = null;
              if (state.pendingTimer) {
                window.clearTimeout(state.pendingTimer);
                state.pendingTimer = null;
              }
            } else {
              display(state.pending); // keep showing the optimistic value
              return;
            }
          }
          if (!obj) {
            display(null); // helper missing -> "?"
            return;
          }
          const v = parseFloat(obj.state);
          display(Number.isFinite(v) ? v : null);
        },
      };
    }

    /* ------------------------------------------------------------------ */
    /* Name editing (click name -> text input; Enter/blur save, Esc cancel)*/
    /* ------------------------------------------------------------------ */

    _beginNameEdit(row) {
      if (row.editingName) return;
      if (!this._hass || !this._hass.states[row.ids.name]) return; // helper missing
      row.editingName = true;
      const nameBtn = row.els.name;
      const cur = String(this._hass.states[row.ids.name].state || '');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'name-input';
      input.maxLength = 30; // matches the input_text helper's max
      input.value = cur === 'unknown' || cur === 'unavailable' ? '' : cur;
      nameBtn.replaceWith(input);
      input.focus();
      input.select();
      let cancelled = false;
      const finish = (commit) => {
        if (!row.editingName) return;
        row.editingName = false;
        const value = input.value.trim();
        input.replaceWith(nameBtn);
        if (commit) {
          if (this._hass && this._hass.states[row.ids.name]) {
            this._hass.callService('input_text', 'set_value', {
              entity_id: row.ids.name,
              value,
            });
          }
          nameBtn.textContent = value || 'Probe ' + row.cfg.number;
        }
      };
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          finish(true);
        } else if (ev.key === 'Escape') {
          ev.stopPropagation();
          cancelled = true;
          finish(false);
        }
      });
      input.addEventListener('blur', () => {
        if (!cancelled) finish(true);
      });
    }

    /* ------------------------------------------------------------------ */
    /* Update: mutate text/classes only; never rebuild, never clobber a    */
    /* control the user is editing.                                        */
    /* ------------------------------------------------------------------ */

    _update() {
      if (!this._built || !this._hass) return;
      const hass = this._hass;
      let helpersMissing = false;

      // Global approach offset (default 0 if the helper is missing).
      const offsetObj = hass.states[OFFSET_ENTITY];
      if (!offsetObj) helpersMissing = true;
      const offset = offsetObj ? parseFloat(offsetObj.state) || 0 : 0;
      this._offsetChip.update(offsetObj);

      // Preset options shared by every row.
      const presetsObj = hass.states[PRESETS_ENTITY];
      if (!presetsObj) helpersMissing = true;
      const options =
        presetsObj && Array.isArray(presetsObj.attributes.options)
          ? presetsObj.attributes.options
          : [];
      const optKey = options.join('');

      for (const row of this._rows) {
        const ids = row.ids;
        const sensor = hass.states[row.cfg.entity];
        const nameObj = hass.states[ids.name];
        const highObj = hass.states[ids.high];
        const lowObj = hass.states[ids.low];
        const alertsObj = hass.states[ids.alerts];
        if (!nameObj || !highObj || !lowObj || !alertsObj) helpersMissing = true;

        // ---- name (skip while the user is typing a new one) ----
        if (!row.editingName) {
          let label = 'Probe ' + row.cfg.number;
          if (nameObj) {
            const v = String(nameObj.state || '').trim();
            if (v && v !== 'unknown' && v !== 'unavailable') label = v;
          }
          if (row.els.name.textContent !== label) row.els.name.textContent = label;
        }

        // ---- temperature ----
        row.entityMissing = !sensor;
        row.lastUpdated = sensor ? Date.parse(sensor.last_updated) : null;
        let temp = NaN;
        let unit = '';
        if (sensor) {
          unit =
            (sensor.attributes && sensor.attributes.unit_of_measurement) || '°';
          if (sensor.state !== 'unavailable' && sensor.state !== 'unknown') {
            temp = parseFloat(sensor.state);
          }
        }
        const hasTemp = Number.isFinite(temp);
        const tempText = hasTemp ? fmtNum(temp) : '—';
        if (row.els.temp.textContent !== tempText) row.els.temp.textContent = tempText;
        const unitText = hasTemp ? unit : '';
        if (row.els.unit.textContent !== unitText) row.els.unit.textContent = unitText;
        row.els.tempWrap.classList.toggle('nosignal', !hasTemp);

        // ---- low / high target chips (skip internally while editing) ----
        row.lowChip.update(lowObj);
        row.highChip.update(highObj);

        // ---- bell ----
        const armed = !!alertsObj && alertsObj.state === 'on';
        row.els.bell.classList.toggle('armed', armed);
        row.els.bell.classList.toggle('missing', !alertsObj);
        row.els.bell.setAttribute('aria-pressed', armed ? 'true' : 'false');

        // ---- preset picker (skip while the dropdown has focus) ----
        const select = row.els.preset;
        if (this.shadowRoot.activeElement !== select) {
          if (row.optKey !== optKey) {
            while (select.options.length > 1) select.remove(1);
            for (const opt of options) select.append(new Option(opt, opt));
            row.optKey = optKey;
          }
          if (select.value !== '') select.value = '';
          select.disabled = options.length === 0;
        }

        // ---- status colour ----
        const high = highObj ? parseFloat(highObj.state) || 0 : 0;
        const low = lowObj ? parseFloat(lowObj.state) || 0 : 0;
        let status = 'green';
        if (!hasTemp) status = 'gray';
        else if (low > 0 && temp <= low) status = 'blue';
        else if (high > 0 && temp >= high) status = 'red';
        else if (high > 0 && offset > 0 && high - offset <= temp && temp < high) status = 'amber';
        if (status !== row.status) {
          row.els.row.classList.remove('st-' + row.status);
          row.els.row.classList.add('st-' + status);
          row.status = status;
        }

        // ---- progress bar (temp as % of high target) ----
        if (high > 0 && hasTemp) {
          const pct = Math.max(0, Math.min(100, (temp / high) * 100));
          row.els.fill.style.width = pct.toFixed(1) + '%';
          if (row.els.bar.style.display !== '') row.els.bar.style.display = '';
        } else if (row.els.bar.style.display !== 'none') {
          row.els.bar.style.display = 'none';
        }
      }

      this._hint.style.display = helpersMissing ? '' : 'none';
      this._refreshAgo();
    }

    /* ------------------------------------------------------------------ */
    /* Relative "updated Xs ago" labels                                    */
    /* ------------------------------------------------------------------ */

    _refreshAgo() {
      if (!this._built) return;
      const now = Date.now();
      for (const row of this._rows) {
        let text = '';
        if (row.entityMissing) {
          text = 'entity not found';
        } else if (row.lastUpdated !== null && Number.isFinite(row.lastUpdated)) {
          const s = Math.max(0, Math.floor((now - row.lastUpdated) / 1000));
          let rel;
          if (s < 60) rel = s + 's';
          else if (s < 3600) rel = Math.floor(s / 60) + 'm';
          else rel = Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
          text = 'updated ' + rel + ' ago';
        }
        if (row.els.ago.textContent !== text) row.els.ago.textContent = text;
      }
    }
  }

  /* ====================================================================== */
  /* Visual config editor — lets you configure the card with form fields    */
  /* in the dashboard UI instead of typing YAML. Returned by the card's     */
  /* static getConfigElement().                                             */
  /* ====================================================================== */

  const EDITOR_CSS = `
    :host { display: block; }
    .ed { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: .9em; color: var(--secondary-text-color); }
    input, select {
      font: inherit; color: var(--primary-text-color);
      background: var(--secondary-background-color, var(--card-background-color, #fff));
      border: 1px solid var(--divider-color, rgba(127,127,127,.4));
      border-radius: 6px; min-height: 38px; padding: 0 8px; box-sizing: border-box;
    }
    input:focus, select:focus { outline: none; border-color: var(--primary-color, #03a9f4); }
    .section-title { font-weight: 600; color: var(--primary-text-color); margin-top: 4px; }
    .probes { display: flex; flex-direction: column; gap: 8px; }
    .prow { display: flex; align-items: center; gap: 8px; }
    .prow .pent { flex: 1 1 auto; min-width: 0; }
    .prow .pnum { flex: 0 0 70px; }
    .row-num-label { font-size: .85em; color: var(--secondary-text-color); flex: 0 0 auto; }
    .prm {
      flex: 0 0 auto; font: inherit; cursor: pointer; min-width: 38px; min-height: 38px;
      border-radius: 6px; border: 1px solid var(--divider-color, rgba(127,127,127,.4));
      background: none; color: var(--secondary-text-color);
    }
    .prm:hover { color: var(--error-color, #db4437); border-color: var(--error-color, #db4437); }
    .add {
      align-self: flex-start; font: inherit; cursor: pointer; min-height: 38px; padding: 0 14px;
      border-radius: 6px; border: 1px solid var(--primary-color, #03a9f4);
      background: none; color: var(--primary-color, #03a9f4);
    }
    .add:disabled { opacity: .4; cursor: default; }
    .help { font-size: .8em; color: var(--secondary-text-color); margin: 0; }
  `;

  class GoveeBBQCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = { type: 'custom:govee-bbq-card', title: '', probes: [] };
      this._hass = null;
      this._built = false;
      this._datalistKey = null;
    }

    setConfig(config) {
      this._config = {
        type: (config && config.type) || 'custom:govee-bbq-card',
        title: (config && config.title) || '',
        probes:
          config && Array.isArray(config.probes)
            ? config.probes.map((p) => ({
                entity: (p && p.entity) || '',
                number: p && Number.isInteger(p.number) ? p.number : 1,
              }))
            : [],
      };
      if (!this._built) {
        this._buildEditor();
      } else if (!this.shadowRoot.contains(this.shadowRoot.activeElement)) {
        // External edit (e.g. the raw-YAML tab) while we're not typing here.
        this._renderProbes();
        if (this._titleInput) this._titleInput.value = this._config.title;
      }
    }

    set hass(hass) {
      this._hass = hass;
      this._fillDatalist();
    }

    _buildEditor() {
      const root = this.shadowRoot;
      root.innerHTML = '';
      const style = document.createElement('style');
      style.textContent = EDITOR_CSS;

      const ed = el('div', 'ed');

      // -- card title --
      const titleLabel = el('label', null, 'Card title (optional)');
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.placeholder = 'e.g. Smoker';
      titleInput.value = this._config.title || '';
      titleInput.addEventListener('input', () => {
        this._config.title = titleInput.value;
        this._emit();
      });
      titleLabel.append(titleInput);
      this._titleInput = titleInput;

      // -- probes --
      const secTitle = el('div', 'section-title', 'Probes');
      const probesWrap = el('div', 'probes');
      this._probesWrap = probesWrap;

      const add = el('button', 'add', '+ Add probe');
      add.type = 'button';
      add.addEventListener('click', () => {
        if (this._config.probes.length >= 6) return;
        const used = new Set(this._config.probes.map((p) => p.number));
        let next = 1;
        while (used.has(next) && next < 6) next++;
        this._config.probes.push({ entity: '', number: next });
        this._renderProbes();
        this._emit();
      });
      this._addBtn = add;

      const help = el(
        'p',
        'help',
        'Each probe links to its bbq_probe_N_* helpers by its number (match the physical probe port). ' +
          'Start typing in the entity box to pick from your sensors. List only the probes you use; 1–6.'
      );

      // Shared autocomplete list of sensor entity ids.
      const datalist = document.createElement('datalist');
      datalist.id = 'bbq-sensor-list';
      this._datalist = datalist;

      ed.append(titleLabel, secTitle, probesWrap, add, help, datalist);
      root.append(style, ed);
      this._built = true;
      this._renderProbes();
      this._fillDatalist();
    }

    _renderProbes() {
      const wrap = this._probesWrap;
      if (!wrap) return;
      wrap.innerHTML = '';
      this._config.probes.forEach((probe, idx) => {
        const rowEl = el('div', 'prow');

        rowEl.append(el('span', 'row-num-label', 'Probe'));

        const num = document.createElement('select');
        num.className = 'pnum';
        for (let n = 1; n <= 6; n++) num.append(new Option(String(n), String(n)));
        num.value = String(probe.number);
        num.addEventListener('change', () => {
          this._config.probes[idx].number = Number(num.value);
          this._emit();
        });

        const ent = document.createElement('input');
        ent.type = 'text';
        ent.className = 'pent';
        ent.placeholder = 'sensor.your_probe_temperature';
        ent.setAttribute('list', 'bbq-sensor-list');
        ent.value = probe.entity || '';
        ent.addEventListener('input', () => {
          this._config.probes[idx].entity = ent.value.trim();
          this._emit();
        });

        const rm = el('button', 'prm', '✕');
        rm.type = 'button';
        rm.title = 'Remove this probe';
        rm.addEventListener('click', () => {
          this._config.probes.splice(idx, 1);
          this._renderProbes();
          this._emit();
        });

        rowEl.append(num, ent, rm);
        wrap.append(rowEl);
      });
      if (this._addBtn) this._addBtn.disabled = this._config.probes.length >= 6;
    }

    _fillDatalist() {
      if (!this._datalist || !this._hass) return;
      const ids = Object.keys(this._hass.states)
        .filter((id) => id.startsWith('sensor.'))
        .sort((a, b) => {
          // Float likely probe sensors to the top of the suggestions.
          const pa = /probe|h5055|temp/i.test(a) ? 0 : 1;
          const pb = /probe|h5055|temp/i.test(b) ? 0 : 1;
          return pa - pb || a.localeCompare(b);
        });
      const key = ids.join('|');
      if (this._datalistKey === key) return; // unchanged, skip rebuild
      this._datalistKey = key;
      this._datalist.innerHTML = '';
      for (const id of ids) this._datalist.append(new Option(id, id));
    }

    _emit() {
      const out = { type: this._config.type || 'custom:govee-bbq-card' };
      if (this._config.title && this._config.title.trim()) out.title = this._config.title.trim();
      out.probes = this._config.probes.map((p) => ({
        entity: p.entity || '',
        number: Number(p.number) || 1,
      }));
      this.dispatchEvent(
        new CustomEvent('config-changed', {
          detail: { config: out },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  if (!customElements.get('govee-bbq-card-editor')) {
    customElements.define('govee-bbq-card-editor', GoveeBBQCardEditor);
  }

  if (!customElements.get('govee-bbq-card')) {
    customElements.define('govee-bbq-card', GoveeBBQCard);
  }

  // Register with the dashboard card picker (search "Govee BBQ").
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === 'govee-bbq-card')) {
    window.customCards.push({
      type: 'govee-bbq-card',
      name: 'Govee BBQ Card',
      description:
        '6-probe dashboard card for the Govee H5055 BBQ thermometer: probe names, ' +
        'big temperatures, high/low targets, presets, alert bells, and the global ' +
        'approach offset (pairs with the govee_bbq.yaml package).',
      preview: false,
    });
  }

  console.info(
    `%c GOVEE-BBQ-CARD %c v${CARD_VERSION} `,
    'background:#b71c1c;color:#fff;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px;',
    'background:#37474f;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0;'
  );
})();
