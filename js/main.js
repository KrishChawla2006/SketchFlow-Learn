
const $ = s => document.querySelector(s);
const cv = $('#board'), ctx = cv.getContext('2d'), stage = $('#stage');
const KEY = 'whiteboard-project-v1', FONT = '"Segoe UI",system-ui,sans-serif';
const TOOLS = {v:'select', p:'pen', e:'eraser', l:'line', a:'arrow', r:'rect', o:'ellipse', g:'triangle', d:'diamond', s:'star', k:'highlight', h:'hand', z:'zoom', t:'text'};

let objects = [];           
let images = {};            
let undoS = [], redoS = [];  
let tool = 'pen', sel = null, draft = null, drag = null, editingId = null;
let uid = 1, W = 0, H = 0, PAPER = '#fff', ACCENT = '#3b5bdb', pend = null;
let V = {z:1, x:0, y:0}, clip = null, space = false;  

const snap = () => JSON.stringify(objects);
const selObj = () => objects.find(o => o.id === sel);
const num = (id, d) => { const v = parseFloat($('#' + id).value); return isNaN(v) ? d : v; };
const st = () => ({color:$('#color').value, fillc:$('#fillc').value, fill:$('#fill').checked, size:num('size', 4), op:num('op', 100), dash:$('#dash').value, rad:num('rad', 0), fs:num('fs', 24), bold:$('#bold').checked, italic:$('#italic').checked});

