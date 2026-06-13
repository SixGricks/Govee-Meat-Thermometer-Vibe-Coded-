/* ============================================================================
 * govee-bbq-card.js — dashboard card for the Govee BBQ Alarms integration
 * ============================================================================
 * Bundled with the integration and registered automatically — you normally do
 * NOT add this as a Lovelace resource yourself. Just add a card of type
 * "custom:govee-bbq-card" (it auto-discovers your BBQ device).
 *
 * The card reads ONE entity: the integration's hub sensor (sensor.<name>),
 * whose attributes carry the full probe list + the entity_ids to act on. It
 * never hard-codes entity ids.
 * ========================================================================= */
(() => {
  'use strict';

  const CARD_VERSION = '2.0.0';
  const HUB_ATTR = 'govee_bbq_hub';

  const STATUS_CLASS = {
    unavailable: 'st-gray',
    ok: 'st-green',
    low: 'st-blue',
    approach: 'st-amber',
    high: 'st-red',
  };

  const BELL_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29' +
    'C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29' +
    'C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21"/>' +
    '<line class="strike" x1="3" y1="3" x2="21" y2="21" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round"/></svg>';

  const CSS = `
    :host { display: block; }
    ha-card { overflow: hidden; }
    .wrap { padding: 4px 0 10px; }
    .probe {
      --probe-color: var(--disabled-text-color, #9e9e9e);
      border-left: 4px solid var(--probe-color);
      padding: 10px 16px 12px 12px; transition: border-color .3s ease;
    }
    .probe + .probe { border-top: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
    .st-gray  { --probe-color: var(--disabled-text-color, #9e9e9e); }
    .st-green { --probe-color: var(--success-color, #43a047); }
    .st-blue  { --probe-color: var(--info-color, #2196f3); }
    .st-amber { --probe-color: var(--warning-color, #ffa600); }
    .st-red   { --probe-color: var(--error-color, #db4437); }
    .main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .left { display: flex; flex-direction: column; flex: 1 1 110px; min-width: 0; }
    button { font: inherit; color: inherit; background: none; border: none; padding: 0;
      margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    button:focus-visible, select:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px; }
    .name { text-align: left; font-weight: 600; font-size: 1.05em; color: var(--primary-text-color);
      min-height: 36px; padding: 0 4px; border-radius: 6px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    .name:hover { background: rgba(127,127,127,.12); }
    .ago { font-size: .72em; color: var(--secondary-text-color); padding-left: 4px; }
    .name-input, .chip-input { font: inherit; color: var(--primary-text-color);
      background: var(--card-background-color, transparent);
      border: 1px solid var(--primary-color, #03a9f4); border-radius: 6px;
      min-height: 32px; padding: 0 6px; box-sizing: border-box; }
    .name-input { font-weight: 600; font-size: 1.05em; width: 140px; }
    .chip-input { width: 64px; text-align: center; -moz-appearance: textfield; }
    .chip-input::-webkit-outer-spin-button, .chip-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .tempwrap { display: flex; align-items: baseline; justify-content: flex-end; min-width: 84px;
      color: var(--probe-color); transition: color .3s ease; }
    .temp { font-size: 2em; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .unit { font-size: .95em; margin-left: 2px; opacity: .8; }
    .tempwrap.nosignal { color: var(--disabled-text-color, #9e9e9e); }
    .tempwrap.nosignal .temp { font-weight: 400; opacity: .6; }
    .st-red .temp { animation: bbq-pulse 1.6s ease-in-out infinite; }
    @keyframes bbq-pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
    .controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .chip { display: inline-flex; align-items: center; min-height: 36px;
      border: 1px solid var(--divider-color, rgba(127,127,127,.35)); border-radius: 18px; overflow: hidden; }
    .chip-label { font-size: .68em; text-transform: uppercase; letter-spacing: .06em;
      color: var(--secondary-text-color); padding: 0 2px 0 10px; }
    .step { min-width: 36px; min-height: 36px; font-size: 1.15em; color: var(--secondary-text-color); }
    .step:hover, .chip-val:hover, .bell:hover { background: rgba(127,127,127,.12); }
    .chip-val { min-width: 44px; min-height: 36px; padding: 0 2px; text-align: center;
      font-weight: 600; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
    .bell { min-width: 36px; min-height: 36px; display: inline-flex; align-items: center;
      justify-content: center; border-radius: 50%; color: var(--disabled-text-color, #9e9e9e); }
    .bell.armed { color: var(--accent-color, #ff9800); }
    .bell svg { width: 22px; height: 22px; display: block; }
    .bell .strike { display: none; }
    .bell:not(.armed) .strike { display: initial; }
    select.preset { min-height: 36px; max-width: 130px; font: inherit; font-size: .9em;
      border: 1px solid var(--divider-color, rgba(127,127,127,.35)); border-radius: 18px;
      background: var(--card-background-color, transparent); color: var(--primary-text-color);
      padding: 0 8px; cursor: pointer; }
    select.preset:disabled { opacity: .4; cursor: default; }
    .bar { height: 4px; border-radius: 2px; margin: 8px 0 0; overflow: hidden;
      background: var(--divider-color, rgba(127,127,127,.25)); }
    .fill { height: 100%; width: 0%; border-radius: 2px; background: var(--probe-color);
      transition: width .4s ease, background-color .3s ease; }
    .foot { display: flex; align-items: center; gap: 10px; padding: 10px 16px 2px 16px;
      border-top: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
    .foot-label { font-size: .85em; color: var(--secondary-text-color); }
    .hint { padding: 14px 16px; font-size: .9em; color: var(--warning-color, #ffa600); }
  `;

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
      this._config = {};
      this._built = false;
      this._rows = [];
      this._rowCount = -1;
      this._timer = null;
    }

    static getConfigElement() {
      return document.createElement('govee-bbq-card-editor');
    }

    static getStubConfig(hass) {
      let entity = '';
      for (const id in (hass && hass.states) || {}) {
        const s = hass.states[id];
        if (s && s.attributes && s.attributes[HUB_ATTR]) {
          entity = id;
          break;
        }
      }
      return { entity };
    }

    setConfig(config) {
      this._config = config || {};
      this._built = false;
      this._rowCount = -1;
      if (this._hass) {
        this._build();
        this._update();
      }
    }

    getCardSize() {
      const hub = this._hubState();
      const n = hub && hub.attributes.probes ? hub.attributes.probes.length : 4;
      return 1 + n;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._built) this._build();
      this._update();
    }
    get hass() {
      return this._hass;
    }

    connectedCallback() {
      if (!this._timer) this._timer = window.setInterval(() => this._refreshAgo(), 30000);
      this._refreshAgo();
    }
    disconnectedCallback() {
      if (this._timer) {
        window.clearInterval(this._timer);
        this._timer = null;
      }
    }

    /* ---- locate the integration's hub sensor ---- */
    _hubEntityId() {
      if (this._config.entity) return this._config.entity;
      const states = (this._hass && this._hass.states) || {};
      for (const id in states) {
        const s = states[id];
        if (s && s.attributes && s.attributes[HUB_ATTR]) return id;
      }
      return null;
    }
    _hubState() {
      const id = this._hubEntityId();
      return id && this._hass ? this._hass.states[id] : null;
    }

    /* ---- build the static shell once ---- */
    _build() {
      const root = this.shadowRoot;
      root.innerHTML = '';
      this._rows = [];
      this._rowCount = -1;

      const style = document.createElement('style');
      style.textContent = CSS;

      const card = document.createElement('ha-card');
      if (this._config.title) card.header = this._config.title;

      this._wrap = el('div', 'wrap');
      this._rowsHost = el('div', 'rows');
      this._wrap.append(this._rowsHost);

      // footer: global approach offset
      this._foot = el('div', 'foot');
      this._foot.append(el('span', 'foot-label', 'Approach alert'));
      this._offsetChip = this._buildChip('Offset', 1, 0, 50);
      this._foot.append(this._offsetChip.root);
      this._wrap.append(this._foot);

      this._hint = el('div', 'hint', '');
      this._hint.style.display = 'none';
      this._wrap.append(this._hint);

      card.append(this._wrap);
      root.append(style, card);
      this._built = true;
    }

    _showHint(msg) {
      this._hint.textContent = msg;
      this._hint.style.display = msg ? '' : 'none';
      this._rowsHost.style.display = msg ? 'none' : '';
      this._foot.style.display = msg ? 'none' : '';
    }

    /* ---- per-update: read hub attributes, render rows ---- */
    _update() {
      if (!this._built || !this._hass) return;
      const hub = this._hubState();
      if (!hub) {
        this._showHint(
          'No Govee BBQ device found. Add the integration (Settings → Devices & Services → Add Integration → "Govee BBQ Alarms"), or set this card\'s entity to your BBQ hub sensor.'
        );
        return;
      }
      this._showHint('');

      const probes = Array.isArray(hub.attributes.probes) ? hub.attributes.probes : [];
      const presets = Array.isArray(hub.attributes.presets) ? hub.attributes.presets : [];

      if (probes.length !== this._rowCount) {
        this._rowsHost.innerHTML = '';
        this._rows = [];
        for (let i = 0; i < probes.length; i++) this._rows.push(this._buildRow());
        this._rowCount = probes.length;
      }
      for (let i = 0; i < probes.length; i++) this._rows[i].update(probes[i], presets);

      this._offsetChip.update({
        value: hub.attributes.approach_offset,
        entityId: hub.attributes.approach_offset_entity,
        available: hub.attributes.approach_offset_entity != null,
      });

      this._refreshAgo();
    }

    /* ---- one probe row ---- */
    _buildRow() {
      const card = this;
      const state = { probe: null, editingName: false };

      const rowEl = el('div', 'probe st-gray');
      const main = el('div', 'main');

      const left = el('div', 'left');
      const name = el('button', 'name', 'Probe');
      name.type = 'button';
      name.title = 'Click to rename';
      name.addEventListener('click', () => card._beginNameEdit(state, name));
      const ago = el('div', 'ago', '');
      left.append(name, ago);

      const tempWrap = el('div', 'tempwrap nosignal');
      const temp = el('span', 'temp', '—');
      const unit = el('span', 'unit', '');
      tempWrap.append(temp, unit);

      const controls = el('div', 'controls');
      const lowChip = this._buildChip('Low', 5, 0, 600);
      const highChip = this._buildChip('High', 5, 0, 600);

      const bell = el('button', 'bell');
      bell.type = 'button';
      bell.title = 'Toggle alerts for this probe';
      bell.innerHTML = BELL_SVG;
      bell.addEventListener('click', () => {
        if (state.probe && state.probe.arm_entity) {
          card._hass.callService('switch', 'toggle', { entity_id: state.probe.arm_entity });
        }
      });

      const preset = document.createElement('select');
      preset.className = 'preset';
      preset.title = 'Apply a preset to this probe';
      preset.append(new Option('presets…', ''));
      preset.addEventListener('change', () => {
        const chosen = preset.value;
        preset.value = '';
        if (!chosen || !state.probe) return;
        const hub = this._hubState();
        const list = hub && Array.isArray(hub.attributes.presets) ? hub.attributes.presets : [];
        const p = list.find((x) => x.name === chosen);
        if (!p) return;
        if (state.probe.high_entity && Number(p.high) > 0) {
          card._hass.callService('number', 'set_value', {
            entity_id: state.probe.high_entity,
            value: Number(p.high),
          });
        }
        if (state.probe.low_entity && Number(p.low) > 0) {
          card._hass.callService('number', 'set_value', {
            entity_id: state.probe.low_entity,
            value: Number(p.low),
          });
        }
      });

      controls.append(lowChip.root, highChip.root, bell, preset);
      main.append(left, tempWrap, controls);

      const bar = el('div', 'bar');
      bar.style.display = 'none';
      const fill = el('div', 'fill');
      bar.append(fill);

      rowEl.append(main, bar);
      this._rowsHost.append(rowEl);

      let presetKey = '';

      const row = {
        state,
        els: { rowEl, name, ago, tempWrap, temp, unit, bell, preset, bar, fill },
        update(probe, presets) {
          state.probe = probe;

          if (!state.editingName) {
            const label = probe.name || 'Probe ' + probe.probe;
            if (name.textContent !== label) name.textContent = label;
          }

          const hasTemp = probe.available && probe.temp != null;
          const tText = hasTemp ? fmtNum(probe.temp) : '—';
          if (temp.textContent !== tText) temp.textContent = tText;
          const uText = hasTemp ? probe.unit || '°' : '';
          if (unit.textContent !== uText) unit.textContent = uText;
          tempWrap.classList.toggle('nosignal', !hasTemp);

          lowChip.update({ value: probe.low, entityId: probe.low_entity, available: probe.low_entity != null });
          highChip.update({ value: probe.high, entityId: probe.high_entity, available: probe.high_entity != null });

          bell.classList.toggle('armed', !!probe.armed);
          bell.setAttribute('aria-pressed', probe.armed ? 'true' : 'false');

          if (card.shadowRoot.activeElement !== preset) {
            const key = presets.map((p) => p.name).join('|');
            if (key !== presetKey) {
              while (preset.options.length > 1) preset.remove(1);
              for (const p of presets) preset.append(new Option(p.name, p.name));
              presetKey = key;
            }
            preset.disabled = presets.length === 0;
          }

          const cls = STATUS_CLASS[probe.status] || 'st-green';
          for (const c of Object.values(STATUS_CLASS)) rowEl.classList.toggle(c, c === cls);

          if (probe.high > 0 && hasTemp) {
            const pct = Math.max(0, Math.min(100, (probe.temp / probe.high) * 100));
            fill.style.width = pct.toFixed(1) + '%';
            bar.style.display = '';
          } else {
            bar.style.display = 'none';
          }

          ago.dataset.ts = probe.last_updated || '';
          ago.dataset.missing = probe.available ? '' : '1';
        },
      };
      return row;
    }

    _beginNameEdit(state, nameBtn) {
      if (state.editingName || !state.probe || !state.probe.name_entity) return;
      state.editingName = true;
      const cur = state.probe.name && state.probe.name.startsWith('Probe ') ? '' : state.probe.name || '';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'name-input';
      input.maxLength = 30;
      input.value = cur;
      nameBtn.replaceWith(input);
      input.focus();
      input.select();
      let cancelled = false;
      const finish = (commit) => {
        if (!state.editingName) return;
        state.editingName = false;
        const value = input.value.trim();
        input.replaceWith(nameBtn);
        if (commit && state.probe && state.probe.name_entity) {
          this._hass.callService('text', 'set_value', { entity_id: state.probe.name_entity, value });
          nameBtn.textContent = value || 'Probe ' + state.probe.probe;
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

    /* ---- a -/value/+ stepper bound to a number entity ---- */
    _buildChip(label, step, min, max) {
      const card = this;
      const root = el('div', 'chip');
      if (label) root.append(el('span', 'chip-label', label));
      const minus = el('button', 'step', '−');
      minus.type = 'button';
      const val = el('button', 'chip-val', '?');
      val.type = 'button';
      val.title = 'Click to type a value (0 = off)';
      const plus = el('button', 'step', '+');
      plus.type = 'button';
      root.append(minus, val, plus);

      const s = { value: null, entityId: null, editing: false, pending: null, timer: null };

      const cur = () => (s.pending != null ? s.pending : s.value);
      const display = (v) => {
        val.textContent = v == null ? '?' : v <= 0 ? 'off' : fmtNum(v);
      };
      const save = (v) => {
        v = Math.min(max, Math.max(min, v));
        s.pending = v;
        if (s.timer) window.clearTimeout(s.timer);
        s.timer = window.setTimeout(() => {
          s.pending = null;
          s.timer = null;
          if (!s.editing) display(s.value); // snap back to the real value
        }, 5000);
        display(v);
        if (s.entityId) card._hass.callService('number', 'set_value', { entity_id: s.entityId, value: v });
      };

      minus.addEventListener('click', () => {
        const c = cur();
        if (c != null) save(c - step);
      });
      plus.addEventListener('click', () => {
        const c = cur();
        if (c != null) save(c + step);
      });
      val.addEventListener('click', () => {
        if (s.editing || s.entityId == null) return;
        s.editing = true;
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'chip-input';
        input.min = String(min);
        input.max = String(max);
        const c = cur();
        input.value = c == null ? '' : String(c);
        val.replaceWith(input);
        input.focus();
        input.select();
        let cancelled = false;
        const finish = (commit) => {
          if (!s.editing) return;
          s.editing = false;
          const raw = parseFloat(input.value);
          input.replaceWith(val);
          if (commit && Number.isFinite(raw)) save(raw);
          else display(cur());
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
      });

      return {
        root,
        get editing() {
          return s.editing;
        },
        update(data) {
          s.entityId = data.entityId || null;
          const v = data.value == null ? null : Number(data.value);
          if (s.editing) return;
          if (s.pending != null) {
            if (v != null && Math.abs(v - s.pending) < 0.001) {
              s.pending = null;
              if (s.timer) {
                window.clearTimeout(s.timer);
                s.timer = null;
              }
            } else {
              display(s.pending);
              s.value = v;
              return;
            }
          }
          s.value = v;
          display(v);
        },
      };
    }

    _refreshAgo() {
      if (!this._built) return;
      const now = Date.now();
      for (const row of this._rows) {
        const ago = row.els.ago;
        let text = '';
        if (ago.dataset.missing === '1') {
          text = 'no signal';
        } else if (ago.dataset.ts) {
          const t = Date.parse(ago.dataset.ts);
          if (Number.isFinite(t)) {
            const sec = Math.max(0, Math.floor((now - t) / 1000));
            let rel;
            if (sec < 60) rel = sec + 's';
            else if (sec < 3600) rel = Math.floor(sec / 60) + 'm';
            else rel = Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
            text = 'updated ' + rel + ' ago';
          }
        }
        if (ago.textContent !== text) ago.textContent = text;
      }
    }
  }

  /* ====================================================================== */
  /* Visual config editor: pick the hub entity + title (form, not YAML)     */
  /* ====================================================================== */
  const EDITOR_CSS = `
    :host { display: block; }
    .ed { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: .9em; color: var(--secondary-text-color); }
    input, select { font: inherit; color: var(--primary-text-color);
      background: var(--secondary-background-color, var(--card-background-color, #fff));
      border: 1px solid var(--divider-color, rgba(127,127,127,.4)); border-radius: 6px;
      min-height: 38px; padding: 0 8px; box-sizing: border-box; }
    .help { font-size: .8em; color: var(--secondary-text-color); margin: 0; }
  `;

  class GoveeBBQCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = {};
      this._hass = null;
      this._built = false;
    }
    setConfig(config) {
      this._config = Object.assign({ type: 'custom:govee-bbq-card' }, config || {});
      if (!this._built) this._buildEditor();
      else if (!this.shadowRoot.contains(this.shadowRoot.activeElement)) this._sync();
    }
    set hass(hass) {
      this._hass = hass;
      if (this._built) this._fillEntities();
    }
    _hubs() {
      const out = [];
      const states = (this._hass && this._hass.states) || {};
      for (const id in states) {
        const s = states[id];
        if (s && s.attributes && s.attributes[HUB_ATTR]) out.push(id);
      }
      return out.sort();
    }
    _buildEditor() {
      const root = this.shadowRoot;
      root.innerHTML = '';
      const style = document.createElement('style');
      style.textContent = EDITOR_CSS;
      const ed = el('div', 'ed');

      const titleLabel = el('label', null, 'Card title (optional)');
      const title = document.createElement('input');
      title.type = 'text';
      title.placeholder = 'e.g. Smoker';
      title.value = this._config.title || '';
      title.addEventListener('input', () => {
        this._config.title = title.value;
        this._emit();
      });
      titleLabel.append(title);
      this._titleInput = title;

      const entLabel = el('label', null, 'BBQ device (hub sensor)');
      const sel = document.createElement('select');
      sel.addEventListener('change', () => {
        this._config.entity = sel.value || undefined;
        this._emit();
      });
      entLabel.append(sel);
      this._entitySelect = sel;

      const help = el('p', 'help', 'Leave the device on "Auto-detect" unless you have more than one BBQ device.');

      ed.append(titleLabel, entLabel, help);
      root.append(style, ed);
      this._built = true;
      this._fillEntities();
    }
    _fillEntities() {
      if (!this._entitySelect) return;
      const sel = this._entitySelect;
      const cur = this._config.entity || '';
      sel.innerHTML = '';
      sel.append(new Option('Auto-detect', ''));
      for (const id of this._hubs()) sel.append(new Option(id, id));
      sel.value = cur;
    }
    _sync() {
      if (this._titleInput) this._titleInput.value = this._config.title || '';
      this._fillEntities();
    }
    _emit() {
      const out = { type: this._config.type || 'custom:govee-bbq-card' };
      if (this._config.title && this._config.title.trim()) out.title = this._config.title.trim();
      if (this._config.entity) out.entity = this._config.entity;
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: out }, bubbles: true, composed: true }));
    }
  }

  if (!customElements.get('govee-bbq-card-editor')) {
    customElements.define('govee-bbq-card-editor', GoveeBBQCardEditor);
  }
  if (!customElements.get('govee-bbq-card')) {
    customElements.define('govee-bbq-card', GoveeBBQCard);
  }

  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === 'govee-bbq-card')) {
    window.customCards.push({
      type: 'govee-bbq-card',
      name: 'Govee BBQ Card',
      description: 'Probe names, temperatures, targets, presets, and alert bells for the Govee BBQ Alarms integration.',
      preview: false,
      documentationURL: 'https://github.com/SixGricks/Govee-Meat-Thermometer-Vibe-Coded-',
    });
  }

  console.info(
    `%c GOVEE-BBQ-CARD %c v${CARD_VERSION} `,
    'background:#b71c1c;color:#fff;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px;',
    'background:#37474f;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0;'
  );
})();
