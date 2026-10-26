/* Colorblind Sim — Machado, Oliveira & Fernandes (2009) dichromacy matrices applied in linear RGB, on this device. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$, h = S3.h;

  // ---------- colour science (tested in S3_SELFTEST) ----------
  // Severity-1.0 matrices from Machado et al. 2009, "A Physiologically-based Model for Simulation of Color Vision Deficiency".
  var M = {
    protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
    deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
    tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900],
    achroma: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722] // Rec. 709 luminance
  };
  var TYPES = [
    { id: "protanopia", base: "protan", sev: false, name: "Protanopia", short: "no red cones",
      text: "The red-sensitive (L) cones are missing. Reds look dark and muddy, and red, orange, yellow and green are easily confused. A red warning on a dark background can almost disappear.",
      who: "About 1 in 100 men." },
    { id: "protanomaly", base: "protan", sev: true, name: "Protanomaly", short: "weak red",
      text: "The red cones are present but shifted towards green, so reds are weaker and duller. The severity slider goes from very mild to almost protanopia.",
      who: "About 1 in 100 men." },
    { id: "deuteranopia", base: "deutan", sev: false, name: "Deuteranopia", short: "no green cones",
      text: "The green-sensitive (M) cones are missing. Red and green look alike (both brownish-yellow), and so do purple and blue. Brightness stays close to normal, unlike protanopia.",
      who: "About 1 in 100 men." },
    { id: "deuteranomaly", base: "deutan", sev: true, name: "Deuteranomaly", short: "weak green, the most common",
      text: "The green cones are shifted towards red. Greens, yellows and reds are harder to tell apart, especially in small areas or dim light. This is the most common form of colour blindness.",
      who: "About 5 in 100 men and 1 in 250 women." },
    { id: "tritanopia", base: "tritan", sev: false, name: "Tritanopia", short: "no blue cones",
      text: "The blue-sensitive (S) cones are missing. Blue and green are confused, and yellow can look pinkish or light grey. Unlike red-green types, it affects men and women equally.",
      who: "Rare: roughly 1 in 10,000 people or fewer." },
    { id: "tritanomaly", base: "tritan", sev: true, name: "Tritanomaly", short: "weak blue",
      text: "The blue cones work poorly. Blues look greener and yellows paler; the effect grows with severity.",
      who: "Rare." },
    { id: "achromatopsia", base: "achroma", sev: false, name: "Achromatopsia", short: "no colour at all",
      text: "Complete colour blindness: only lightness is seen. It is a good test for any design: two colours that become the same grey only differ by hue.",
      who: "Very rare: about 1 in 30,000 people." }
  ];
  var byId = {}; TYPES.forEach(function (t) { byId[t.id] = t; });

  var TO_LIN = new Float32Array(256), TO_SRGB = new Uint8ClampedArray(16385);
  (function () {
    for (var i = 0; i < 256; i++) { var c = i / 255; TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    for (var j = 0; j <= 16384; j++) { var l = j / 16384; TO_SRGB[j] = Math.round(255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)); }
  })();
  function lin2srgb(l) { return TO_SRGB[l <= 0 ? 0 : l >= 1 ? 16384 : Math.round(l * 16384)]; }
  // Full dichromacy at severity 1; anomalous trichromacy blends with normal vision (in linear RGB) by severity.
  function matrixFor(typeId, sev) {
    var t = byId[typeId], m = M[t.base], s = t.sev ? Math.max(0, Math.min(1, sev)) : 1, out = [];
    for (var i = 0; i < 9; i++) out.push(s * m[i] + (1 - s) * (i % 4 === 0 ? 1 : 0));
    return out;
  }
  function simulateData(src, typeId, sev) { // ImageData -> new ImageData
    var m = matrixFor(typeId, sev), d = src.data, out = new ImageData(src.width, src.height), o = out.data;
    for (var i = 0; i < d.length; i += 4) {
      var r = TO_LIN[d[i]], g = TO_LIN[d[i + 1]], b = TO_LIN[d[i + 2]];
      o[i] = lin2srgb(m[0] * r + m[1] * g + m[2] * b);
      o[i + 1] = lin2srgb(m[3] * r + m[4] * g + m[5] * b);
      o[i + 2] = lin2srgb(m[6] * r + m[7] * g + m[8] * b);
      o[i + 3] = d[i + 3];
    }
    return out;
  }
  function simPixel(rgb, typeId, sev) {
    var id = new ImageData(new Uint8ClampedArray([rgb[0], rgb[1], rgb[2], 255]), 1, 1), r = simulateData(id, typeId, sev).data;
    return [r[0], r[1], r[2]];
  }

  // ---------- state ----------
  var o = Object.assign({ type: "deuteranomaly", sev: 60, view: "split" }, S3.store("cbsim") || {});
  if (!byId[o.type]) o.type = "deuteranomaly";
  var img = null; // {full: canvas, disp: ImageData, thumb: ImageData, name, base}
  var split = 50;
  var MAX_FULL = 24e6, MAX_DISP = 1600, THUMB = 360;
  function saveOpts() { S3.store("cbsim", o); }

  TYPES.forEach(function (t) { $("#type").appendChild(h("option", { value: t.id, text: t.name + " (" + t.short + ")" })); });
  $("#type").value = o.type;
  $("#sev").value = o.sev;

  function scaledCanvas(source, w, hh, max, maxPx) {
    var k = Math.min(1, max ? max / Math.max(w, hh) : 1, maxPx ? Math.sqrt(maxPx / (w * hh)) : 1);
    var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(hh * k));
    c.getContext("2d").drawImage(source, 0, 0, c.width, c.height);
    return c;
  }
  function dataOf(c) { return c.getContext("2d").getImageData(0, 0, c.width, c.height); }

  async function loadFile(file) {
    var bmp;
    try { bmp = await createImageBitmap(file); } catch (e) { S3.toast("This browser can't open that image", "error"); return; }
    setImage(bmp, bmp.width, bmp.height, file.name);
    if (bmp.close) bmp.close();
  }
  function setImage(source, w, hh, name) {
    var full = scaledCanvas(source, w, hh, 0, MAX_FULL);
    var disp = scaledCanvas(full, full.width, full.height, MAX_DISP), th = scaledCanvas(full, full.width, full.height, THUMB);
    img = { full: full, disp: dataOf(disp), thumb: dataOf(th), name: name, base: name.replace(/\.[^.]+$/, "") || "image", w: w, h: hh };
    $("#drop").hidden = true; $("#startRow").hidden = true; $("#work").hidden = false; $("#allCard").hidden = false;
    $("#fname").textContent = name; $("#fmeta").textContent = w + " × " + hh;
    var cO = $("#cvO"); cO.width = img.disp.width; cO.height = img.disp.height; cO.getContext("2d").putImageData(img.disp, 0, 0);
    buildGrid(); render();
  }

  // ---------- rendering ----------
  function render() {
    var t = byId[o.type];
    $("#sevWrap").hidden = !t.sev; $("#sevV").textContent = o.sev + "%";
    $("#infoTitle").textContent = t.name + ": " + t.short;
    $("#infoText").textContent = t.text; $("#infoWho").textContent = t.who;
    $$("#view button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === o.view)); });
    if (!img) return;
    var cS = $("#cvS"); cS.width = img.disp.width; cS.height = img.disp.height;
    cS.getContext("2d").putImageData(simulateData(img.disp, o.type, o.sev / 100), 0, 0);
    $("#simTag").textContent = t.name + (t.sev ? " " + o.sev + "%" : "");
    var st = $("#stage"); st.className = "cb-stage v-" + o.view;
    $("#hint").hidden = o.view !== "split";
    placeSplit();
    $$(".cb-cell").forEach(function (c) { c.classList.toggle("is-on", c.dataset.t === o.type); });
    $$(".cb-cell").forEach(function (c) { if (byId[c.dataset.t].sev) paintThumb(c); });
  }
  function placeSplit() {
    var cv = $("#cvS"), pane = cv.parentNode;
    if (o.view !== "split") { pane.style.clipPath = ""; return; }
    var pr = pane.getBoundingClientRect(), r = cv.getBoundingClientRect(), sr = $("#stage").getBoundingClientRect();
    var x = r.left + r.width * split / 100;
    pane.style.clipPath = "inset(0 0 0 " + Math.max(0, x - pr.left) + "px)";
    $("#handle").style.left = (x - sr.left) + "px";
    $("#handle").setAttribute("aria-valuenow", String(Math.round(split)));
  }
  function buildGrid() {
    var g = $("#grid"); g.textContent = "";
    TYPES.forEach(function (t) {
      var c = h("canvas", { width: img.thumb.width, height: img.thumb.height });
      var cell = h("button", { "class": "cb-cell", type: "button", "data-t": t.id, onclick: function () { pick(t.id); $("#stage").scrollIntoView({ behavior: "smooth", block: "center" }); } },
        [h("span", { "class": "cb-thumb checker" }, [c]), h("b", { text: t.name }), h("span", { "class": "faint", text: t.short })]);
      g.appendChild(cell);
      paintThumb(cell);
    });
  }
  function paintThumb(cell) {
    var t = byId[cell.dataset.t];
    cell.querySelector("canvas").getContext("2d").putImageData(simulateData(img.thumb, t.id, o.sev / 100), 0, 0);
  }
  function pick(id) { o.type = id; $("#type").value = id; saveOpts(); render(); }

  // ---------- controls ----------
  $("#type").addEventListener("change", function () { pick(this.value); });
  $("#sev").addEventListener("input", function () { o.sev = +this.value; render(); });
  $("#sev").addEventListener("change", saveOpts);
  $$("#view button").forEach(function (b) { b.addEventListener("click", function () { o.view = b.dataset.v; saveOpts(); render(); }); });
  var input = S3.drop($("#drop"), function (f) { loadFile(f[0]); }, { accept: "image/*", multiple: false });
  $("#another").addEventListener("click", function () { input.click(); });
  $("#sample").addEventListener("click", function () { var c = sampleImage(); setImage(c, c.width, c.height, "sample-dashboard.png"); });
  document.addEventListener("paste", function (e) {
    var it = Array.from((e.clipboardData && e.clipboardData.items) || []).find(function (i) { return i.kind === "file" && /^image\//.test(i.type); });
    if (!it) return; e.preventDefault(); loadFile(new File([it.getAsFile()], "pasted-image.png", { type: it.type }));
  });
  var stage = $("#stage");
  stage.addEventListener("pointerdown", function (e) {
    if (o.view !== "split" || e.button) return;
    stage.setPointerCapture(e.pointerId);
    function mv(ev) {
      var r = $("#cvS").getBoundingClientRect();
      split = Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * 100)); placeSplit();
    }
    mv(e);
    function up() { stage.removeEventListener("pointermove", mv); stage.removeEventListener("pointerup", up); stage.removeEventListener("pointercancel", up); }
    stage.addEventListener("pointermove", mv); stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  });
  $("#handle").addEventListener("keydown", function (e) {
    var d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0; if (!d) return;
    e.preventDefault(); split = Math.max(0, Math.min(100, split + d * (e.shiftKey ? 10 : 2))); placeSplit();
  });
  window.addEventListener("resize", S3.debounce(function () { if (img) placeSplit(); }, 100));
  new ResizeObserver(function () { if (img) placeSplit(); }).observe(stage);

  function fullSim(id) {
    var c = document.createElement("canvas"); c.width = img.full.width; c.height = img.full.height;
    c.getContext("2d").putImageData(simulateData(dataOf(img.full), id, o.sev / 100), 0, 0);
    return c;
  }
  function slug(t) { return t.id + (t.sev ? "-" + o.sev : ""); }
  function pngOf(c) { return new Promise(function (r) { c.toBlob(r, "image/png"); }); }
  $("#dl").addEventListener("click", async function () {
    if (!img) return;
    var t = byId[o.type];
    S3.download(await pngOf(fullSim(t.id)), img.base + "-" + slug(t) + ".png"); S3.done();
  });
  $("#zip").addEventListener("click", async function () {
    if (!img) return;
    var b = this; b.disabled = true;
    try {
      var files = [{ name: img.base + "-original.png", data: new Uint8Array(await (await pngOf(img.full)).arrayBuffer()) }];
      for (var i = 0; i < TYPES.length; i++) {
        files.push({ name: img.base + "-" + slug(TYPES[i]) + ".png", data: new Uint8Array(await (await pngOf(fullSim(TYPES[i].id))).arrayBuffer()) });
      }
      S3.download(S3.zip(files), img.base + "-colorblind.zip"); S3.done();
    } finally { b.disabled = false; }
  });
  render();

  // ---------- sample image (also used for the README screenshot) ----------
  function sampleImage() {
    var W = 1200, H = 640, c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d"), f = "Arial, Helvetica, sans-serif";
    g.fillStyle = "#f6f7fb"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#1d2433"; g.font = "700 34px " + f; g.fillText("Sales by region", 48, 70);
    g.fillStyle = "#6b7385"; g.font = "18px " + f; g.fillText("Q1 to Q4, in thousands", 48, 100);
    var series = [["#d62728", [42, 55, 61, 70]], ["#2ca02c", [38, 52, 66, 64]], ["#1f77b4", [30, 34, 45, 58]], ["#ff7f0e", [22, 30, 28, 41]]];
    var x0 = 70, y0 = 560, bw = 26;
    g.strokeStyle = "#d5d9e3"; g.lineWidth = 1;
    for (var y = 0; y <= 4; y++) { g.beginPath(); g.moveTo(x0 - 10, y0 - y * 100); g.lineTo(700, y0 - y * 100); g.stroke(); }
    for (var q = 0; q < 4; q++) {
      series.forEach(function (s, k) { g.fillStyle = s[0]; var v = s[1][q] * 5; g.fillRect(x0 + q * 155 + k * (bw + 6), y0 - v, bw, v); });
      g.fillStyle = "#6b7385"; g.font = "16px " + f; g.fillText("Q" + (q + 1), x0 + q * 155 + 48, y0 + 28);
    }
    var names = ["North", "South", "East", "West"];
    series.forEach(function (s, k) { g.fillStyle = s[0]; g.fillRect(760, 150 + k * 44, 26, 26); g.fillStyle = "#1d2433"; g.font = "600 20px " + f; g.fillText(names[k], 800, 170 + k * 44); });
    // traffic-light status pills
    [["#2ca02c", "Online"], ["#ffbf00", "Degraded"], ["#d62728", "Down"]].forEach(function (p, k) {
      var px = 760 + (k % 3) * 140, py = 380;
      g.fillStyle = p[0]; g.beginPath(); g.arc(px + 14, py, 14, 0, 7); g.fill();
      g.fillStyle = "#1d2433"; g.font = "18px " + f; g.fillText(p[1], px + 36, py + 6);
    });
    // spectrum strip
    var gr = g.createLinearGradient(760, 0, 1150, 0);
    ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"].forEach(function (col, i) { gr.addColorStop(i / 5, col); });
    g.fillStyle = gr; g.fillRect(760, 450, 390, 50);
    g.fillStyle = "#6b7385"; g.font = "16px " + f; g.fillText("Full spectrum", 760, 530);
    return c;
  }
  window.S3_DEMO = function () {
    o.type = "deuteranopia"; o.view = "split"; $("#type").value = o.type;
    var c = sampleImage(); setImage(c, c.width, c.height, "sample-dashboard.png");
    split = 50; render();
  };

  // ---------- self-test: known outputs of the Machado matrices ----------
  window.S3_SELFTEST = function () {
    function near(a, b) { return a.every(function (v, i) { return Math.abs(v - b[i]) <= 1; }); }
    var ok = true;
    for (var v = 0; v < 256; v++) if (lin2srgb(TO_LIN[v]) !== v) ok = false;           // sRGB <-> linear round trip
    ok = ok && near(simPixel([255, 0, 0], "protanopia"), [109, 95, 0]);                // red, protanopia: dark olive
    ok = ok && near(simPixel([255, 0, 0], "deuteranopia"), [163, 144, 0]);             // red, deuteranopia: mustard
    ok = ok && near(simPixel([0, 255, 0], "deuteranopia"), [239, 214, 58]);            // green, deuteranopia: yellow
    ok = ok && near(simPixel([0, 0, 255], "tritanopia"), [0, 107, 150]);               // blue, tritanopia: teal
    ok = ok && near(simPixel([0, 255, 0], "achromatopsia"), [220, 220, 220]);          // green -> Rec.709 luminance grey
    TYPES.forEach(function (t) { ok = ok && near(simPixel([255, 255, 255], t.id, 0.6), [255, 255, 255]) && near(simPixel([0, 0, 0], t.id, 0.6), [0, 0, 0]); });
    ok = ok && near(simPixel([200, 60, 30], "protanomaly", 0), [200, 60, 30]) && near(simPixel([255, 0, 0], "protanomaly", 1), [109, 95, 0]);
    var mid = simPixel([255, 0, 0], "protanomaly", 0.5);                               // halfway in linear light
    ok = ok && near(mid, [lin2srgb(0.5 + 0.5 * 0.152286), lin2srgb(0.5 * 0.114503), 0]);
    var id = new ImageData(new Uint8ClampedArray([255, 0, 0, 77, 10, 20, 30, 0]), 2, 1), out = simulateData(id, "deuteranopia", 1);
    ok = ok && out.width === 2 && out.data[3] === 77 && out.data[7] === 0;              // alpha untouched
    return ok;
  };
})();