/*Geometry*/
const textFont = (o, z = 1) => `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${o.fs * z}px ${FONT}`;
function textBox(o) {
  ctx.save(); ctx.font = textFont(o);
  const ls = o.text.split('\n'), w = Math.max(...ls.map(l => ctx.measureText(l).width));
  ctx.restore();
  return {x:o.x, y:o.y, w, h:ls.length * o.fs * 1.2};
}
function bounds(o) {
  if (o.type === 'pen') {
    const xs = o.points.map(p => p[0]), ys = o.points.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return {x, y, w:Math.max(...xs) - x, h:Math.max(...ys) - y};
  }
  if (o.type === 'line' || o.type === 'arrow') {
    const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2);
    return {x, y, w:Math.abs(o.x2 - o.x1), h:Math.abs(o.y2 - o.y1)};
  }
  if (o.type === 'text') return textBox(o);
  return {x:o.x, y:o.y, w:o.w, h:o.h};
}
function rp(x, y, o, sg) {   
  const b = bounds(o), cx = b.x + b.w / 2, cy = b.y + b.h / 2, a = sg * (o.rot || 0) * Math.PI / 180;
  const dx = x - cx, dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function hit(o, x, y) {
  if (o.hide || o.lock) return false;
  if (o.rot) [x, y] = rp(x, y, o, -1);
  const t = 6;
  if (o.type === 'pen') {
    const p = o.points;
    if (p.length === 1) return Math.hypot(x - p[0][0], y - p[0][1]) <= o.size / 2 + t;
    for (let i = 1; i < p.length; i++)
      if (segDist(x, y, p[i-1][0], p[i-1][1], p[i][0], p[i][1]) <= o.size / 2 + t) return true;
    return false;
  }
  if (o.type === 'line' || o.type === 'arrow') return segDist(x, y, o.x1, o.y1, o.x2, o.y2) <= o.size / 2 + t;
  const b = bounds(o);
  return x >= b.x - t && x <= b.x + b.w + t && y >= b.y - t && y <= b.y + b.h + t;
}
const topHit = (x, y) => [...objects].reverse().find(o => hit(o, x, y));

function move(o, dx, dy) {
  if (o.points) o.points = o.points.map(p => [p[0] + dx, p[1] + dy]);
  else if ('x1' in o) { o.x1 += dx; o.x2 += dx; o.y1 += dy; o.y2 += dy; }
  else { o.x += dx; o.y += dy; }
}
function resize(o, r, b, nb) {   
  const sx = b.w ? nb.w / b.w : 1, sy = b.h ? nb.h / b.h : 1;
  const mx = x => nb.x + (x - b.x) * sx, my = y => nb.y + (y - b.y) * sy;
  if (r.points) o.points = r.points.map(p => [mx(p[0]), my(p[1])]);
  else if ('x1' in r) { o.x1 = mx(r.x1); o.x2 = mx(r.x2); o.y1 = my(r.y1); o.y2 = my(r.y2); }
  else if (r.type === 'text') { o.x = nb.x; o.y = nb.y; o.fs = Math.max(8, r.fs * sy); }
  else { o.x = nb.x; o.y = nb.y; o.w = r.w * sx; o.h = r.h * sy; }
}


const paint = (c, o) => { if (o.fill) { c.fillStyle = o.fillc || o.color; c.fill(); } c.stroke(); };
function draw(c, o) {
  if (o.hide) return;
  c.save();
  c.globalAlpha = (o.op ?? 100) / 100;
  if (o.rot) { const b = bounds(o), cx = b.x + b.w / 2, cy = b.y + b.h / 2; c.translate(cx, cy); c.rotate(o.rot * Math.PI / 180); c.translate(-cx, -cy); }
  c.strokeStyle = c.fillStyle = o.color; c.lineWidth = o.size; c.lineCap = c.lineJoin = 'round';
  c.setLineDash(o.dash === 'dashed' ? [o.size * 3, o.size * 2] : o.dash === 'dotted' ? [1, o.size * 2] : []);
  switch (o.type) {
    case 'pen': {
      const p = o.points; c.beginPath(); c.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) { c.arc(p[0][0], p[0][1], o.size / 2, 0, 7); c.fill(); break; }
      for (let i = 1; i < p.length - 1; i++)
        c.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i+1][0]) / 2, (p[i][1] + p[i+1][1]) / 2);
      c.lineTo(p[p.length-1][0], p[p.length-1][1]); c.stroke(); break;
    }
    case 'line': case 'arrow': {
      c.beginPath(); c.moveTo(o.x1, o.y1); c.lineTo(o.x2, o.y2); c.stroke();
      if (o.type === 'arrow') {
        const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), l = 10 + o.size * 2;
        c.beginPath();
        c.moveTo(o.x2 - l * Math.cos(a - .45), o.y2 - l * Math.sin(a - .45));
        c.lineTo(o.x2, o.y2);
        c.lineTo(o.x2 - l * Math.cos(a + .45), o.y2 - l * Math.sin(a + .45));
        c.stroke();
      }
      break;
    }
    case 'rect': c.beginPath(); c.roundRect(o.x, o.y, o.w, o.h, o.rad || 0); paint(c, o); break;
    case 'ellipse': c.beginPath(); c.ellipse(o.x + o.w/2, o.y + o.h/2, o.w/2, o.h/2, 0, 0, 7); paint(c, o); break;
    case 'triangle':
      c.beginPath(); c.moveTo(o.x + o.w/2, o.y); c.lineTo(o.x + o.w, o.y + o.h); c.lineTo(o.x, o.y + o.h); c.closePath(); paint(c, o); break;
    case 'diamond':
      c.beginPath(); c.moveTo(o.x + o.w/2, o.y); c.lineTo(o.x + o.w, o.y + o.h/2); c.lineTo(o.x + o.w/2, o.y + o.h); c.lineTo(o.x, o.y + o.h/2); c.closePath(); paint(c, o); break;
    case 'star':
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .4 : 1;
        const px = o.x + o.w/2 + Math.cos(a) * r * o.w/2, py = o.y + o.h/2 + Math.sin(a) * r * o.h/2;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath(); paint(c, o); break;
    case 'text':
      c.font = textFont(o); c.textBaseline = 'top';
      o.text.split('\n').forEach((l, i) => c.fillText(l, o.x, o.y + i * o.fs * 1.2)); break;
    case 'image': {
      const im = images[o.img]; if (im && im.el.complete) c.drawImage(im.el, o.x, o.y, o.w, o.h); break;
    }
  }
  c.restore();
}
function render() {
  const d = devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(d * V.z, 0, 0, d * V.z, d * V.x, d * V.y);
  const gs = (22 * V.z) + 'px';
  stage.style.backgroundSize = gs + ' ' + gs; stage.style.backgroundPosition = V.x + 'px ' + V.y + 'px';
  objects.forEach(o => o.id !== editingId && draw(ctx, o));
  if (draft) draw(ctx, draft);
  const o = selObj();
  if (o && tool === 'select' && o.id !== editingId) {
    const b = bounds(o), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((o.rot || 0) * Math.PI / 180); ctx.translate(-cx, -cy);
    ctx.strokeStyle = ctx.fillStyle = ACCENT; ctx.lineWidth = 1 / V.z; ctx.setLineDash([5 / V.z, 4 / V.z]);
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); ctx.setLineDash([]);
    ctx.fillRect(b.x + b.w + 4 - 5 / V.z, b.y + b.h + 4 - 5 / V.z, 10 / V.z, 10 / V.z);   // resize handle
    ctx.restore();
  }
  if (o) syncGeo(o);
}
function syncGeo(o) {   
  if (document.activeElement && document.activeElement.closest('.pp')) return;
  const b = bounds(o);
  ['x', 'y', 'w', 'h'].forEach(k => $('#' + k).value = Math.round(b[k]));
  $('#rot').value = Math.round(o.rot || 0);
}
function fit() {
  const r = stage.getBoundingClientRect(), d = devicePixelRatio || 1;
  W = r.width; H = r.height;
  cv.width = W * d; cv.height = H * d; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(d, 0, 0, d, 0, 0); render();
}

