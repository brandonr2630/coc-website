/*!
 * atlas.js — offline, layered map of the Bible lands. Vanilla JS, no dependencies.
 *
 * ARCHITECTURE
 *   Atlas            owns the viewport (pan / zoom / pinch / keys), the layer stack, one shared
 *                    label placer, selection, events, and an optional layer-toggle panel.
 *   Layer            base class. Everything on the map is a Layer: the basemap pieces and every
 *                    overlay (places, routes, regions, ...). Layers never talk to each other;
 *                    they only talk to the Atlas they are mounted on.
 *   Two render spaces, picked per layer with `space`:
 *     'world'  → drawn in an SVG whose viewBox is the camera (vectors scale with the map; use
 *                vector-effect:non-scaling-stroke). Regions, routes, coast, relief, rivers.
 *     'screen' → drawn in an SVG of screen pixels above it (constant size at every zoom).
 *                Pins and text. update() repositions nodes on every view change.
 *   Stacking: world layers sorted by `order`, then screen layers sorted by `order`, then labels.
 *   Labels: layers never draw text. They return candidates from labels(ctx) and the Atlas places
 *   them all together, highest priority first, so labels never collide across layers.
 *
 * COORDINATES
 *   Layers are given (lon, lat). atlas.project(lon,lat) → [x,y] in "world units" (x = lon degrees,
 *   y = Web Mercator degrees, north is negative). ctx.toScreen(x,y) / ctx.toWorld(sx,sy) convert.
 *   ctx.view.s = screen pixels per world unit (≈ pixels per degree of longitude) = the zoom.
 *
 * WRITING A LAYER (the whole contract)
 *   class MyLayer extends Atlas.Layer {
 *     async mount(atlas) { /* build nodes into this.g, load data with atlas.load(url) *\/ }
 *     update(ctx)        { /* optional: reposition on view change *\/ }
 *     labels(ctx)        { return [{key,x,y,text,priority,r}] }   // x,y in screen px
 *     hit(ctx,sx,sy)     { return itemOrNull }                    // for taps / selection
 *     unmount()          { /* optional cleanup *\/ }
 *   }
 *   atlas.addLayer(new MyLayer('id', {name, group, order, space, minZoom, maxZoom, visible}))
 *
 * USAGE
 *   const atlas = new Atlas(hostEl, { base: '/' });        // adds the basemap layers
 *   atlas.addLayer(new Atlas.PointLayer('places', { items, kinds }));
 *   atlas.on('select', e => ...);  atlas.layerControl(panelEl);  atlas.fitBounds([w,s,e,n]);
 *
 * DATA FILES (relative to opts.base): atlas-basemap.json, atlas-relief.webp, atlas-relief-levant.webp
 * CREDITS TO SHOW: Natural Earth (public domain) · AWS Terrain Tiles / SRTM (relief) ·
 *   OpenBible.info Bible Geocoding Data, CC BY 4.0 (once the places layer is added).
 */
