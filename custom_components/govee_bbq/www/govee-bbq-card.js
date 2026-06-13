/* ============================================================================
 * govee-bbq-card.js — dashboard card for the Govee BBQ Alarms integration
 * ============================================================================
 * Bundled with the integration and registered automatically — you normally do
 * NOT add this as a Lovelace resource yourself. Just add a card of type
 * "custom:govee-bbq-card" (it auto-discovers your BBQ device).
 *
 * The card reads ONE entity: the integration's hub sensor (sensor.<name>),
 * whose attributes carry the full probe list, presets, battery, and notify
 * targets. It never hard-codes entity ids.
 *
 * Card options (all optional):
 *   entity            hub sensor id (omit to auto-detect)
 *   title             card header text
 *   hide_unavailable  hide probes with no live signal
 *   show_battery      show the device battery on each probe
 * ========================================================================= */
(() => {
  'use strict';

  const CARD_VERSION = '2.1.0';
  const HUB_ATTR = 'govee_bbq_hub';
  const FALLBACK_CATEGORIES = ['Beef', 'Poultry', 'Fish', 'Pork', 'Other'];

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

  const BATT_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" ' +
    'd="M16.67,4H15V2H9v2H7.33C6.6,4 6,4.6 6,5.33v15.33C6,21.4 6.6,22 7.33,22h9.34' +
    'C17.4,22 18,21.4 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z"/></svg>';

  const CARET_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7,10L12,15L17,10H7Z"/></svg>';

  const CSS = `
    :host { display: block; }
    ha-card { overflow: hidden; }
    .wrap { padding: 4px 0 10px; }
    .rows { display: flex; flex-direction: column; gap: 10px; padding: 10px 12px 2px; }
    button { font: inherit; color: inherit; background: none; border: none; padding: 0;
      margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    button:focus-visible, select:focus-visible, input:focus-visible {
      outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px; }

    /* ---- probe card-in-card ---- */
    .probe-card {
      --probe-color: var(--disabled-text-color, #9e9e9e);
      border: 1px solid var(--divider-color, rgba(127,127,127,.25));
      border-left: 4px solid var(--probe-color);
      border-radius: 12px; padding: 8px 12px 10px;
      background: var(--ha-card-background, var(--card-background-color, #fff));
      box-shadow: 0 1px 2px rgba(0,0,0,.08); transition: border-color .3s ease;
    }
    .st-gray  { --probe-color: var(--disabled-text-color, #9e9e9e); }
    .st-green { --probe-color: var(--success-color, #43a047); }
    .st-blue  { --probe-color: var(--info-color, #2196f3); }
    .st-amber { --probe-color: var(--warning-color, #ffa600); }
    .st-red   { --probe-color: var(--error-color, #db4437); }

    .pc-head { display: flex; align-items: center; gap: 8px; }
    .pc-name { text-align: left; font-weight: 600; font-size: 1.02em;
      color: var(--primary-text-color); min-height: 30px; padding: 0 4px; flex: 1 1 auto;
      border-radius: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pc-name:hover { background: rgba(127,127,127,.12); }
    .pc-head-right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
    .ago { font-size: .72em; color: var(--secondary-text-color); white-space: nowrap; }

    .batt { display: inline-flex; align-items: center; gap: 2px; font-size: .74em;
      font-weight: 600; font-variant-numeric: tabular-nums; color: var(--secondary-text-color);
      border: 1px solid var(--divider-color, rgba(127,127,127,.3)); border-radius: 10px;
      padding: 1px 7px 1px 4px; }
    .batt svg { width: 13px; height: 13px; display: block; }
    .batt.low { color: var(--warning-color, #ffa600); border-color: var(--warning-color, #ffa600); }
    .batt.crit { color: var(--error-color, #db4437); border-color: var(--error-color, #db4437); }

    .pc-body { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px;
      width: 100%; text-align: left; padding: 6px 4px 4px; border-radius: 10px; }
    .pc-body:hover { background: rgba(127,127,127,.08); }
    .pc-current { display: flex; flex-direction: column; min-width: 0; }
    .pc-clabel, .pc-alabel { font-size: .66em; text-transform: uppercase; letter-spacing: .07em;
      color: var(--secondary-text-color); }
    .pc-temp-row { display: flex; align-items: baseline; color: var(--probe-color);
      transition: color .3s ease; }
    .pc-temp { font-size: 2.7em; font-weight: 700; line-height: 1.05; font-variant-numeric: tabular-nums; }
    .pc-unit { font-size: 1.1em; margin-left: 2px; opacity: .8; }
    .pc-body.nosignal .pc-temp-row { color: var(--disabled-text-color, #9e9e9e); }
    .pc-body.nosignal .pc-temp { font-weight: 400; opacity: .6; }
    .st-red .pc-temp { animation: bbq-pulse 1.6s ease-in-out infinite; }
    @keyframes bbq-pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
    .pc-alarm { display: flex; flex-direction: column; align-items: flex-end; text-align: right; flex: 0 0 auto; }
    .pc-aval { font-size: 1.05em; font-weight: 600; color: var(--primary-text-color);
      font-variant-numeric: tabular-nums; }
    .pc-aval.off { color: var(--secondary-text-color); font-weight: 500; }

    .pc-tools { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
    .bell { min-width: 34px; min-height: 34px; display: inline-flex; align-items: center;
      justify-content: center; border-radius: 50%; color: var(--disabled-text-color, #9e9e9e); }
    .bell:hover { background: rgba(127,127,127,.12); }
    .bell.armed { color: var(--accent-color, #ff9800); }
    .bell svg { width: 21px; height: 21px; display: block; }
    .bell .strike { display: none; }
    .bell:not(.armed) .strike { display: initial; }
    .pc-edit { display: inline-flex; align-items: center; gap: 2px; margin-left: auto;
      font-size: .82em; color: var(--secondary-text-color); border-radius: 16px;
      padding: 5px 6px 5px 11px; border: 1px solid var(--divider-color, rgba(127,127,127,.3)); }
    .pc-edit:hover { background: rgba(127,127,127,.1); }
    .pc-edit svg { width: 16px; height: 16px; transition: transform .2s ease; }
    .pc-edit.open svg { transform: rotate(180deg); }

    .pc-expand { display: none; align-items: center; gap: 8px; flex-wrap: wrap;
      margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--divider-color, rgba(127,127,127,.3)); }
    .pc-expand.open { display: flex; }

    /* ---- stepper chip ---- */
    .chip { display: inline-flex; align-items: center; min-height: 34px;
      border: 1px solid var(--divider-color, rgba(127,127,127,.35)); border-radius: 18px; overflow: hidden; }
    .chip-label { font-size: .66em; text-transform: uppercase; letter-spacing: .06em;
      color: var(--secondary-text-color); padding: 0 2px 0 10px; }
    .step { min-width: 34px; min-height: 34px; font-size: 1.15em; color: var(--secondary-text-color); }
    .step:hover, .chip-val:hover { background: rgba(127,127,127,.12); }
    .chip-val { min-width: 44px; min-height: 34px; padding: 0 2px; text-align: center;
      font-weight: 600; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
    .chip-input { font: inherit; width: 60px; text-align: center; -moz-appearance: textfield;
      color: var(--primary-text-color); background: var(--card-background-color, transparent);
      border: 1px solid var(--primary-color, #03a9f4); border-radius: 6px; min-height: 30px; box-sizing: border-box; }
    .chip-input::-webkit-outer-spin-button, .chip-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

    select.preset { min-height: 34px; max-width: 150px; font: inherit; font-size: .9em;
      border: 1px solid var(--divider-color, rgba(127,127,127,.35)); border-radius: 18px;
      background: var(--card-background-color, transparent); color: var(--primary-text-color);
      padding: 0 8px; cursor: pointer; }
    select.preset:disabled { opacity: .4; cursor: default; }

    .name-input { font: inherit; font-weight: 600; font-size: 1.02em; width: 150px;
      color: var(--primary-text-color); background: var(--card-background-color, transparent);
      border: 1px solid var(--primary-color, #03a9f4); border-radius: 6px; min-height: 30px;
      padding: 0 6px; box-sizing: border-box; }

    .bar { height: 4px; border-radius: 2px; margin: 8px 0 0; overflow: hidden;
      background: var(--divider-color, rgba(127,127,127,.25)); }
    .fill { height: 100%; width: 0%; border-radius: 2px; background: var(--probe-color);
      transition: width .4s ease, background-color .3s ease; }

    /* ---- footer ---- */
    .foot { padding: 12px 16px 2px; border-top: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
    .foot-row { display: flex; align-items: center; gap: 10px; }
    .foot-label { font-size: .85em; color: var(--secondary-text-color); }
    .foot-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; font-size: .85em;
      border-radius: 18px; padding: 0 14px; color: var(--primary-text-color);
      border: 1px solid var(--divider-color, rgba(127,127,127,.4)); }
    .pill:hover { background: rgba(127,127,127,.1); border-color: var(--primary-color, #03a9f4); }
    .pill .ico { font-size: 1.05em; line-height: 1; }
    .hint { padding: 14px 16px; font-size: .9em; color: var(--warning-color, #ffa600); }

    /* ---- modal ---- */
    .overlay { position: fixed; inset: 0; z-index: 9; display: none; align-items: center;
      justify-content: center; background: rgba(0,0,0,.45); padding: 16px; box-sizing: border-box; }
    .overlay.open { display: flex; }
    .modal { width: 100%; max-width: 420px; max-height: 88vh; overflow: auto;
      background: var(--ha-card-background, var(--card-background-color, #fff));
      color: var(--primary-text-color); border-radius: 16px; padding: 16px 18px 18px;
      box-shadow: 0 10px 40px rgba(0,0,0,.4); }
    .modal-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .modal-title { font-size: 1.1em; font-weight: 700; flex: 1 1 auto;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .modal-close { min-width: 34px; min-height: 34px; border-radius: 50%; font-size: 1.2em;
      color: var(--secondary-text-color); display: inline-flex; align-items: center; justify-content: center; }
    .modal-close:hover { background: rgba(127,127,127,.15); }
    .modal-temp { color: var(--probe-color); display: flex; align-items: baseline; gap: 2px; margin: 2px 0 2px; }
    .modal-temp .pc-temp { font-size: 2.4em; }
    .modal-sub { font-size: .8em; color: var(--secondary-text-color); margin-bottom: 12px;
      display: flex; gap: 12px; flex-wrap: wrap; }
    .modal-section { margin-top: 14px; }
    .modal-stitle { font-size: .7em; text-transform: uppercase; letter-spacing: .07em;
      color: var(--secondary-text-color); margin-bottom: 6px; }
    .modal-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .modal-arm { display: flex; align-items: center; gap: 8px; }
    .arm-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px;
      border-radius: 18px; border: 1px solid var(--divider-color, rgba(127,127,127,.4)); font-size: .9em; }
    .arm-btn.armed { border-color: var(--accent-color, #ff9800); color: var(--accent-color, #ff9800); }
    .arm-btn .bell { min-width: 22px; min-height: 22px; }
    .arm-btn .bell svg { width: 18px; height: 18px; }

    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; font-size: .85em;
      color: var(--secondary-text-color); }
    .field input, .field select { font: inherit; color: var(--primary-text-color);
      background: var(--secondary-background-color, var(--card-background-color, #fff));
      border: 1px solid var(--divider-color, rgba(127,127,127,.4)); border-radius: 8px;
      min-height: 38px; padding: 0 10px; box-sizing: border-box; }
    .field-row { display: flex; gap: 10px; }
    .field-row .field { flex: 1 1 0; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .btn { min-height: 38px; padding: 0 16px; border-radius: 8px; font-size: .9em; font-weight: 600; }
    .btn.primary { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
    .btn.ghost { color: var(--secondary-text-color); border: 1px solid var(--divider-color, rgba(127,127,127,.4)); }
    .check-row { display: flex; align-items: center; gap: 10px; padding: 8px 4px;
      border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.18)); }
    .check-row input { width: 20px; height: 20px; }
    .check-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty { font-size: .85em; color: var(--secondary-text-color); padding: 8px 2px; }
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
      this._modalUpdater = null;
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
    _hubAttr(key, fallback) {
      const hub = this._hubState();
      const v = hub && hub.attributes ? hub.attributes[key] : undefined;
      return v === undefined ? fallback : v;
    }

    /* ---- build the static shell once ---- */
    _build() {
      const root = this.shadowRoot;
      root.innerHTML = '';
      this._rows = [];
      this._rowCount = -1;
      this._modalUpdater = null;

      const style = document.createElement('style');
      style.textContent = CSS;

      const card = document.createElement('ha-card');
      if (this._config.title) card.header = this._config.title;

      this._wrap = el('div', 'wrap');
      this._rowsHost = el('div', 'rows');
      this._wrap.append(this._rowsHost);

      // footer: approach offset + action pills
      this._foot = el('div', 'foot');
      const footRow = el('div', 'foot-row');
      footRow.append(el('span', 'foot-label', 'Approach alert'));
      this._offsetChip = this._buildChip('Offset', 1, 0, 50);
      footRow.append(this._offsetChip.root);
      this._foot.append(footRow);

      const pills = el('div', 'foot-pills');
      const notifyPill = el('button', 'pill');
      notifyPill.type = 'button';
      notifyPill.append(el('span', 'ico', '🔔'), el('span', null, 'Notifications'));
      notifyPill.addEventListener('click', () => this._openNotifyModal());
      const presetPill = el('button', 'pill');
      presetPill.type = 'button';
      presetPill.append(el('span', 'ico', '＋'), el('span', null, 'New preset'));
      presetPill.addEventListener('click', () => this._openNewPresetModal());
      pills.append(notifyPill, presetPill);
      this._foot.append(pills);
      this._wrap.append(this._foot);

      this._hint = el('div', 'hint', '');
      this._hint.style.display = 'none';
      this._wrap.append(this._hint);

      card.append(this._wrap);

      // modal overlay (sibling of the card so it isn't clipped)
      this._overlay = el('div', 'overlay');
      this._overlay.addEventListener('click', (e) => {
        if (e.target === this._overlay) this._closeModal();
      });
      this._overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          this._closeModal();
        }
      });
      this._modalPanel = el('div', 'modal');
      this._overlay.append(this._modalPanel);

      root.append(style, card, this._overlay);
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

      const allProbes = Array.isArray(hub.attributes.probes) ? hub.attributes.probes : [];
      const presets = Array.isArray(hub.attributes.presets) ? hub.attributes.presets : [];
      const categories = Array.isArray(hub.attributes.preset_categories)
        ? hub.attributes.preset_categories
        : FALLBACK_CATEGORIES;
      const probes = this._config.hide_unavailable
        ? allProbes.filter((p) => p.available)
        : allProbes;

      const ctx = {
        presets,
        categories,
        showBattery: !!this._config.show_battery,
        battery: hub.attributes.battery,
      };

      if (probes.length !== this._rowCount) {
        this._rowsHost.innerHTML = '';
        this._rows = [];
        for (let i = 0; i < probes.length; i++) this._rows.push(this._buildRow());
        this._rowCount = probes.length;
      }
      for (let i = 0; i < probes.length; i++) this._rows[i].update(probes[i], ctx);

      this._offsetChip.update({
        value: hub.attributes.approach_offset,
        entityId: hub.attributes.approach_offset_entity,
      });

      if (this._modalUpdater) this._modalUpdater();
      this._refreshAgo();
    }

    /* ---- alarm-target summary string for the probe card ---- */
    _alarmSummary(probe) {
      const unit = probe.unit || '°';
      const parts = [];
      if (probe.high > 0) parts.push('▲ ' + fmtNum(probe.high) + unit);
      if (probe.low > 0) parts.push('▼ ' + fmtNum(probe.low) + unit);
      return parts.length ? parts.join('  ') : null;
    }

    /* ---- one probe card ---- */
    _buildRow() {
      const card = this;
      const state = { probe: null, editingName: false };

      const rowEl = el('div', 'probe-card st-gray');

      // header: name + battery + ago
      const head = el('div', 'pc-head');
      const name = el('button', 'pc-name', 'Probe');
      name.type = 'button';
      name.title = 'Click to rename';
      name.addEventListener('click', () => card._beginNameEdit(state, name));
      const headRight = el('div', 'pc-head-right');
      const batt = card._buildBattery();
      const ago = el('div', 'ago', '');
      headRight.append(batt.root, ago);
      head.append(name, headRight);

      // body: big current temp + alarm summary, opens the detail modal.
      // A div (not a button) so the flex children nest as valid HTML.
      const body = el('div', 'pc-body nosignal');
      body.setAttribute('role', 'button');
      body.setAttribute('tabindex', '0');
      body.title = 'Tap for details and controls';
      const current = el('div', 'pc-current');
      current.append(el('div', 'pc-clabel', 'Current temperature'));
      const tempRow = el('div', 'pc-temp-row');
      const temp = el('span', 'pc-temp', '—');
      const unit = el('span', 'pc-unit', '');
      tempRow.append(temp, unit);
      current.append(tempRow);
      const alarm = el('div', 'pc-alarm');
      alarm.append(el('div', 'pc-alabel', 'Alarm Preset'));
      const aval = el('div', 'pc-aval off', 'Not set');
      alarm.append(aval);
      body.append(current, alarm);
      const openDetails = () => {
        if (state.probe) card._openProbeModal(state.probe.probe);
      };
      body.addEventListener('click', openDetails);
      body.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openDetails();
        }
      });

      // tools: arm bell + "edit alarm" inline toggle
      const tools = el('div', 'pc-tools');
      const bell = el('button', 'bell');
      bell.type = 'button';
      bell.title = 'Toggle alerts for this probe';
      bell.innerHTML = BELL_SVG;
      bell.addEventListener('click', () => {
        if (state.probe && state.probe.arm_entity) {
          card._hass.callService('switch', 'toggle', { entity_id: state.probe.arm_entity });
        }
      });
      const edit = el('button', 'pc-edit');
      edit.type = 'button';
      edit.append(el('span', null, 'Edit alarm'));
      edit.insertAdjacentHTML('beforeend', CARET_SVG);
      tools.append(bell, edit);

      const bar = el('div', 'bar');
      bar.style.display = 'none';
      const fill = el('div', 'fill');
      bar.append(fill);

      // inline "edit alarm" dropdown: low/high steppers + preset picker
      const expand = el('div', 'pc-expand');
      const lowChip = card._buildChip('Low', 5, 0, 600);
      const highChip = card._buildChip('High', 5, 0, 600);
      const preset = card._buildPresetSelect((presetName) => {
        if (state.probe) card._applyPreset(state.probe, presetName);
      });
      expand.append(lowChip.root, highChip.root, preset.root);
      edit.addEventListener('click', () => {
        const open = expand.classList.toggle('open');
        edit.classList.toggle('open', open);
      });

      rowEl.append(head, body, tools, bar, expand);
      this._rowsHost.append(rowEl);

      const row = {
        state,
        els: { rowEl, name, ago, body, temp, unit, bell },
        update(probe, ctx) {
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
          body.classList.toggle('nosignal', !hasTemp);

          const summary = card._alarmSummary(probe);
          aval.textContent = summary || 'Not set';
          aval.classList.toggle('off', !summary);

          batt.update(ctx.showBattery ? ctx.battery : null);

          lowChip.update({ value: probe.low, entityId: probe.low_entity });
          highChip.update({ value: probe.high, entityId: probe.high_entity });
          preset.update(ctx.presets, ctx.categories);

          bell.classList.toggle('armed', !!probe.armed);
          bell.setAttribute('aria-pressed', probe.armed ? 'true' : 'false');

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

    /* ---- battery pill ---- */
    _buildBattery() {
      const root = el('span', 'batt');
      root.style.display = 'none';
      root.insertAdjacentHTML('beforeend', BATT_SVG);
      const txt = el('span', null, '');
      root.append(txt);
      return {
        root,
        update(level) {
          if (level == null || level === '' || Number.isNaN(Number(level))) {
            root.style.display = 'none';
            return;
          }
          const n = Math.round(Number(level));
          txt.textContent = n + '%';
          root.title = 'Device battery ' + n + '%';
          root.classList.toggle('low', n <= 20 && n > 10);
          root.classList.toggle('crit', n <= 10);
          root.style.display = '';
        },
      };
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

    /* ---- apply a preset's targets to a probe ---- */
    _applyPreset(probe, presetName) {
      if (!presetName) return;
      const list = this._hubAttr('presets', []);
      const p = Array.isArray(list) ? list.find((x) => x.name === presetName) : null;
      if (!p) return;
      if (probe.high_entity && Number(p.high) > 0) {
        this._hass.callService('number', 'set_value', { entity_id: probe.high_entity, value: Number(p.high) });
      }
      if (probe.low_entity && Number(p.low) > 0) {
        this._hass.callService('number', 'set_value', { entity_id: probe.low_entity, value: Number(p.low) });
      }
    }

    /* ---- a preset <select> grouped into category optgroups ---- */
    _buildPresetSelect(onPick) {
      const root = document.createElement('select');
      root.className = 'preset';
      root.title = 'Apply a preset to this probe';
      root.append(new Option('presets…', ''));
      let key = '';
      root.addEventListener('change', () => {
        const chosen = root.value;
        root.value = '';
        if (chosen) onPick(chosen);
      });
      const self = this;
      return {
        root,
        update(presets, categories) {
          if (self.shadowRoot.activeElement === root) return;
          const newKey = presets.map((p) => p.name + ':' + (p.category || '')).join('|');
          if (newKey !== key) {
            self._fillPresetSelect(root, presets, categories);
            key = newKey;
          }
          root.disabled = presets.length === 0;
        },
      };
    }

    _fillPresetSelect(select, presets, categories) {
      while (select.options.length) select.remove(0);
      select.append(new Option('presets…', ''));
      const order = Array.isArray(categories) && categories.length ? categories : FALLBACK_CATEGORIES;
      const groups = new Map();
      for (const p of presets) {
        const cat = p.category || 'Other';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(p);
      }
      const seen = new Set();
      const emit = (cat) => {
        const items = groups.get(cat);
        if (!items || !items.length) return;
        const og = document.createElement('optgroup');
        og.label = cat;
        for (const p of items) og.append(new Option(p.name, p.name));
        select.append(og);
        seen.add(cat);
      };
      for (const cat of order) emit(cat);
      for (const cat of groups.keys()) if (!seen.has(cat)) emit(cat);
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
          if (!s.editing) display(s.value);
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

    /* ================================================================== */
    /* Modals                                                              */
    /* ================================================================== */
    _openModal(builder) {
      this._modalPanel.innerHTML = '';
      this._modalUpdater = null;
      builder(this._modalPanel);
      this._overlay.classList.add('open');
      const focusable = this._modalPanel.querySelector('input, select, button');
      if (focusable) window.setTimeout(() => focusable.focus(), 0);
    }
    _closeModal() {
      this._overlay.classList.remove('open');
      this._modalPanel.innerHTML = '';
      this._modalUpdater = null;
    }
    _modalHead(panel, titleText) {
      const head = el('div', 'modal-head');
      const title = el('div', 'modal-title', titleText);
      const close = el('button', 'modal-close', '✕');
      close.type = 'button';
      close.title = 'Close';
      close.addEventListener('click', () => this._closeModal());
      head.append(title, close);
      panel.append(head);
      return title;
    }

    /* ---- probe detail + controls ---- */
    _openProbeModal(probeNum) {
      const card = this;
      this._openModal((panel) => {
        const findProbe = () => {
          const probes = card._hubAttr('probes', []);
          return (Array.isArray(probes) ? probes : []).find((p) => p.probe === probeNum) || null;
        };
        let probe = findProbe();
        if (!probe) {
          card._modalHead(panel, 'Probe ' + probeNum);
          panel.append(el('div', 'empty', 'This probe is no longer available.'));
          return;
        }

        const title = card._modalHead(panel, probe.name || 'Probe ' + probe.probe);

        const tempWrap = el('div', 'modal-temp');
        const temp = el('span', 'pc-temp', '—');
        const unit = el('span', 'pc-unit', '');
        tempWrap.append(temp, unit);
        panel.append(tempWrap);

        const sub = el('div', 'modal-sub');
        const battSpan = el('span', null, '');
        const agoSpan = el('div', 'ago', '');
        sub.append(battSpan, agoSpan);
        panel.append(sub);

        // arm toggle
        const armSec = el('div', 'modal-section');
        armSec.append(el('div', 'modal-stitle', 'Alerts'));
        const armBtn = el('button', 'arm-btn');
        armBtn.type = 'button';
        const armBell = el('span', 'bell');
        armBell.innerHTML = BELL_SVG;
        const armLbl = el('span', null, 'Alerts off');
        armBtn.append(armBell, armLbl);
        armBtn.addEventListener('click', () => {
          const p = findProbe();
          if (p && p.arm_entity) card._hass.callService('switch', 'toggle', { entity_id: p.arm_entity });
        });
        armSec.append(armBtn);
        panel.append(armSec);

        // targets
        const tSec = el('div', 'modal-section');
        tSec.append(el('div', 'modal-stitle', 'Targets'));
        const tCtl = el('div', 'modal-controls');
        const lowChip = card._buildChip('Low', 5, 0, 600);
        const highChip = card._buildChip('High', 5, 0, 600);
        tCtl.append(lowChip.root, highChip.root);
        tSec.append(tCtl);
        panel.append(tSec);

        // preset
        const pSec = el('div', 'modal-section');
        pSec.append(el('div', 'modal-stitle', 'Preset'));
        const pCtl = el('div', 'modal-controls');
        const presetSel = card._buildPresetSelect((presetName) => {
          const p = findProbe();
          if (p) card._applyPreset(p, presetName);
        });
        const newPresetBtn = el('button', 'pill');
        newPresetBtn.type = 'button';
        newPresetBtn.append(el('span', 'ico', '＋'), el('span', null, 'New preset'));
        newPresetBtn.addEventListener('click', () => card._openNewPresetModal());
        pCtl.append(presetSel.root, newPresetBtn);
        pSec.append(pCtl);
        panel.append(pSec);

        // editable name commits on blur/enter
        const renameSec = el('div', 'modal-section');
        const nameField = el('label', 'field', 'Probe name');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.maxLength = 30;
        nameInput.value = probe.name && probe.name.startsWith('Probe ') ? '' : probe.name || '';
        nameInput.placeholder = 'Probe ' + probe.probe;
        const commitName = () => {
          const p = findProbe();
          if (p && p.name_entity) {
            card._hass.callService('text', 'set_value', {
              entity_id: p.name_entity,
              value: nameInput.value.trim(),
            });
          }
        };
        nameInput.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            nameInput.blur();
          }
        });
        nameInput.addEventListener('blur', commitName);
        nameField.append(nameInput);
        renameSec.append(nameField);
        panel.append(renameSec);

        const applyProbe = () => {
          probe = findProbe();
          if (!probe) {
            card._closeModal();
            return;
          }
          if (card.shadowRoot.activeElement !== nameInput) {
            const label = probe.name || 'Probe ' + probe.probe;
            if (title.textContent !== label) title.textContent = label;
          }
          const hasTemp = probe.available && probe.temp != null;
          temp.textContent = hasTemp ? fmtNum(probe.temp) : '—';
          unit.textContent = hasTemp ? probe.unit || '°' : '';
          const cls = STATUS_CLASS[probe.status] || 'st-green';
          for (const c of Object.values(STATUS_CLASS)) tempWrap.classList.toggle(c, c === cls);
          tempWrap.classList.toggle('nosignal', !hasTemp);

          const battery = card._hubAttr('battery', null);
          battSpan.textContent =
            card._config.show_battery && battery != null ? 'Battery ' + Math.round(Number(battery)) + '%' : '';

          agoSpan.dataset.ts = probe.last_updated || '';
          agoSpan.dataset.missing = probe.available ? '' : '1';

          armBtn.classList.toggle('armed', !!probe.armed);
          armBell.classList.toggle('armed', !!probe.armed);
          armLbl.textContent = probe.armed ? 'Alerts on' : 'Alerts off';

          lowChip.update({ value: probe.low, entityId: probe.low_entity });
          highChip.update({ value: probe.high, entityId: probe.high_entity });
          presetSel.update(card._hubAttr('presets', []), card._hubAttr('preset_categories', FALLBACK_CATEGORIES));
        };
        card._modalUpdater = applyProbe;
        applyProbe();
        card._refreshAgo();
      });
    }

    /* ---- choose who gets notifications ---- */
    _openNotifyModal() {
      const card = this;
      this._openModal((panel) => {
        card._modalHead(panel, 'Who gets notified');
        const entryId = card._hubAttr('entry_id', null);
        const available = card._hubAttr('notify_available', []) || [];
        const selected = new Set(card._hubAttr('notify_selected', []) || []);

        const body = el('div', 'modal-section');
        const checks = [];
        if (!available.length) {
          body.append(
            el(
              'div',
              'empty',
              'No notify services found. Install and sign in to the Home Assistant Companion app on a phone, then reopen this.'
            )
          );
        } else {
          for (const svc of available) {
            const row = el('label', 'check-row');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = svc;
            cb.checked = selected.has(svc);
            row.append(cb, el('span', null, svc));
            body.append(row);
            checks.push(cb);
          }
        }
        panel.append(body);

        const actions = el('div', 'modal-actions');
        const cancel = el('button', 'btn ghost', 'Cancel');
        cancel.type = 'button';
        cancel.addEventListener('click', () => card._closeModal());
        const save = el('button', 'btn primary', 'Save');
        save.type = 'button';
        save.disabled = !available.length || !entryId;
        save.addEventListener('click', () => {
          const chosen = checks.filter((c) => c.checked).map((c) => c.value);
          card._hass.callService('govee_bbq', 'set_notify_services', {
            entry_id: entryId,
            notify_services: chosen,
          });
          card._closeModal();
        });
        actions.append(cancel, save);
        panel.append(actions);
      });
    }

    /* ---- create a new preset (name/high/low/category) ---- */
    _openNewPresetModal() {
      const card = this;
      this._openModal((panel) => {
        card._modalHead(panel, 'New preset');
        const entryId = card._hubAttr('entry_id', null);
        const categories = card._hubAttr('preset_categories', FALLBACK_CATEGORIES) || FALLBACK_CATEGORIES;

        const nameField = el('label', 'field', 'Name');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'e.g. Turkey (165)';
        nameInput.maxLength = 40;
        nameField.append(nameInput);

        const row = el('div', 'field-row');
        const highField = el('label', 'field', 'High target (0 = none)');
        const highInput = document.createElement('input');
        highInput.type = 'number';
        highInput.min = '0';
        highInput.max = '600';
        highInput.value = '0';
        highField.append(highInput);
        const lowField = el('label', 'field', 'Low target (0 = none)');
        const lowInput = document.createElement('input');
        lowInput.type = 'number';
        lowInput.min = '0';
        lowInput.max = '600';
        lowInput.value = '0';
        lowField.append(lowInput);
        row.append(highField, lowField);

        const catField = el('label', 'field', 'Category');
        const catSel = document.createElement('select');
        for (const c of categories) catSel.append(new Option(c, c));
        catField.append(catSel);

        const err = el('div', 'empty', '');
        err.style.color = 'var(--error-color, #db4437)';
        err.style.display = 'none';

        panel.append(nameField, row, catField, err);

        const actions = el('div', 'modal-actions');
        const cancel = el('button', 'btn ghost', 'Cancel');
        cancel.type = 'button';
        cancel.addEventListener('click', () => card._closeModal());
        const save = el('button', 'btn primary', 'Save preset');
        save.type = 'button';
        save.disabled = !entryId;
        save.addEventListener('click', () => {
          const name = nameInput.value.trim();
          if (!name) {
            err.textContent = 'Give the preset a name.';
            err.style.display = '';
            nameInput.focus();
            return;
          }
          card._hass.callService('govee_bbq', 'add_preset', {
            entry_id: entryId,
            name,
            high: Number(highInput.value) || 0,
            low: Number(lowInput.value) || 0,
            category: catSel.value,
          });
          card._closeModal();
        });
        actions.append(cancel, save);
        panel.append(actions);
      });
    }

    _refreshAgo() {
      if (!this._built) return;
      const now = Date.now();
      const agos = [];
      for (const row of this._rows) agos.push(row.els.ago);
      if (this._overlay && this._overlay.classList.contains('open')) {
        const modalAgo = this._modalPanel.querySelector('.ago');
        if (modalAgo) agos.push(modalAgo);
      }
      for (const ago of agos) {
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
  /* Visual config editor: hub entity, title, and display toggles           */
  /* ====================================================================== */
  const EDITOR_CSS = `
    :host { display: block; }
    .ed { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: .9em; color: var(--secondary-text-color); }
    input[type=text], select { font: inherit; color: var(--primary-text-color);
      background: var(--secondary-background-color, var(--card-background-color, #fff));
      border: 1px solid var(--divider-color, rgba(127,127,127,.4)); border-radius: 6px;
      min-height: 38px; padding: 0 8px; box-sizing: border-box; }
    .toggle { flex-direction: row; align-items: center; gap: 10px; cursor: pointer; }
    .toggle input { width: 20px; height: 20px; }
    .toggle span { color: var(--primary-text-color); }
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

      this._hideToggle = this._toggle('Hide unavailable probes', 'hide_unavailable');
      this._battToggle = this._toggle('Show battery level', 'show_battery');

      ed.append(titleLabel, entLabel, help, this._hideToggle.root, this._battToggle.root);
      root.append(style, ed);
      this._built = true;
      this._fillEntities();
    }
    _toggle(text, key) {
      const root = el('label', 'toggle');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!this._config[key];
      cb.addEventListener('change', () => {
        this._config[key] = cb.checked;
        this._emit();
      });
      root.append(cb, el('span', null, text));
      return { root, cb, key };
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
      if (this._hideToggle) this._hideToggle.cb.checked = !!this._config.hide_unavailable;
      if (this._battToggle) this._battToggle.cb.checked = !!this._config.show_battery;
      this._fillEntities();
    }
    _emit() {
      const out = { type: this._config.type || 'custom:govee-bbq-card' };
      if (this._config.title && this._config.title.trim()) out.title = this._config.title.trim();
      if (this._config.entity) out.entity = this._config.entity;
      if (this._config.hide_unavailable) out.hide_unavailable = true;
      if (this._config.show_battery) out.show_battery = true;
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
      description: 'Probe names, temperatures, targets, presets, battery, and alert bells for the Govee BBQ Alarms integration.',
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