/*History*/
function finish(pre) {
  if (snap() !== pre) { undoS.push(pre); if (undoS.length > 100) undoS.shift(); redoS = []; persist(); }
  render(); layers();
}
const act = fn => { const pre = snap(); fn(); finish(pre); };
const fixSel = () => { if (!selObj()) sel = null; };
function undo() { if (!undoS.length) return; redoS.push(snap()); objects = JSON.parse(undoS.pop()); fixSel(); persist(); render(); layers(); }
function redo() { if (!redoS.length) return; undoS.push(snap()); objects = JSON.parse(redoS.pop()); fixSel(); persist(); render(); layers(); }

/*Storage (localStorage + JSON file)*/
const project = () => ({uid, objects, images:Object.fromEntries(Object.entries(images).map(([k, v]) => [k, v.src]))});
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(project())); $('#status').textContent = 'Autosaves in this browser'; }
  catch { $('#status').textContent = 'Browser storage is full. Use Save JSON to keep your work.'; }
}
function load(d) {
  objects = d.objects || []; images = {};
  uid = Math.max(d.uid || 1, objects.reduce((m, o) => Math.max(m, o.id), 0) + 1);
  for (const [k, src] of Object.entries(d.images || {})) { const el = new Image(); el.onload = render; el.src = src; images[k] = {src, el}; }
  sel = null; undoS = []; redoS = []; render(); layers();
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const saveJSON = () => download(new Blob([JSON.stringify(project())], {type:'application/json'}), 'whiteboard.json');
function exportImg(type) {  
  let b = {x:0, y:0, w:W, h:H};
  if (objects.length) {
    const bs = objects.map(bounds), pad = 30;
    const x1 = Math.min(...bs.map(q => q.x)) - pad, y1 = Math.min(...bs.map(q => q.y)) - pad;
    const x2 = Math.max(...bs.map(q => q.x + q.w)) + pad, y2 = Math.max(...bs.map(q => q.y + q.h)) + pad;
    b = {x:x1, y:y1, w:x2 - x1, h:y2 - y1};
  }
  const s = 2, c = document.createElement('canvas'); c.width = b.w * s; c.height = b.h * s;
  const x = c.getContext('2d'); x.scale(s, s);
  x.fillStyle = PAPER; x.fillRect(0, 0, b.w, b.h); x.translate(-b.x, -b.y);
  objects.forEach(o => draw(x, o));
  const cp = type === 'copy';
  c.toBlob(bl => cp ? navigator.clipboard.write([new ClipboardItem({'image/png':bl})]).catch(() => alert('The browser blocked clipboard access.')) : download(bl, 'whiteboard.' + (type === 'image/png' ? 'png' : 'jpg')), cp ? 'image/png' : type, .92);
}

/*Tools & pointer input*/
function setTool(t) {
  tool = t; if (t !== 'select') sel = null;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  cv.style.cursor = t === 'select' ? 'default' : t === 'hand' ? 'grab' : t === 'zoom' ? 'zoom-in' : t === 'text' ? 'text' : 'crosshair';
  render(); layers();
}
const pos = e => {
  const r = cv.getBoundingClientRect();
  let x = (e.clientX - r.left - V.x) / V.z, y = (e.clientY - r.top - V.y) / V.z;
  if ($('#snap').checked && tool !== 'select' && tool !== 'eraser') { x = Math.round(x / 20) * 20; y = Math.round(y / 20) * 20; }
  return {x, y};
};

function erase(p) {
  const n = objects.length;
  objects = objects.filter(o => !hit(o, p.x, p.y));
  if (objects.length !== n) fixSel();
}
cv.addEventListener('pointerdown', e => {
  if (e.button === 1 || (e.button === 0 && (space || tool === 'hand'))) { drag = {mode:'pan', sx:e.clientX, sy:e.clientY, vx:V.x, vy:V.y}; cv.style.cursor = 'grabbing'; cv.setPointerCapture(e.pointerId); return; }
  if (e.button) return;
  const ae = document.activeElement;
  if (ae && ae.tagName === 'TEXTAREA') { ae.blur(); if (tool === 'text') return; }
  cv.setPointerCapture(e.pointerId);
  const p = pos(e), s = st(), pre = snap();
  if (tool === 'select') {
    const o = selObj();
    if (o) {
      const b = bounds(o);
      const hp = rp(b.x + b.w + 4, b.y + b.h + 4, o, 1);
      if (Math.hypot(p.x - hp[0], p.y - hp[1]) < 10 / V.z) { drag = {mode:'resize', pre, r:structuredClone(o), b}; return; }
    }
    const h = topHit(p.x, p.y);
    sel = h ? h.id : null;
    if (h) { sync(h); drag = {mode:'move', pre, last:p}; }
    layers(); render();
  } else if (tool === 'zoom') {
    const r = cv.getBoundingClientRect();
    drag = {mode:'zoom', x0:e.clientX - r.left, y0:e.clientY - r.top, out:e.altKey || e.shiftKey};
  } else if (tool === 'eraser') { drag = {mode:'erase', pre}; erase(p); render(); }
  else if (tool === 'text') drag = {mode:'text', p};
  else {
    const hl = tool === 'highlight';
    const base = {type:hl ? 'pen' : tool, color:s.color, fillc:s.fillc, size:hl ? Math.max(s.size * 4, 14) : s.size, fill:s.fill, op:hl ? Math.min(s.op, 35) : s.op, dash:s.dash, rad:s.rad};
    if (tool === 'pen' || hl) draft = {...base, points:[[p.x, p.y]]};
    else if (tool === 'line' || tool === 'arrow') draft = {...base, x1:p.x, y1:p.y, x2:p.x, y2:p.y};
    else draft = {...base, x:p.x, y:p.y, w:0, h:0};
    drag = {mode:'draw', pre, start:p}; render();
  }
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.mode === 'zoom') {   // draw the zoom-to-area box
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, zb = $('#zb');
    Object.assign(zb.style, {display:'block', left:Math.min(x, drag.x0) + 'px', top:Math.min(y, drag.y0) + 'px', width:Math.abs(x - drag.x0) + 'px', height:Math.abs(y - drag.y0) + 'px'});
    return;
  }
  if (drag.mode === 'pan') { V.x = drag.vx + e.clientX - drag.sx; V.y = drag.vy + e.clientY - drag.sy; render(); return; }
  const p = pos(e), o = selObj();
  if (drag.mode === 'draw') {
    if (draft.points) draft.points.push([p.x, p.y]);
    else if ('x1' in draft) {
      let x = p.x, y = p.y;
      if (e.shiftKey) {   // snap to 45-degree steps
        const dx = x - draft.x1, dy = y - draft.y1, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, l = Math.hypot(dx, dy);
        x = draft.x1 + l * Math.cos(a); y = draft.y1 + l * Math.sin(a);
      }
      draft.x2 = x; draft.y2 = y;
    }
    else {
      const s = drag.start;
      let w = Math.abs(p.x - s.x), h = Math.abs(p.y - s.y);
      if (e.shiftKey) w = h = Math.max(w, h);   // perfect square / circle
      draft.x = p.x < s.x ? s.x - w : s.x; draft.y = p.y < s.y ? s.y - h : s.y;
      draft.w = w; draft.h = h;
    }
  } else if (drag.mode === 'move' && o) { move(o, p.x - drag.last.x, p.y - drag.last.y); drag.last = p; }
  else if (drag.mode === 'resize' && o) {
    const q = o.rot ? rp(p.x, p.y, drag.r, -1) : [p.x, p.y];
    resize(o, drag.r, drag.b, {x:drag.b.x, y:drag.b.y, w:Math.max(8, q[0] - drag.b.x), h:Math.max(8, q[1] - drag.b.y)});
  }
  else if (drag.mode === 'erase') erase(p);
  render();
});
function endDrag() {
  if (!drag) return;
  if (drag.mode === 'pan') { drag = null; setTool(tool); if (space) cv.style.cursor = 'grab'; return; }
  if (drag.mode === 'zoom') {
    const zb = $('#zb'), bx = parseFloat(zb.style.left), by = parseFloat(zb.style.top);
    const bw = parseFloat(zb.style.width), bh = parseFloat(zb.style.height), d = drag;
    const area = zb.style.display === 'block' && bw > 8 && bh > 8 && !d.out;
    zb.style.display = 'none'; drag = null;
    if (area) {   // zoom so the dragged box fills the view
      const nz = Math.min(8, Math.max(.1, V.z * Math.min(W / bw, H / bh)));
      const wx = (bx + bw / 2 - V.x) / V.z, wy = (by + bh / 2 - V.y) / V.z;
      V.z = nz; V.x = W / 2 - wx * nz; V.y = H / 2 - wy * nz;
      $('#zoom').value = Math.round(nz * 100); render();
    } else setZoom(V.z * (d.out ? 1 / 1.25 : 1.25), d.x0, d.y0);
    return;
  }
  if (drag.mode === 'text') { const p = drag.p; drag = null; openText(p.x, p.y, null); return; }
  if (drag.mode === 'draw' && draft) {
    const d = draft;
    const tiny = d.type !== 'pen' && ('x1' in d ? Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 3 : d.w < 3 && d.h < 3);
    if (!tiny) { d.id = uid++; objects.push(d); }
    draft = null;
  }
  finish(drag.pre); drag = null;
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('dblclick', e => {
  if (tool !== 'select') return;
  const p = pos(e), h = topHit(p.x, p.y);
  if (h && h.type === 'text') { sel = h.id; openText(h.x, h.y, h); }
});

/*Text tool*/
function openText(x, y, o) {
  const s = st();
  const t = o || {x, y, text:'', color:s.color, op:s.op, fs:s.fs, bold:s.bold, italic:s.italic};
  editingId = o ? o.id : null; if (o) render();
  const ta = document.createElement('textarea');
  ta.className = 'txt'; ta.value = t.text;
  Object.assign(ta.style, {left:(t.x * V.z + V.x) + 'px', top:(t.y * V.z + V.y) + 'px', font:textFont(t, V.z), color:t.color, lineHeight:'1.2'});
  stage.append(ta);
  const grow = () => {
    ta.style.height = '0'; ta.style.height = ta.scrollHeight + 'px';
    ta.style.width = '0'; ta.style.width = Math.max(80, ta.scrollWidth + 8) + 'px';
  };
  grow(); ta.oninput = grow; ta.focus();
  let done = false;
  const commit = () => {
    if (done) return; done = true;
    const v = ta.value; ta.remove(); editingId = null;
    const pre = snap();
    if (o) { if (v.trim()) o.text = v; else { objects = objects.filter(q => q !== o); sel = null; } }
    else if (v.trim()) objects.push({id:uid++, type:'text', ...t, text:v});
    finish(pre);
  };
  ta.onblur = commit;
  ta.onkeydown = e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); commit(); }
    e.stopPropagation();
  };
}