(function (global) {
  'use strict';

  const D = Math.PI / 180, NS = 'http://www.w3.org/2000/svg';
  const projX = lon => lon;
  const projY = lat => -Math.log(Math.tan(Math.PI / 4 + lat * D / 2)) / D;
  const unprojY = y => Math.atan(Math.sinh(-y * D)) / D;
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const pathOf = (a, close) => {                       // flat [lon,lat,lon,lat,...] → svg path in world units
    let d = '';
    for (let i = 0; i < a.length; i += 2) d += (i ? 'L' : 'M') + projX(a[i]).toFixed(3) + ' ' + projY(a[i + 1]).toFixed(3);
    return d + (close ? 'Z' : '');
  };
  let uidN = 0;

  const STYLE = `
.atlas{--atlas-sea:#bcd6e6;--atlas-land:#f1e8cf;--atlas-lake-edge:#7ea6bf;--atlas-coast:#8d7f5f;--atlas-river:#5f9bc2;
 --atlas-ink:#3a3226;--atlas-halo:#f6efdc;--atlas-accent:#b3361f;--atlas-sea-ink:#3d6c8a;--atlas-ui:#f6efdc;
 --atlas-blend:multiply;--atlas-relief-op:.6;
 position:relative;overflow:hidden;background:var(--atlas-sea);touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;outline:none;font-family:system-ui,sans-serif}
@media (prefers-color-scheme:dark){.atlas:not([data-theme=light]){--atlas-sea:#0f1c26;--atlas-land:#2a2922;--atlas-lake-edge:#2f5266;--atlas-coast:#5d5946;--atlas-river:#3f7596;--atlas-ink:#e0d6bf;--atlas-halo:#1d1c17;--atlas-accent:#ff7a5c;--atlas-sea-ink:#6c9bb8;--atlas-ui:#2a2922;--atlas-blend:soft-light;--atlas-relief-op:.9}}
.atlas[data-theme=dark]{--atlas-sea:#0f1c26;--atlas-land:#2a2922;--atlas-lake-edge:#2f5266;--atlas-coast:#5d5946;--atlas-river:#3f7596;--atlas-ink:#e0d6bf;--atlas-halo:#1d1c17;--atlas-accent:#ff7a5c;--atlas-sea-ink:#6c9bb8;--atlas-ui:#2a2922;--atlas-blend:soft-light;--atlas-relief-op:.9}
.atlas:active{cursor:grabbing}
.atlas>svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.atlas>svg.a-screen{pointer-events:none}
.atlas .a-land{fill:var(--atlas-land)}
.atlas .a-coast{fill:none;stroke:var(--atlas-coast);stroke-width:.8;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.atlas .a-relief{mix-blend-mode:var(--atlas-blend);opacity:var(--atlas-relief-op)}
.atlas .a-lake{fill:var(--atlas-sea);stroke:var(--atlas-lake-edge);stroke-width:.8;vector-effect:non-scaling-stroke}
.atlas .a-river{fill:none;stroke:var(--atlas-river);stroke-width:1.2;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.atlas .a-poly{vector-effect:non-scaling-stroke;stroke-width:1.5;stroke-linejoin:round}
.atlas .a-path{fill:none;vector-effect:non-scaling-stroke;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.atlas .a-sel{stroke:var(--atlas-ink);stroke-width:3}
.atlas .a-pin circle{fill:var(--atlas-accent);stroke:var(--atlas-halo);stroke-width:1.5}
.atlas .a-pin.a-sel circle{stroke:var(--atlas-ink);stroke-width:3}
.atlas .a-lbl{fill:var(--atlas-ink);paint-order:stroke;stroke:var(--atlas-halo);stroke-width:3.5px;stroke-linejoin:round;font-size:12px}
.atlas .a-lbl.a-sea{fill:var(--atlas-sea-ink);stroke:none;font-style:italic;font-size:13px;letter-spacing:.22em;opacity:.85}
.atlas .a-lbl.a-region{fill:var(--atlas-ink);stroke:none;font-size:12px;letter-spacing:.18em;opacity:.7;text-transform:uppercase}
.atlas .a-ctl{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:6px;cursor:default}
.atlas .a-ctl button{width:38px;height:38px;font-size:20px;line-height:1;border:1px solid #0003;border-radius:8px;background:var(--atlas-ui);color:var(--atlas-ink);cursor:pointer}
.atlas .a-layers{position:absolute;left:10px;top:10px;max-width:220px;padding:8px 10px;border-radius:8px;background:var(--atlas-ui);color:var(--atlas-ink);font-size:13px;cursor:default;box-shadow:0 1px 4px #0003}
.atlas .a-layers label{display:flex;gap:6px;align-items:center;padding:3px 0;cursor:pointer}
.atlas .a-layers h4{margin:6px 0 2px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.65}
.atlas .a-credit{position:absolute;left:8px;bottom:6px;font-size:10px;color:var(--atlas-ink);opacity:.7;background:var(--atlas-ui);padding:1px 5px;border-radius:4px;pointer-events:none}`;

  // ---------------------------------------------------------------- emitter
  class Emitter {
    constructor() { this._h = {}; }
    on(t, f) { (this._h[t] = this._h[t] || []).push(f); return () => this.off(t, f); }
    off(t, f) { this._h[t] = (this._h[t] || []).filter(x => x !== f); }
    emit(t, e) { (this._h[t] || []).slice().forEach(f => f(e)); }
  }

  // ---------------------------------------------------------------- Layer (base)
  class Layer {
    constructor(id, o = {}) {
      this.id = id; this.name = o.name || id;
      this.group = o.group || 'overlay';           // used by layerControl() headings
      this.order = o.order != null ? o.order : 100; // lower draws first (underneath)
      this.space = o.space || 'world';
      this.visible = o.visible !== false;
      this.toggle = o.toggle !== false;            // show in layerControl()
      this.minZoom = o.minZoom || 0;               // ctx.view.s limits
      this.maxZoom = o.maxZoom || Infinity;
      this.filter = null; this.atlas = null; this.g = null;
    }
    active(ctx) { return this.visible && ctx.view.s >= this.minZoom && ctx.view.s <= this.maxZoom; }
    async mount(atlas) { }
    update(ctx) { }
    labels(ctx) { return []; }
    hit(ctx, sx, sy) { return null; }
    unmount() { }
    setFilter(fn) { this.filter = fn; this.refresh(); }   // fn(item) → boolean; null clears
    refresh() { if (this.atlas) this.atlas.invalidate(); }
    allowed(item) { return !this.filter || this.filter(item); }
  }

  // ---------------------------------------------------------------- basemap layers
  const BASEMAP_URL = 'atlas-basemap.json';
  const DEFAULT_RELIEF = [
    { href: 'atlas-relief.webp', x: -10, y: -54.8588, w: 90, h: 46.8327 },       // whole region (Spain to India), 40 px/deg
    { href: 'atlas-relief-levant.webp', x: 31.0, y: -37.1609, w: 7.5, h: 7.5210 } // Levant detail, 240 px/deg
  ];
  // land rings plus inland-sea holes (Caspian), drawn with fill-rule / clip-rule evenodd
const landPath = m => m._landD || (m._landD = m.land.concat(m.holes || []).map(r => pathOf(r, 1)).join(''));

  class LandLayer extends Layer {
    constructor(o) { super('base.land', Object.assign({ name: 'Land', group: 'base', order: 0, toggle: false }, o)); }
    async mount(atlas) {
      const m = await atlas.load(atlas.url(BASEMAP_URL));
      atlas.bounds = m.bbox;
      svgEl('path', { class: 'a-land', d: landPath(m), 'fill-rule': 'evenodd' }, this.g);
      svgEl('path', { class: 'a-coast', d: landPath(m) }, this.g);
    }
  }
  class ReliefLayer extends Layer {
    constructor(o = {}) {
      super('base.relief', Object.assign({ name: 'Terrain shading', group: 'base', order: 10 }, o));
      this.images = o.images || DEFAULT_RELIEF;
    }
    async mount(atlas) {
      const m = await atlas.load(atlas.url(BASEMAP_URL));
      const id = atlas.uid + '-landclip';
      svgEl('path', { d: landPath(m), 'clip-rule': 'evenodd' }, svgEl('clipPath', { id }, svgEl('defs', null, this.g)));
      // blend on the group so stacked images (world + detail) don't multiply twice
      const grp = svgEl('g', { class: 'a-relief', 'clip-path': 'url(#' + id + ')' }, this.g);
      this.images.forEach(i => svgEl('image', { href: atlas.url(i.href), x: i.x, y: i.y, width: i.w, height: i.h, preserveAspectRatio: 'none' }, grp));
    }
  }
  class WaterLayer extends Layer {
    constructor(o = {}) { super('base.water', Object.assign({ name: 'Rivers & lakes', group: 'base', order: 20 }, o)); }
    async mount(atlas) {
      const m = await atlas.load(atlas.url(BASEMAP_URL));
      svgEl('path', { class: 'a-lake', d: m.lakes.map(r => pathOf(r, 1)).join('') }, this.g);
      svgEl('path', { class: 'a-river', d: m.rivers.map(r => pathOf(r.l)).join('') }, this.g);
    }
  }
  const SEA_NAMES = [['Mediterranean Sea', 19, 34.5], ['Red Sea', 37.8, 21.5], ['Persian Gulf', 51.8, 27.2], ['Black Sea', 34, 43.2], ['Caspian Sea', 50.8, 41.3], ['Arabian Desert', 42, 25],
    ['Arabian Sea', 64.5, 16], ['Aegean Sea', 25, 38.6], ['Adriatic Sea', 15.3, 43.2]];
  class NamesLayer extends Layer {
    constructor(o = {}) {
      super('base.names', Object.assign({ name: 'Sea & region names', group: 'base', order: 30, space: 'screen' }, o));
      this.names = o.names || SEA_NAMES;
    }
    labels(ctx) {
      return this.names.map(([t, lon, lat]) => {
        const [x, y] = ctx.toScreen(projX(lon), projY(lat));
        return { key: 'sea:' + t, x, y, text: t.toUpperCase(), priority: 10, r: 0, cls: 'a-sea', spacing: 0.22 * 13, anchors: ['c'] };
      });
    }
  }

  // ---------------------------------------------------------------- overlay layer types
  // Shared plumbing: items from `items` or lazily from `src` (+ optional parse()).
  class ItemLayer extends Layer {
    constructor(id, o = {}) {
      super(id, o);
      this.items = o.items || []; this.src = o.src || null; this.parse = o.parse || (j => j);
      this.selectedId = null; this.nodes = new Map();
    }
    async mount(atlas) {
      if (this.src) this.items = this.parse(await atlas.load(atlas.url(this.src)));
      this.build();
    }
    setItems(items) { this.items = items; this.nodes.clear(); this.g.textContent = ''; this.build(); this.refresh(); }
    select(id) {
      if (this.selectedId != null && this.nodes.has(this.selectedId)) this.nodes.get(this.selectedId).classList.remove('a-sel');
      this.selectedId = id;
      if (id != null && this.nodes.has(id)) this.nodes.get(id).classList.add('a-sel');
      this.refresh();
    }
    build() { }
  }

  // Pins: items [{id, lon, lat, label, priority, kind, ...props}], kinds {kind:{color, r}}
  class PointLayer extends ItemLayer {
    constructor(id, o = {}) { super(id, Object.assign({ space: 'screen', order: 200 }, o)); this.kinds = o.kinds || {}; this.r = o.r || 4; }
    build() {
      this.items.forEach(it => {
        it._x = projX(it.lon); it._y = projY(it.lat);
        const k = this.kinds[it.kind] || {};
        const g = svgEl('g', { class: 'a-pin' }, this.g);
        const c = svgEl('circle', { r: k.r || this.r }, g);
        if (k.color) c.style.fill = k.color;
        this.nodes.set(it.id, g); it._g = g;
      });
    }
    update(ctx) {
      for (const it of this.items) {
        const [sx, sy] = ctx.toScreen(it._x, it._y);
        const on = this.allowed(it) && sx > -20 && sx < ctx.W + 20 && sy > -20 && sy < ctx.H + 20;
        it._sx = sx; it._sy = sy; it._on = on;
        it._g.style.display = on ? '' : 'none';
        if (on) it._g.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)})`);
      }
    }
    labels() {
      const out = [];
      for (const it of this.items) if (it._on) out.push({
        key: this.id + ':' + it.id, x: it._sx, y: it._sy, text: it.label || it.name || '',
        priority: (it.priority || 0) + (it.id === this.selectedId ? 1000 : 0), r: (this.kinds[it.kind] || {}).r || this.r
      });
      return out;
    }
    hit(ctx, sx, sy) {
      let best = null, bd = 18 * 18;
      for (const it of this.items) if (it._on) { const d = (it._sx - sx) ** 2 + (it._sy - sy) ** 2; if (d < bd) { bd = d; best = it; } }
      return best;
    }
  }

  // Routes: items [{id, points:[[lon,lat],...], color, width, dash, label, priority}]
  class PathLayer extends ItemLayer {
    constructor(id, o = {}) { super(id, Object.assign({ order: 150 }, o)); }
    build() {
      this.items.forEach(it => {
        it._xy = it.points.map(p => [projX(p[0]), projY(p[1])]);
        const p = svgEl('path', { class: 'a-path', d: it._xy.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(3) + ' ' + q[1].toFixed(3)).join('') }, this.g);
        if (it.color) p.style.stroke = it.color;
        if (it.width) p.style.strokeWidth = it.width;
        if (it.dash) p.setAttribute('stroke-dasharray', it.dash);
        this.nodes.set(it.id, p); it._p = p;
      });
    }
    update() { for (const it of this.items) it._p.style.display = this.allowed(it) ? '' : 'none'; }
    labels(ctx) {
      const out = [];
      for (const it of this.items) if (it.label && this.allowed(it)) {
        const q = it._xy[Math.floor(it._xy.length / 2)], [x, y] = ctx.toScreen(q[0], q[1]);
        if (x > 0 && x < ctx.W && y > 0 && y < ctx.H) out.push({ key: this.id + ':' + it.id, x, y, text: it.label, priority: it.priority || 0, r: 0, anchors: ['a'] });
      }
      return out;
    }
    hit(ctx, sx, sy) {
      let best = null, bd = 10 * 10;
      for (const it of this.items) {
        if (!this.allowed(it)) continue;
        for (let i = 0; i < it._xy.length - 1; i++) {
          const [ax, ay] = ctx.toScreen(...it._xy[i]), [bx, by] = ctx.toScreen(...it._xy[i + 1]);
          const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
          let t = l2 ? ((sx - ax) * dx + (sy - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
          const d = (ax + t * dx - sx) ** 2 + (ay + t * dy - sy) ** 2;
          if (d < bd) { bd = d; best = it; }
        }
      }
      return best;
    }
  }

  // Regions: items [{id, rings:[[[lon,lat],...],...], fill, stroke, opacity, label, priority}]
  class PolygonLayer extends ItemLayer {
    constructor(id, o = {}) { super(id, Object.assign({ order: 50 }, o)); }
    build() {
      this.items.forEach(it => {
        it._rings = it.rings.map(r => r.map(p => [projX(p[0]), projY(p[1])]));
        const d = it._rings.map(r => r.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(3) + ' ' + q[1].toFixed(3)).join('') + 'Z').join('');
        const p = svgEl('path', { class: 'a-poly', d, 'fill-rule': 'evenodd' }, this.g);
        p.style.fill = it.fill || 'rgba(179,54,31,.18)'; p.style.stroke = it.stroke || it.fill || 'rgba(179,54,31,.8)';
        if (it.opacity != null) p.style.opacity = it.opacity;
        this.nodes.set(it.id, p); it._p = p;
        const r = it._rings[0]; let cx = 0, cy = 0; r.forEach(q => { cx += q[0]; cy += q[1]; }); it._c = [cx / r.length, cy / r.length];
      });
    }
    update() { for (const it of this.items) it._p.style.display = this.allowed(it) ? '' : 'none'; }
    labels(ctx) {
      const out = [];
      for (const it of this.items) if (it.label && this.allowed(it)) {
        const [x, y] = ctx.toScreen(...it._c);
        if (x > 0 && x < ctx.W && y > 0 && y < ctx.H) out.push({ key: this.id + ':' + it.id, x, y, text: it.label.toUpperCase(), priority: it.priority || 0, r: 0, cls: 'a-region', spacing: .18 * 12, anchors: ['c', 'u', 'd'] });
      }
      return out;
    }
    hit(ctx, sx, sy) {
      const [wx, wy] = ctx.toWorld(sx, sy);
      for (let n = this.items.length - 1; n >= 0; n--) {
        const it = this.items[n]; if (!this.allowed(it)) continue;
        const r = it._rings[0]; let inside = false;
        for (let i = 0, j = r.length - 1; i < r.length; j = i++)
          if ((r[i][1] > wy) !== (r[j][1] > wy) && wx < (r[j][0] - r[i][0]) * (wy - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) inside = !inside;
        if (inside) return it;
      }
      return null;
    }
  }

  // ---------------------------------------------------------------- Atlas
  const measureCtx = document.createElement('canvas').getContext('2d');
  const widthCache = new Map();
  function textWidth(text, font) {
    const k = font + '|' + text; let w = widthCache.get(k);
    if (w == null) { measureCtx.font = font; w = measureCtx.measureText(text).width; widthCache.set(k, w); }
    return w;
  }

  class Atlas extends Emitter {
    constructor(host, opts = {}) {
      super();
      this.host = host; this.opts = Object.assign({ base: '', basemap: true, controls: true, credit: true, home: { lon: 37, lat: 32, span: 22 }, maxZoom: 1500 }, opts);
      this.uid = 'atlas' + (++uidN);
      if (!document.getElementById('atlas-style')) { const s = document.createElement('style'); s.id = 'atlas-style'; s.textContent = STYLE; document.head.appendChild(s); }
      host.classList.add('atlas'); if (!host.hasAttribute('tabindex')) host.tabIndex = 0;
      this.svgW = svgEl('svg', { role: 'img', 'aria-label': 'Map of the Bible lands' }, host);
      this.world = svgEl('g', null, this.svgW);
      this.svgS = svgEl('svg', { class: 'a-screen', 'aria-hidden': 'true' }, host);
      this.screen = svgEl('g', null, this.svgS);
      this.labelG = svgEl('g', null, this.svgS);
      this.layers = []; this._cache = new Map(); this._pool = [];
      this.bounds = [-10, 8, 80, 48]; this.W = this.H = 0; this.view = null; this._raf = 0; this._anim = 0;
      this.ctx = {
        atlas: this, W: 0, H: 0, view: null,
        toScreen: (x, y) => [(x - this.view.cx) * this.view.s + this.W / 2, (y - this.view.cy) * this.view.s + this.H / 2],
        toWorld: (sx, sy) => [this.view.cx + (sx - this.W / 2) / this.view.s, this.view.cy + (sy - this.H / 2) / this.view.s]
      };
      this._bindInput();
      if (this.opts.controls) this._buildControls();
      if (this.opts.credit) this.creditEl = Object.assign(document.createElement('div'), { className: 'a-credit', textContent: 'Natural Earth · SRTM/AWS Terrain Tiles' }), host.appendChild(this.creditEl);
      this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(host);
      this._resize();                                   // measure now; the observer covers later changes
      this.ready = this.opts.basemap ? Promise.all(Atlas.basemap().map(l => this.addLayer(l))) : Promise.resolve();
    }
    url(p) { return /^(https?:)?\/\//.test(p) || p[0] === '/' ? p : this.opts.base + p; }
    load(url) {                                       // memoised JSON fetch, shared by layers
      if (!this._cache.has(url)) this._cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }));
      return this._cache.get(url);
    }
    projection() { return { project: (lon, lat) => [projX(lon), projY(lat)], unproject: (x, y) => [x, unprojY(y)] }; }
    project(lon, lat) { return [projX(lon), projY(lat)]; }
    unproject(x, y) { return [x, unprojY(y)]; }

    // ---- layer stack
    async addLayer(layer) {
      if (this.getLayer(layer.id)) throw new Error('layer exists: ' + layer.id);
      layer.atlas = this;
      const parent = layer.space === 'screen' ? this.screen : this.world;
      layer.g = svgEl('g', { 'data-layer': layer.id }, parent);
      if (!layer.visible) layer.g.style.display = 'none';
      this.layers.push(layer);
      this.layers.sort((a, b) => (a.space === b.space ? 0 : a.space === 'world' ? -1 : 1) || a.order - b.order);
      [this.world, this.screen].forEach(p => this.layers.filter(l => l.g.parentNode === p).forEach(l => p.appendChild(l.g)));
      try { await layer.mount(this); } catch (e) { console.warn('atlas: layer failed', layer.id, e); this.emit('error', { layer: layer.id, error: e }); }
      this.invalidate(); this.emit('layerchange', { layer: layer.id, added: true });
      return layer;
    }
    removeLayer(id) {
      const l = this.getLayer(id); if (!l) return;
      l.unmount(); l.g.remove(); this.layers = this.layers.filter(x => x !== l); l.atlas = null;
      this.invalidate(); this.emit('layerchange', { layer: id, removed: true });
    }
    getLayer(id) { return this.layers.find(l => l.id === id) || null; }
    setVisible(id, v) {
      const l = this.getLayer(id); if (!l) return;
      l.visible = !!v; l.g.style.display = v ? '' : 'none';
      this.invalidate(); this.emit('layerchange', { layer: id, visible: !!v });
    }

    // ---- view
    _fitScale(w, h) { return Math.min(this.W / w, this.H / h); }
    _minScale() {                                   // 'cover': never zoom out far enough to show the void beyond the data
      const b = this.bounds; return Math.max(this.W / (projX(b[2]) - projX(b[0])), this.H / (projY(b[1]) - projY(b[3])));
    }
    _clamp(v) {
      const b = this.bounds, x0 = projX(b[0]), x1 = projX(b[2]), y0 = projY(b[3]), y1 = projY(b[1]);
      v.s = Math.max(this._minScale(), Math.min(v.s, this.opts.maxZoom));
      v.cx = Math.max(x0, Math.min(v.cx, x1)); v.cy = Math.max(y0, Math.min(v.cy, y1));
      return v;
    }
    home() { const h = this.opts.home; this.setView({ cx: projX(h.lon), cy: projY(h.lat), s: this._fitScale(h.span, h.span * 0.8) }); }
    setView(v, animate) {
      v = this._clamp(Object.assign({}, this.view, v));
      cancelAnimationFrame(this._anim);
      if (!animate || !this.view) { this.view = v; this.invalidate(); return; }
      const a = Object.assign({}, this.view), t0 = performance.now(), dur = typeof animate === 'number' ? animate : 600;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.view = { cx: a.cx + (v.cx - a.cx) * e, cy: a.cy + (v.cy - a.cy) * e, s: a.s * Math.pow(v.s / a.s, e) };
        this.invalidate(); if (k < 1) this._anim = requestAnimationFrame(step);
      };
      this._anim = requestAnimationFrame(step);
    }
    flyTo(lon, lat, s, animate = true) { this.setView({ cx: projX(lon), cy: projY(lat), s: s || this.view.s }, animate); }
    fitBounds(b, pad = 40, animate = true) {                 // b = [west, south, east, north] in degrees
      const x0 = projX(b[0]), x1 = projX(b[2]), y0 = projY(b[3]), y1 = projY(b[1]);
      const s = Math.min((this.W - 2 * pad) / Math.max(x1 - x0, 1e-6), (this.H - 2 * pad) / Math.max(y1 - y0, 1e-6));
      this.setView({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s }, animate);
    }
    zoomAt(f, px, py) {
      const v = this.view, c = this.ctx, [wx, wy] = c.toWorld(px, py), ns = Math.max(this._minScale(), Math.min(v.s * f, this.opts.maxZoom));
      this.view = this._clamp({ s: ns, cx: wx - (px - this.W / 2) / ns, cy: wy - (py - this.H / 2) / ns }); this.invalidate();
    }
    theme(name) { if (name) this.host.dataset.theme = name; else delete this.host.dataset.theme; }

    // ---- render
    _resize() {
      this.W = this.host.clientWidth; this.H = this.host.clientHeight;
      if (!this.W || !this.H) return;
      if (!this.view) this.home(); else this.invalidate();
    }
    invalidate() { if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this._render(); }); }
    _render() {
      if (!this.W) this._resize();                      // observer callbacks can be late in hidden panes
      if (!this.view || !this.W) return;
      const { cx, cy, s } = this.view, c = this.ctx;
      c.W = this.W; c.H = this.H; c.view = this.view;
      this.svgW.setAttribute('viewBox', `${cx - this.W / 2 / s} ${cy - this.H / 2 / s} ${this.W / s} ${this.H / s}`);
      this.svgS.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
      for (const l of this.layers) if (l.active(c)) l.update(c);
      this._placeLabels(c);
      this.emit('viewchange', { view: this.view, lon: cx, lat: unprojY(cy) });
    }
    // One label pass for all layers: highest priority first; try right / left / above / below;
    // pass 1 avoids every marker, pass 2 only higher-priority markers; unplaced labels are dropped.
    _placeLabels(c) {
      const cands = [];
      for (const l of this.layers) if (l.active(c)) for (const k of l.labels(c)) { if (k.text) cands.push(k); }
      cands.sort((a, b) => b.priority - a.priority);
      const dots = cands.map(k => k.r > 0 ? [k.x - k.r - 1, k.y - k.r - 1, k.x + k.r + 1, k.y + k.r + 1] : null);
      const placed = [], h = 14, hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      let used = 0;
      cands.forEach((k, i) => {
        const font = (k.cls === 'a-sea' ? 'italic 13px' : '12px') + ' system-ui, sans-serif';
        const w = textWidth(k.text, font) + (k.spacing ? k.spacing * k.text.length : 0) + 4, x = k.x, y = k.y, r = k.r || 0;
        const opts = [];
        for (const a of (k.anchors || ['r', 'l', 'u', 'd'])) {
          if (a === 'r') opts.push({ tx: x + r + 3, ty: y + 4, anchor: 'start', rect: [x + r + 1, y - h / 2, x + r + 1 + w, y + h / 2] });
          if (a === 'l') opts.push({ tx: x - r - 3, ty: y + 4, anchor: 'end', rect: [x - r - 1 - w, y - h / 2, x - r - 1, y + h / 2] });
          if (a === 'u') opts.push({ tx: x, ty: y - r - 6, anchor: 'middle', rect: [x - w / 2, y - r - 6 - h, x + w / 2, y - r - 2] });
          if (a === 'd') opts.push({ tx: x, ty: y + r + 14, anchor: 'middle', rect: [x - w / 2, y + r + 3, x + w / 2, y + r + 3 + h] });
          if (a === 'c') opts.push({ tx: x, ty: y + 4, anchor: 'middle', rect: [x - w / 2, y - h / 2, x + w / 2, y + h / 2] });
          if (a === 'a') opts.push({ tx: x, ty: y - 6, anchor: 'middle', rect: [x - w / 2, y - 6 - h, x + w / 2, y - 2] });
        }
        let ok = null;
        for (const strict of [true, false]) {
          for (const o of opts) {
            if (o.rect[2] < 0 || o.rect[0] > c.W || o.rect[3] < 0 || o.rect[1] > c.H) continue;
            if (placed.some(q => hit(o.rect, q))) continue;
            if (dots.some((d, j) => d && j !== i && (strict || j < i) && hit(o.rect, d))) continue;
            ok = o; break;
          }
          if (ok) break;
        }
        if (!ok) return;
        placed.push(ok.rect);
        let t = this._pool[used];
        if (!t) t = this._pool[used] = svgEl('text', null, this.labelG);
        used++;
        t.style.display = ''; t.setAttribute('class', 'a-lbl' + (k.cls ? ' ' + k.cls : ''));
        t.setAttribute('x', ok.tx.toFixed(1)); t.setAttribute('y', ok.ty.toFixed(1)); t.setAttribute('text-anchor', ok.anchor);
        if (t.textContent !== k.text) t.textContent = k.text;
      });
      for (let i = used; i < this._pool.length; i++) this._pool[i].style.display = 'none';
    }

    // ---- input
    _bindInput() {
      const h = this.host, ptrs = new Map(); let last = 0, moved = 0, t0 = 0;
      h.addEventListener('wheel', e => { e.preventDefault(); const r = h.getBoundingClientRect(); this.zoomAt(Math.exp(-e.deltaY * .0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      h.addEventListener('pointerdown', e => {
        if (e.target.closest('.a-ctl,.a-layers')) return;
        h.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); last = 0; if (ptrs.size === 1) { moved = 0; t0 = performance.now(); }
      });
      h.addEventListener('pointermove', e => {
        if (!ptrs.has(e.pointerId) || !this.view) return;
        const o = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 1) {
          moved += Math.abs(e.clientX - o[0]) + Math.abs(e.clientY - o[1]);
          const v = this.view; this.view = this._clamp({ s: v.s, cx: v.cx - (e.clientX - o[0]) / v.s, cy: v.cy - (e.clientY - o[1]) / v.s }); this.invalidate();
        } else if (ptrs.size === 2) {
          moved = 99; const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = h.getBoundingClientRect();
          if (last) this.zoomAt(d / last, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); last = d;
        }
      });
      const up = e => {
        if (!ptrs.has(e.pointerId)) return;
        const wasOne = ptrs.size === 1; ptrs.delete(e.pointerId); last = 0;
        if (e.type === 'pointerup' && wasOne && moved < 6 && performance.now() - t0 < 600) { const r = h.getBoundingClientRect(); this._tap(e.clientX - r.left, e.clientY - r.top); }
      };
      h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      h.addEventListener('keydown', e => {
        const v = this.view; if (!v) return; const step = 60 / v.s;
        const m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (m) { e.preventDefault(); this.setView({ cx: v.cx + m[0], cy: v.cy + m[1] }); }
        else if (e.key === '+' || e.key === '=') this.zoomAt(1.4, this.W / 2, this.H / 2);
        else if (e.key === '-') this.zoomAt(1 / 1.4, this.W / 2, this.H / 2);
      });
    }
    _tap(sx, sy) {
      if (!this.view) return;
      const c = this.ctx; c.W = this.W; c.H = this.H; c.view = this.view;
      for (let i = this.layers.length - 1; i >= 0; i--) {
        const l = this.layers[i]; if (!l.active(c)) continue;
        const item = l.hit(c, sx, sy);
        if (item) { this.select(l.id, item.id, item); return; }
      }
      this.select(null);
    }
    select(layerId, itemId, item) {
      this.layers.forEach(l => l.select && l.select(l.id === layerId ? itemId : null));
      this.selected = layerId ? { layer: layerId, id: itemId, item } : null;
      this.emit('select', this.selected);
    }

    // ---- UI
    _buildControls() {
      const box = Object.assign(document.createElement('div'), { className: 'a-ctl' });
      [['+', 'Zoom in', () => this.zoomAt(1.6, this.W / 2, this.H / 2)], ['−', 'Zoom out', () => this.zoomAt(1 / 1.6, this.W / 2, this.H / 2)], ['⌂', 'Reset view', () => this.home()]]
        .forEach(([t, label, fn]) => { const b = Object.assign(document.createElement('button'), { type: 'button', textContent: t }); b.setAttribute('aria-label', label); b.onclick = fn; box.appendChild(b); });
      this.host.appendChild(box);
    }
    layerControl(container) {                           // checkbox panel, kept in sync with the layer list
      const panel = container || Object.assign(document.createElement('div'), { className: 'a-layers' });
      if (!container) this.host.appendChild(panel);
      const draw = () => {
        panel.textContent = '';
        const groups = {};
        this.layers.filter(l => l.toggle).forEach(l => (groups[l.group] = groups[l.group] || []).push(l));
        Object.keys(groups).forEach(g => {
          const hd = document.createElement('h4'); hd.textContent = g; panel.appendChild(hd);
          groups[g].forEach(l => {
            const lab = document.createElement('label'), cb = document.createElement('input');
            cb.type = 'checkbox'; cb.checked = l.visible; cb.onchange = () => this.setVisible(l.id, cb.checked);
            lab.append(cb, document.createTextNode(l.name)); panel.appendChild(lab);
          });
        });
      };
      draw(); this.on('layerchange', draw); return panel;
    }
    destroy() { this._ro.disconnect(); cancelAnimationFrame(this._raf); cancelAnimationFrame(this._anim); this.layers.forEach(l => l.unmount()); this.host.textContent = ''; this.host.classList.remove('atlas'); }
  }

  Atlas.basemap = o => [new LandLayer(), new ReliefLayer(o && o.relief), new WaterLayer(), new NamesLayer(o && o.names)];
  Object.assign(Atlas, { Layer, ItemLayer, PointLayer, PathLayer, PolygonLayer, LandLayer, ReliefLayer, WaterLayer, NamesLayer });
  global.Atlas = Atlas;
})(window);
