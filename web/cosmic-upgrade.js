/* COSMIC MOTION SYSTEM
   GSAP + Lenis orchestrate motion; Vanta FOG is an adaptive desktop atmosphere;
   the starfield/orbits are a light canvas/CSS fallback. React Bits patterns are
   translated to vanilla DOM because this product is deliberately not a React app.
*/
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const mobile = window.matchMedia("(max-width: 700px)").matches;
  const gsap = window.gsap;
  const ambient = $(".ambient");

  if (!ambient) return;

  // Build a single canvas starfield. It is capped, throttled and paused in background tabs.
  const starCanvas = document.createElement("canvas");
  starCanvas.id = "cosmicStars";
  starCanvas.setAttribute("aria-hidden", "true");
  ambient.prepend(starCanvas);
  const ctx = starCanvas.getContext("2d", { alpha: true });
  let width = 0, height = 0, dpr = 1, stars = [], shooting = null;
  let rafId = 0, lastFrame = 0, lastShot = 0, shotDelay = 6200;

  function resizeStars() {
    width = Math.max(1, ambient.clientWidth || innerWidth);
    height = Math.max(1, ambient.clientHeight || innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 1.15);
    starCanvas.width = Math.round(width * dpr);
    starCanvas.height = Math.round(height * dpr);
    starCanvas.style.width = width + "px";
    starCanvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const amount = Math.max(420, Math.min(1320, Math.round(width * height / 2050)));
    stars = Array.from({ length: amount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: .35 + Math.random() * 1.05,
      a: .2 + Math.random() * .7,
      phase: Math.random() * Math.PI * 2,
      speed: .22 + Math.random() * .7,
      hue: Math.random() < .18 ? 205 + Math.random() * 35 : 225 + Math.random() * 35
    }));
  }

  function drawStars(time) {
    if (document.hidden || !ctx) return;
    if (!reduced) rafId = requestAnimationFrame(drawStars);
    if (time - lastFrame < 38) return; // ~26 fps is enough for distant stars.
    lastFrame = time;
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      const twinkle = reduced ? 1 : .56 + Math.sin(time * .001 * star.speed + star.phase) * .3;
      ctx.globalAlpha = Math.max(.08, Math.min(1, star.a * twinkle));
      ctx.fillStyle = "hsl(" + star.hue + " 92% 88%)";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
      if (star.r > 1.08) {
        ctx.globalAlpha *= .42;
        ctx.fillRect(star.x - 2.4, star.y - .35, 4.8, .7);
        ctx.fillRect(star.x - .35, star.y - 2.4, .7, 4.8);
      }
    }
    ctx.globalAlpha = 1;

    if (!reduced && time - lastShot > shotDelay && !shooting) {
      shooting = { x: Math.random() * width * .7 + width * .15, y: Math.random() * height * .35, vx: 8 + Math.random() * 4, vy: 3 + Math.random() * 2, life: 0 };
      lastShot = time;
      shotDelay = 7200 + Math.random() * 9600;
    }
    if (shooting) {
      const s = shooting;
      s.x += s.vx; s.y += s.vy; s.life++;
      const alpha = Math.max(0, 1 - s.life / 31);
      const trail = ctx.createLinearGradient(s.x - s.vx * 12, s.y - s.vy * 12, s.x, s.y);
      trail.addColorStop(0, "rgba(126,151,255,0)");
      trail.addColorStop(1, "rgba(164,224,255," + alpha + ")");
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.15;
      ctx.beginPath(); ctx.moveTo(s.x - s.vx * 12, s.y - s.vy * 12); ctx.lineTo(s.x, s.y); ctx.stroke();
      if (s.life > 31) shooting = null;
    }
  }

  resizeStars();
  if (!reduced) rafId = requestAnimationFrame(drawStars);
  else drawStars(0);
  const resizeObserver = new ResizeObserver(resizeStars);
  resizeObserver.observe(ambient);
  window.addEventListener("resize", resizeStars, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else if (!reduced) rafId = requestAnimationFrame(drawStars);
  });

  // Orbit details frame the live Three.js Earth without covering its controls.
  const globeStage = $("#globeStage");
  if (globeStage && !$(".cosmic-orbit", globeStage)) {
    const halo = document.createElement("div");
    halo.className = "cosmic-halo";
    halo.setAttribute("aria-hidden", "true");
    const orbitA = document.createElement("div");
    orbitA.className = "cosmic-orbit orbit-one";
    orbitA.setAttribute("aria-hidden", "true");
    const dot = document.createElement("span");
    dot.className = "satellite-dot";
    orbitA.appendChild(dot);
    const orbitB = document.createElement("div");
    orbitB.className = "cosmic-orbit orbit-two";
    orbitB.setAttribute("aria-hidden", "true");
    globeStage.append(halo, orbitA, orbitB);
  }

  // Lenis is limited to desktop wheel/trackpad scrolling; mobile retains native touch scroll.
  let lenis = null, lenisTicker = null;
  const scrollArea = $("#scrollArea"), pageContent = $("#page");
  if (!reduced && finePointer && !mobile && window.Lenis && gsap && scrollArea && pageContent) {
    try {
      lenis = new window.Lenis({
        wrapper: scrollArea,
        content: pageContent,
        smoothWheel: true,
        syncTouch: false,
        lerp: .085,
        wheelMultiplier: .88,
        touchMultiplier: 1,
        overscroll: true
      });
      lenisTicker = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(lenisTicker);
      gsap.ticker.lagSmoothing(0);
      lenis.on("scroll", (event) => {
        const progress = $(".cosmic-scroll-progress");
        if (progress) progress.style.transform = "scaleX(" + Math.max(0, Math.min(1, event.progress || 0)) + ")";
      });
      document.addEventListener("click", (event) => {
        if (event.target.closest("[data-page]")) {
          window.setTimeout(() => lenis && lenis.scrollTo(0, { immediate: true, force: true }), 0);
        }
      });
      window.addEventListener("beforeunload", () => {
        if (lenisTicker) gsap.ticker.remove(lenisTicker);
        if (lenis) lenis.destroy();
      }, { once: true });
      document.documentElement.classList.add("cosmic-lenis-ready");
    } catch (error) {
      console.warn("Lenis enhancement skipped; native scrolling remains active.", error);
    }
  }

  // Slim telemetry line reinforces the mission-console language without adding a sticky bar.
  const topbar = $(".topbar");
  if (topbar && !$(".cosmic-scroll-progress", topbar)) {
    const progress = document.createElement("span");
    progress.className = "cosmic-scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    topbar.appendChild(progress);
  }

  // Cinematic page entrances, with only transform and opacity in the animated path.
  const revealSelector = ".page-head,.panel,.signal,.stat-card,.feature-grid > button,.mission-card,.notice,.toolbar,.launch-grid > button";
  const revealed = new WeakSet();
  function revealWithin(view) {
    if (!view || !gsap || reduced) return;
    const nodes = [];
    if (view.matches(revealSelector) && !revealed.has(view)) nodes.push(view);
    view.querySelectorAll(revealSelector).forEach((node) => {
      if (!revealed.has(node)) nodes.push(node);
    });
    if (!nodes.length) return;
    nodes.forEach((node) => revealed.add(node));
    gsap.fromTo(nodes,
      { y: 14, autoAlpha: 0 },
      {
        y: 0, autoAlpha: 1, duration: .54, stagger: .042,
        ease: "power3.out", clearProps: "transform,opacity,visibility",
        overwrite: "auto"
      }
    );
  }

  function revealActivePage() {
    const active = $('.page-view.active');
    if (active) revealWithin(active);
  }

  // The app's own router remains the source of truth; this observer only enhances the active view.
  const pageRoot = $("#page");
  if (pageRoot) {
    const pageObserver = new MutationObserver((records) => {
      const active = $('.page-view.active', pageRoot);
      if (!active) return;
      const changed = records.some((record) =>
        (record.type === "attributes" && record.target.classList.contains("page-view")) ||
        (record.type === "childList" && record.addedNodes.length)
      );
      if (changed) window.setTimeout(() => revealWithin(active), 70);
    });
    pageObserver.observe(pageRoot, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    window.setTimeout(revealActivePage, 760);
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-page]")) window.setTimeout(revealActivePage, 100);
    });
  }

  // A localized cursor spotlight gives cards a depth cue without moving their layout.
  if (finePointer) {
    let pointerFrame = 0, pointerEvent = null;
    document.addEventListener("pointermove", (event) => {
      pointerEvent = event;
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!pointerEvent) return;
        const target = pointerEvent.target.closest(".panel,.mission-card,.feature-grid button,.launch-grid button,.stat-card");
        if (!target) return;
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--spot-x", ((pointerEvent.clientX - rect.left) / Math.max(1, rect.width) * 100) + "%");
        target.style.setProperty("--spot-y", ((pointerEvent.clientY - rect.top) / Math.max(1, rect.height) * 100) + "%");
      });
    }, { passive: true });
  }

  // Gentle scene parallax is restricted to a fine pointer and uses a single shared listener.
  if (finePointer && !reduced) {
    let lastPointer = 0;
    window.addEventListener("pointermove", (event) => {
      const now = performance.now();
      if (now - lastPointer < 45) return;
      lastPointer = now;
      const dx = (event.clientX / Math.max(1, innerWidth) - .5);
      const dy = (event.clientY / Math.max(1, innerHeight) - .5);
      starCanvas.style.transform = "translate3d(" + (dx * -7).toFixed(1) + "px," + (dy * -5).toFixed(1) + "px,0)";
      const glow = $(".g1");
      if (glow && gsap) gsap.to(glow, { x: dx * 13, y: dy * 10, duration: 1.2, ease: "power3.out", overwrite: "auto" });
    }, { passive: true });
  }

  // Vanta's volumetric FOG is an optional premium layer on capable desktop GPUs.
  // CSS nebula + Canvas stars remain the complete fallback when WebGL/CDN is unavailable.
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-cosmic-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.cosmicSrc = src;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initVolumetricFog() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    if (reduced || !finePointer || innerWidth < 1180 || cores < 6 || memory < 6) return;
    try {
      await loadScript("https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.fog.min.js");
      if (!window.VANTA || !window.VANTA.FOG || !window.THREE) return;
      const effect = window.VANTA.FOG({
        el: ambient,
        THREE: window.THREE,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: .72,
        scaleMobile: .35,
        highlightColor: 0x6254d8,
        midtoneColor: 0x243d86,
        lowlightColor: 0x101d49,
        baseColor: 0x030611,
        blurFactor: .68,
        speed: .55,
        zoom: .78
      });
      window.__EARTHSCOPE_COSMIC_FOG__ = effect;
      ambient.dataset.cosmicFog = "active";
      window.addEventListener("beforeunload", () => effect.destroy(), { once: true });
    } catch (error) {
      console.info("Volumetric nebula unavailable; CSS atmosphere remains active.", error);
    }
  }

  // Start heavy WebGL only after the dashboard has rendered its actual workspace.
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => initVolumetricFog(), { timeout: 5200 });
  } else {
    window.setTimeout(initVolumetricFog, 2600);
  }

  document.documentElement.classList.add("cosmic-enhancements-ready");
})();