/*Images*/
function addImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1200 / Math.max(im.width, im.height));   // downscale to keep storage small
      const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const src = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', .85);
      const el = new Image();
      el.onload = () => {
        const key = 'i' + uid++, f = Math.min(1, 400 / c.width, 400 / c.height);
        images[key] = {src, el};
        act(() => { const o = {id:uid++, type:'image', img:key, x:60, y:60, w:c.width * f, h:c.height * f}; objects.push(o); sel = o.id; });
        setTool('select'); sel = objects[objects.length - 1].id; layers(); render();
      };
      el.src = src;
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}

/*Layers panel & object actions*/
function layers() {
  const ul = $('#layers'); ul.innerHTML = '';
  [...objects].reverse().forEach(o => {
    const li = document.createElement('li');
    const nm = document.createElement('span');
    nm.textContent = o.name || (o.type === 'text' ? 'Text: ' + o.text.slice(0, 14) : o.type[0].toUpperCase() + o.type.slice(1));
    nm.title = 'Double-click to rename';
    nm.ondblclick = () => { const n = prompt('Layer name', nm.textContent); if (n) act(() => { o.name = n; }); };
    li.append(nm);
    ['hide', 'lock'].forEach(k => {
      const b = document.createElement('button');
      b.textContent = k === 'hide' ? (o.hide ? 'Show' : 'Hide') : (o.lock ? 'Unlock' : 'Lock');
      b.onclick = e => { e.stopPropagation(); act(() => { o[k] = !o[k]; }); };
      li.append(b);
    });
    if (o.id === sel) li.className = 'on';
    li.onclick = () => { setTool('select'); sel = o.id; sync(o); layers(); render(); };
    ul.append(li);
  });
  $('#empty').hidden = objects.length > 0;
  ['fwd', 'back', 'dup', 'del'].forEach(id => $('#' + id).disabled = !selObj());
}
const needSel = fn => () => { if (selObj()) act(fn); };
$('#fwd').onclick = needSel(() => { const i = objects.findIndex(o => o.id === sel); if (i < objects.length - 1) [objects[i], objects[i+1]] = [objects[i+1], objects[i]]; });
$('#back').onclick = needSel(() => { const i = objects.findIndex(o => o.id === sel); if (i > 0) [objects[i], objects[i-1]] = [objects[i-1], objects[i]]; });
$('#dup').onclick = needSel(() => { const c = structuredClone(selObj()); c.id = uid++; move(c, 20, 20); objects.push(c); sel = c.id; });
$('#del').onclick = needSel(() => { objects = objects.filter(o => o.id !== sel); sel = null; });


function sync(o) {
  $('#color').value = $('#colorHex').value = o.color;
  $('#fillc').value = $('#fillcHex').value = o.fillc || o.color;
  $('#fill').checked = !!o.fill;
  $('#op').value = $('#opR').value = o.op ?? 100;
  $('#dash').value = o.dash || 'solid';
  $('#rad').value = o.rad || 0;
  if (o.type === 'text') { $('#fs').value = Math.round(o.fs); $('#bold').checked = !!o.bold; $('#italic').checked = !!o.italic; }
  else if (o.size) $('#size').value = o.size;
}
function restyle(id) {
  const o = selObj(); if (!o) return;
  if (pend === null) pend = snap();
  const s = st();
  if ('xywh'.includes(id) && id.length === 1) {
    const b = bounds(o);
    resize(o, structuredClone(o), b, {x:num('x', b.x), y:num('y', b.y), w:Math.max(1, num('w', b.w)), h:Math.max(1, num('h', b.h))});
  } else if (id === 'rot') o.rot = num('rot', 0);
  else {
    Object.assign(o, {color:s.color, fillc:s.fillc, fill:s.fill, op:s.op, dash:s.dash});
    if (o.type === 'text') { o.fs = s.fs; o.bold = s.bold; o.italic = s.italic; }
    else if (o.type !== 'image') { o.size = s.size; o.rad = s.rad; }
  }
  render();
}
['color', 'fillc', 'fill', 'size', 'op', 'dash', 'rad', 'fs', 'bold', 'italic', 'rot', 'x', 'y', 'w', 'h'].forEach(id => {
  $('#' + id).addEventListener('input', () => restyle(id));
  $('#' + id).addEventListener('change', () => { if (pend !== null) { finish(pend); pend = null; } });
});
[['color', 'colorHex'], ['fillc', 'fillcHex']].forEach(([c, h]) => {   // color picker <-> hex field
  $('#' + c).addEventListener('input', () => { $('#' + h).value = $('#' + c).value; });
  $('#' + h).addEventListener('change', e => {
    let v = e.target.value.trim(); if (v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(v)) {
      $('#' + c).value = v.toLowerCase();
      $('#' + c).dispatchEvent(new Event('input')); $('#' + c).dispatchEvent(new Event('change'));
    } else e.target.value = $('#' + c).value;
  });
});
$('#op').addEventListener('input', () => { $('#opR').value = $('#op').value; });   // opacity number <-> slider
$('#opR').addEventListener('input', () => { $('#op').value = $('#opR').value; $('#op').dispatchEvent(new Event('input')); });
$('#opR').addEventListener('change', () => $('#op').dispatchEvent(new Event('change')));
['#1b1f2a', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#7048e8', '#c2255c', '#ffffff'].forEach(c => {
  const i = document.createElement('i'); i.style.background = c; i.title = c;
  i.onclick = () => { $('#colorHex').value = c; $('#colorHex').dispatchEvent(new Event('change')); };
  $('#sw').append(i);
});
if (window.EyeDropper) $('#eyedrop').onclick = async () => {
  try { const r = await new EyeDropper().open(); $('#colorHex').value = r.sRGBHex; $('#colorHex').dispatchEvent(new Event('change')); } catch {}
};
else $('#eyedrop').hidden = true;


function setZoom(z, cx = W / 2, cy = H / 2) {
  z = Math.min(8, Math.max(.1, z));
  V.x = cx - (cx - V.x) * z / V.z; V.y = cy - (cy - V.y) * z / V.z; V.z = z;
  $('#zoom').value = Math.round(z * 100); render();
}
$('#zoom').onchange = () => setZoom(num('zoom', 100) / 100);
cv.addEventListener('wheel', e => {
  e.preventDefault(); const r = cv.getBoundingClientRect();
  setZoom(V.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
}, {passive:false});
$('#bg').onchange = e => { stage.dataset.bg = e.target.value; render(); };
$('#copyimg').onclick = () => exportImg('copy');
$('#fsbtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
$('#keys').onclick = () => alert('V Select, P Pen, H Hand, Z Zoom, K Highlighter, E Eraser, L Line, A Arrow, R Rectangle, O Ellipse, G Triangle, D Diamond, S Star, T Text\nShift while drawing: straight lines and equal sides\nSpace + drag or middle mouse: pan. Mouse wheel: zoom\nCtrl+C / X / V: copy, cut, paste. Ctrl+D: duplicate\nArrow keys: nudge (Shift = 10 px). Delete: remove\nCtrl+Z / Ctrl+Y: undo and redo. Ctrl+S: save JSON');
addEventListener('keydown', e => {
  const t = e.target;
  if (/^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && !/^(checkbox|range|color)$/.test(t.type))) return;
  const m = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.code === 'Space') { space = true; cv.style.cursor = 'grab'; e.preventDefault(); }
  else if (m && (k === 'c' || k === 'x') && selObj()) { clip = structuredClone(selObj()); if (k === 'x') $('#del').click(); }
  else if (e.key.startsWith('Arrow') && selObj()) {
    e.preventDefault(); const n = e.shiftKey ? 10 : 1;
    act(() => move(selObj(), e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0));
  } else if (k === '?') $('#keys').click();
});
addEventListener('keyup', e => { if (e.code === 'Space') { space = false; setTool(tool); } });

/*Buttons, keyboard, drop/paste, theme*/
document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => b.dataset.tool === 'image' ? $('#file').click() : setTool(b.dataset.tool));
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#clear').onclick = () => act(() => { objects = []; sel = null; });
$('#png').onclick = () => exportImg('image/png');
$('#jpg').onclick = () => exportImg('image/jpeg');
$('#save').onclick = saveJSON;
$('#open').onclick = () => $('#openfile').click();
$('#file').onchange = e => { addImage(e.target.files[0]); e.target.value = ''; };
$('#openfile').onchange = async e => {
  try { load(JSON.parse(await e.target.files[0].text())); persist(); }
  catch { $('#status').textContent = 'That file is not a valid whiteboard JSON.'; }
  e.target.value = '';
};
addEventListener('keydown', e => {
  if (/^(TEXTAREA|SELECT)$/.test(e.target.tagName) || (e.target.tagName === 'INPUT' && !/^(checkbox|range|color)$/.test(e.target.type))) return;
  const k = e.key.toLowerCase(), m = e.ctrlKey || e.metaKey;
  if (m && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (m && k === 'y') { e.preventDefault(); redo(); }
  else if (m && k === 'd') { e.preventDefault(); $('#dup').click(); }
  else if (m && k === 's') { e.preventDefault(); saveJSON(); }
  else if (!m && (k === 'delete' || k === 'backspace')) $('#del').click();
  else if (!m && TOOLS[k]) setTool(TOOLS[k]);
});
stage.addEventListener('dragover', e => e.preventDefault());
stage.addEventListener('drop', e => { e.preventDefault(); addImage(e.dataTransfer.files[0]); });
addEventListener('paste', e => {
  if (/^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;
  const f = [...(e.clipboardData?.files || [])][0];
  if (f) addImage(f);
  else if (clip) { act(() => { const c = structuredClone(clip); c.id = uid++; move(c, 20, 20); clip = structuredClone(c); objects.push(c); sel = c.id; }); setTool('select'); }
});
addEventListener('resize', fit);

function theme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('wb-theme', t); } catch {}
  const cs = getComputedStyle(document.documentElement);
  PAPER = cs.getPropertyValue('--paper').trim(); ACCENT = cs.getPropertyValue('--accent').trim();
  $('#theme').textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
  render();
}
$('#theme').onclick = () => theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

/*Start*/
try { const d = localStorage.getItem(KEY); if (d && !location.search.includes('new=1')) load(JSON.parse(d)); } catch {}
let saved = null; try { saved = localStorage.getItem('wb-theme'); } catch {}
theme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
fit(); setTool('pen');
