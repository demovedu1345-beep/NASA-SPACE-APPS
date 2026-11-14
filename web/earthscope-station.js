/**
 * EARTHSCOPE — NASA Earth System Trend Detective Station Controller
 * Fully integrated with MapLibre GL, Apache ECharts, and NASA APIs.
 */

(function () {
  'use strict';

  // State
  window.earthscopeStation = {
    lat: 12.3375,
    lon: 75.8069,
    place: 'Kodagu Rainforest',
    sub: 'Western Ghats, India',
    activeVars: ['ndvi', 't2m', 'precipitation', 'lst_day'],
    currentPriority: 'ALL',
    activeTab: 'trends',
    lastInvestigation: null,
    map: null,
    chart: null,
    marker: null
  };

  const S = window.earthscopeStation;

  // Initialize MapLibre
  function initMap() {
    const container = document.getElementById('earthscopeMap');
    if (!container || typeof maplibregl === 'undefined') return;

    try {
      S.map = new maplibregl.Map({
        container: 'earthscopeMap',
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19
            }
          ]
        },
        center: [S.lon, S.lat],
        zoom: 9
      });

      S.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

      S.marker = new maplibregl.Marker({ color: '#78D6A9' })
        .setLngLat([S.lon, S.lat])
        .addTo(S.map);

      S.map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        selectCoordinates(lat, lng, `Custom Point (${lat.toFixed(3)}, ${lng.toFixed(3)})`, 'User Selected Bounding Box');
      });
    } catch (e) {
      console.warn('MapLibre init error:', e);
    }
  }

  // Initialize Apache ECharts
  function initChart() {
    const container = document.getElementById('earthscopeChart');
    if (!container || typeof echarts === 'undefined') return;

    try {
      S.chart = echarts.init(container, null, { renderer: 'canvas' });
      const option = {
        backgroundColor: 'transparent',
        title: {
          text: 'Earth System Decadal Observations & Sen\'s Slope Trajectory',
          left: 'center',
          textStyle: { color: '#ffffff', fontFamily: 'Roboto Serif', fontSize: 13, fontWeight: 600 }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#0c0c14',
          borderColor: 'rgba(255,255,255,0.15)',
          textStyle: { color: '#F2F2F7', fontFamily: 'Roboto Mono', fontSize: 11 }
        },
        grid: { left: '10%', right: '5%', bottom: '15%', top: '18%' },
        xAxis: {
          type: 'category',
          data: [],
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
          axisLabel: { color: '#8E8E93', fontFamily: 'Roboto Mono', fontSize: 10 }
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
          axisLabel: { color: '#8E8E93', fontFamily: 'Roboto Mono', fontSize: 10 }
        },
        series: []
      };
      S.chart.setOption(option);
      window.addEventListener('resize', () => { if (S.chart) S.chart.resize(); });
    } catch (e) {
      console.warn('ECharts init error:', e);
    }
  }

  // Update ECharts with Investigation Result
  function updateChart(data) {
    if (!S.chart || !data || !data.results) return;

    // Pick first active variable for detailed view
    const primaryVar = S.activeVars[0] || Object.keys(data.results)[0];
    const vData = data.results[primaryVar];
    if (!vData || !vData.recent_series) return;

    const dates = vData.recent_series.map(d => d.date);
    const vals = vData.recent_series.map(d => d.value);
    const meta = vData.metadata;
    const stats = vData.statistics;
    const slopeObs = stats.sens_slope.slope_per_observation;

    // Compute Sen's slope line across series
    const n = vals.length;
    const meanY = vals.reduce((a, b) => a + b, 0) / n;
    const midIdx = Math.floor(n / 2);
    const trendLine = vals.map((_, i) => roundNum(meanY + (i - midIdx) * slopeObs, 4));

    // CI bands
    const ciUpper = trendLine.map(v => roundNum(v + Math.abs(stats.sens_slope.ci_95_per_year[1] / 24.0), 4));
    const ciLower = trendLine.map(v => roundNum(v - Math.abs(stats.sens_slope.ci_95_per_year[0] / 24.0), 4));

    const option = {
      title: {
        text: `${meta.name} (${meta.product_id}) — Sen's Slope: ${stats.sens_slope.slope_per_year > 0 ? '+' : ''}${stats.sens_slope.slope_per_year} ${meta.unit.split(' ')[0]}/yr`,
        subtext: `Mann-Kendall p = ${stats.mann_kendall.p_value.toFixed(4)} • Kendall's τ = ${stats.mann_kendall.tau.toFixed(3)} (${stats.classification})`,
        textStyle: { color: '#ffffff', fontFamily: 'Roboto Serif', fontSize: 13.5, fontWeight: 700 },
        subtextStyle: { color: '#78D6A9', fontFamily: 'Roboto Mono', fontSize: 10.5 }
      },
      xAxis: { data: dates },
      yAxis: {
        name: meta.unit.split(' ')[0],
        nameTextStyle: { color: '#8E8E93', fontFamily: 'Roboto Mono', fontSize: 9.5 }
      },
      legend: {
        data: ['Observed Monthly Values', 'Sen\'s Median Trajectory', '95% CI Range'],
        top: '8%',
        textStyle: { color: '#AEAEB2', fontFamily: 'Roboto Mono', fontSize: 10 }
      },
      series: [
        {
          name: '95% CI Range',
          type: 'line',
          data: ciUpper,
          lineStyle: { opacity: 0 },
          stack: 'confidence-band',
          symbol: 'none'
        },
        {
          name: '95% CI Range',
          type: 'line',
          data: ciLower.map((l, idx) => roundNum(ciUpper[idx] - l, 4)),
          lineStyle: { opacity: 0 },
          areaStyle: { color: 'rgba(120, 214, 169, 0.12)' },
          stack: 'confidence-band',
          symbol: 'none'
        },
        {
          name: 'Observed Monthly Values',
          type: 'line',
          data: vals,
          itemStyle: { color: '#78D6A9' },
          lineStyle: { color: '#78D6A9', width: 2 },
          smooth: true,
          symbolSize: 6
        },
        {
          name: 'Sen\'s Median Trajectory',
          type: 'line',
          data: trendLine,
          itemStyle: { color: '#f43f5e' },
          lineStyle: { color: '#f43f5e', width: 2.5, type: 'dashed' },
          symbol: 'none'
        }
      ]
    };

    S.chart.setOption(option);
  }

  function roundNum(num, dec) {
    const f = Math.pow(10, dec);
    return Math.round(num * f) / f;
  }

  // Run Trend Investigation
  window.runEarthscopeTrends = async function () {
    const btn = document.getElementById('btnRunTrends');
    if (btn) btn.innerHTML = '⏳ Computing Mann-Kendall...';

    const cardsContainer = document.getElementById('trendCardsContainer');
    if (cardsContainer) {
      cardsContainer.innerHTML = '<div class="station-empty-state">Computing non-parametric Mann-Kendall and Sen\'s slope across NASA observations...</div>';
    }

    try {
      const res = await fetch('/api/earth/trends/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: S.lat,
          lon: S.lon,
          region_name: S.place,
          variables: S.activeVars,
          start_year: 2015,
          end_year: 2024,
          alpha: 0.05
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Trend calculation failed');

      S.lastInvestigation = data;
      renderTrendCards(data);
      renderStatisticalLab(data);
      renderCorrelations(data);
      renderAnalyst(data);
      updateChart(data);
    } catch (e) {
      console.error('Trend analysis error:', e);
      if (cardsContainer) {
        cardsContainer.innerHTML = `<div style="color:#f43f5e; padding:16px;">Error: ${e.message}</div>`;
      }
    } finally {
      if (btn) btn.innerHTML = '▶ Run Trend Detective';
    }
  };

  // Render Fingerprint Cards
  function renderTrendCards(data) {
    const container = document.getElementById('trendCardsContainer');
    if (!container || !data.results) return;

    let html = '';
    for (const [vid, res] of Object.entries(data.results)) {
      const meta = res.metadata;
      const st = res.statistics;
      const isSig = st.mann_kendall.significant;
      const isInc = st.sens_slope.slope_per_year > 0;
      const sigColor = isSig ? (isInc ? '#22c55e' : '#f43f5e') : '#8E8E93';
      const sigBg = isSig ? (isInc ? 'rgba(34,197,94,0.15)' : 'rgba(244,63,94,0.15)') : 'rgba(255,255,255,0.06)';
      const prio = meta.priority || 'P0';
      const prioClass = prio === 'P0' ? 'tier-p0' : prio === 'P1' ? 'tier-p1' : 'tier-p2';

      html += `
        <article class="fingerprint-card">
          <div class="fp-header">
            <div class="fp-title-group">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                <span class="tier-tag ${prioClass}">[${prio}]</span>
                <span style="font-family:var(--es-font-mono); font-size:10px; color:var(--es-text-muted); text-transform:uppercase;">${meta.dataset || meta.mission} • ${meta.product_id}</span>
                <span style="font-family:var(--es-font-mono); font-size:9.5px; color:#AEAEB2; background:rgba(255,255,255,0.05); padding:1px 5px; border-radius:3px;">${meta.best_access_method}</span>
              </div>
              <h4>${meta.name}</h4>
            </div>
            <span style="font-family:var(--es-font-mono); font-size:10.5px; font-weight:700; color:${sigColor}; background:${sigBg}; padding:4px 10px; border-radius:9999px;">
              ${st.classification}
            </span>
          </div>

          <div class="fp-metrics-grid">
            <div class="fp-cell">
              <small>SEN'S MEDIAN SLOPE</small>
              <strong style="color:${sigColor};">${st.sens_slope.slope_per_year > 0 ? '+' : ''}${st.sens_slope.slope_per_year.toFixed(4)}</strong>
              <span>${meta.unit.split(' ')[0]}/yr</span>
            </div>
            <div class="fp-cell">
              <small>95% CONFIDENCE</small>
              <strong style="font-size:11.5px;">[${st.sens_slope.ci_95_per_year[0].toFixed(3)}, ${st.sens_slope.ci_95_per_year[1].toFixed(3)}]</strong>
              <span>Rank Gilbert Interval</span>
            </div>
            <div class="fp-cell">
              <small>MANN-KENDALL p</small>
              <strong style="color:${st.mann_kendall.p_value < 0.05 ? 'var(--es-mint)' : '#AEAEB2'};">${st.mann_kendall.p_value.toFixed(4)}</strong>
              <span>α = 0.05 threshold</span>
            </div>
            <div class="fp-cell">
              <small>KENDALL'S τ</small>
              <strong>${st.mann_kendall.tau > 0 ? '+' : ''}${st.mann_kendall.tau.toFixed(3)}</strong>
              <span>Relative Concordance</span>
            </div>
          </div>
        </article>
      `;
    }
    container.innerHTML = html;
  }

  // Render Statistical Lab
  function renderStatisticalLab(data) {
    const container = document.getElementById('statLabContainer');
    if (!container || !data.results) return;

    let html = '';
    for (const [vid, res] of Object.entries(data.results)) {
      const meta = res.metadata;
      const st = res.statistics;
      const mk = st.mann_kendall;
      const smk = st.seasonal_mann_kendall;
      const ac = st.autocorrelation_diagnostics || {};
      const fdr = st.multiple_testing_fdr || {};

      html += `
        <article class="fingerprint-card">
          <div class="fp-header">
            <div>
              <span class="tier-tag tier-p0" style="font-size:9.5px;">${meta.product_id}</span>
              <h4 style="margin-top:3px;">${meta.name} — Statistical Rigor Audit</h4>
            </div>
            <span style="font-family:var(--es-font-mono); font-size:11px; color:var(--es-mint);">N = ${mk.n} Epochs</span>
          </div>

          <div class="fp-metrics-grid" style="grid-template-columns: repeat(4, 1fr);">
            <div class="fp-cell">
              <small>S-STATISTIC</small>
              <strong>${mk.s > 0 ? '+' : ''}${mk.s}</strong>
              <span>Pairwise Concordance</span>
            </div>
            <div class="fp-cell">
              <small>NORMAL Z-SCORE</small>
              <strong>${mk.z.toFixed(4)}</strong>
              <span>Var(S) = ${mk.var_s}</span>
            </div>
            <div class="fp-cell">
              <small>LAG-1 AUTOCORRELATION (r₁)</small>
              <strong style="color:${ac.is_autocorrelated ? '#f43f5e' : 'var(--es-mint)'};">${ac.lag1_r1 || '0.0000'}</strong>
              <span>${ac.is_autocorrelated ? 'Serial Dependence Active' : 'Independent Series'}</span>
            </div>
            <div class="fp-cell">
              <small>FDR ADJUSTED q-VALUE</small>
              <strong style="color:${fdr.fdr_significant ? 'var(--es-mint)' : '#AEAEB2'};">${fdr.benjamini_hochberg_q ? fdr.benjamini_hochberg_q.toFixed(4) : mk.p_value.toFixed(4)}</strong>
              <span>Benjamini-Hochberg</span>
            </div>
          </div>

          <div style="background:rgba(120,214,169,0.06); border:1px solid rgba(120,214,169,0.2); border-radius:6px; padding:10px; font-family:var(--es-font-mono); font-size:11px;">
            <b>Seasonal Mann-Kendall:</b> Seasonal Z = <b>${smk.seasonal_z.toFixed(3)}</b>, Seasonal p = <b>${smk.seasonal_p_value.toFixed(5)}</b>.<br>
            <b>Effective Sample Size:</b> N* = <b>${ac.effective_sample_size || mk.n}</b> (adjusted for serial persistence).<br>
            <b>Hypothesis Decision:</b> ${mk.p_value < 0.05 ? 'Reject H₀ in favor of H₁ (statistically significant monotonic trend detected at α = 0.05).' : 'Fail to reject H₀ (observed variability does not exceed random noise threshold at α = 0.05).'}
          </div>
        </article>
      `;
    }
    container.innerHTML = html;
  }

  // Render Biophysical Correlations
  function renderCorrelations(data) {
    const container = document.getElementById('correlationsContainer');
    if (!container || !data.correlation_matrix) return;

    let html = '';
    for (const [pair, c] of Object.entries(data.correlation_matrix)) {
      const r = c.pearson_r;
      const rColor = r > 0.5 ? '#22c55e' : r < -0.5 ? '#f43f5e' : '#38bdf8';

      html += `
        <article class="fingerprint-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-family:var(--es-font-serif); font-size:14px; color:#fff;">${c.variable_a.toUpperCase()} ⟷ ${c.variable_b.toUpperCase()}</strong>
            <span style="font-family:var(--es-font-mono); font-size:13.5px; font-weight:700; color:${rColor};">r = ${r > 0 ? '+' : ''}${r.toFixed(4)}</span>
          </div>
          <p style="font-family:var(--es-font-mono); font-size:11.5px; color:var(--es-text-muted); margin:4px 0;">Observed Feedback: <b>${c.relationship}</b></p>
          <small style="font-size:10.5px; color:var(--es-text-subtle);">${c.caveat}</small>
        </article>
      `;
    }
    container.innerHTML = html;
  }

  // Render AI Analyst Summary
  function renderAnalyst(data) {
    const p = document.getElementById('aiAnalystSummaryText');
    if (p && data.ai_research_analyst) {
      p.innerText = data.ai_research_analyst.grounded_interpretation;
    }
  }

  // Priority Filter
  window.filterPriority = function (priority, btn) {
    S.currentPriority = priority;
    const parent = btn.parentElement;
    if (parent) {
      parent.querySelectorAll('.prio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    const container = document.getElementById('variablePillsContainer');
    if (!container) return;
    container.querySelectorAll('.var-pill').forEach(pill => {
      if (priority === 'ALL' || pill.dataset.priority === priority) {
        pill.style.display = 'inline-flex';
      } else {
        pill.style.display = 'none';
      }
    });
  };

  // Toggle Variable Selection
  window.toggleVar = function (btn) {
    const v = btn.dataset.var;
    const idx = S.activeVars.indexOf(v);
    if (idx >= 0) {
      if (S.activeVars.length > 1) {
        S.activeVars.splice(idx, 1);
        btn.classList.remove('active');
      }
    } else {
      S.activeVars.push(v);
      btn.classList.add('active');
    }
  };

  // Tab Switching
  window.switchTab = function (tabId, btn) {
    S.activeTab = tabId;
    document.querySelectorAll('.inspector-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.tab-view-pane').forEach(pane => {
      pane.style.display = pane.id === `pane-${tabId}` ? 'block' : 'none';
    });

    if (tabId === 'cmr') {
      searchCmr('GPM_3IMERGM');
    }
  };

  // Global Benchmark Select
  window.selectBenchmarkRegion = function (lat, lon, place, sub, el) {
    document.querySelectorAll('.eco-pill').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');
    selectCoordinates(lat, lon, place, sub);
  };

  function selectCoordinates(lat, lon, place, sub) {
    S.lat = lat;
    S.lon = lon;
    S.place = place;
    S.sub = sub;

    const titleEl = document.getElementById('currentLocationTitle');
    const coordsEl = document.getElementById('currentCoordinatesDisplay');
    if (titleEl) titleEl.innerText = place;
    if (coordsEl) coordsEl.innerText = `${sub} • (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`;

    if (S.marker) S.marker.setLngLat([lon, lat]);
    if (S.map) S.map.flyTo({ center: [lon, lat], zoom: 9, essential: true });

    runEarthscopeTrends();
  }

  // NASA CMR Search
  window.searchCmr = async function (kw) {
    const input = document.getElementById('cmrSearchInput');
    const query = kw || (input ? input.value.trim() : 'MODIS');
    const container = document.getElementById('cmrResultsContainer');
    if (!container) return;

    container.innerHTML = '<div class="station-empty-state">Querying NASA Earthdata CMR via Bearer Token (veduxearthscope)...</div>';

    try {
      const res = await fetch(`/api/earth/cmr/search?keyword=${encodeURIComponent(query)}&page_size=6`);
      const data = await res.json();
      if (!data.ok || !data.collections || data.collections.length === 0) {
        container.innerHTML = `<div class="station-empty-state">No NASA collections found matching "${query}".</div>`;
        return;
      }

      let html = '';
      data.collections.forEach(col => {
        const link = col.links && col.links.length > 0 ? col.links[0] : `https://cmr.earthdata.nasa.gov/search/concepts/${col.id}`;
        html += `
          <article class="fingerprint-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
              <div>
                <span class="tier-tag tier-p0" style="font-size:9.5px;">${col.id}</span>
                <h4 style="margin:4px 0 2px 0;">${col.title}</h4>
                <p style="font-size:11.5px; color:var(--es-text-muted); line-height:1.4; margin:4px 0 6px 0;">${col.summary}</p>
                <small style="font-family:var(--es-font-mono); font-size:10px; color:var(--es-text-subtle);">
                  Center: <b>${col.archive_center || col.data_center || 'NASA DAAC'}</b> • Coverage: <b>${(col.time_start || '').slice(0, 10)} to ${(col.time_end || 'Present').slice(0, 10)}</b>
                </small>
              </div>
              <a href="${link}" target="_blank" class="btn-secondary" style="font-size:10.5px; padding:4px 10px; white-space:nowrap; text-decoration:none;">
                CMR Details ↗
              </a>
            </div>
          </article>
        `;
      });
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = `<div style="color:#f43f5e; padding:14px;">CMR Search Error: ${e.message}</div>`;
    }
  };

  // AppEEARS LP DAAC Subsetting Service
  window.onAppeearsProductChange = function () {
    const prod = document.getElementById('appeearsProductSelect')?.value;
    const layerSel = document.getElementById('appeearsLayerSelect');
    if (!layerSel) return;
    if (prod === 'MOD13Q1.061') {
      layerSel.innerHTML = `
        <option value="_250m_16_days_NDVI">_250m_16_days_NDVI (Vegetation Index)</option>
        <option value="_250m_16_days_EVI">_250m_16_days_EVI (Enhanced Index)</option>
        <option value="_250m_16_days_Detailed_QA">_250m_16_days_Detailed_QA (Quality Assessment)</option>
      `;
    } else if (prod === 'MOD11A2.061') {
      layerSel.innerHTML = `
        <option value="LST_Day_1km">LST_Day_1km (Daytime Surface Temperature)</option>
        <option value="LST_Night_1km">LST_Night_1km (Nighttime Surface Temperature)</option>
        <option value="QC_Day">QC_Day (Quality Control Flags)</option>
      `;
    }
  };

  window.submitAppeearsTask = async function () {
    const prod = document.getElementById('appeearsProductSelect')?.value || 'MOD13Q1.061';
    const layer = document.getElementById('appeearsLayerSelect')?.value || '_250m_16_days_NDVI';
    const resBox = document.getElementById('appeearsResultBox');
    if (resBox) {
      resBox.style.display = 'block';
      resBox.innerHTML = '<span style="color:var(--es-mint);">Submitting subset request to NASA AppEEARS LP DAAC API...</span>';
    }

    try {
      const res = await fetch('/api/earth/appeears/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_name: `earthscope_${prod.split('.')[0]}_${Math.round(S.lat * 100)}`,
          lat: S.lat,
          lon: S.lon,
          product_id: prod,
          layer_name: layer,
          start_date: '2020-01-01',
          end_date: '2024-12-31'
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'AppEEARS submission failed');

      if (resBox) {
        resBox.innerHTML = `
          <div style="color:var(--es-mint); margin-bottom:4px;"><b>Task Queued Successfully:</b> ${data.task_id}</div>
          <div style="font-size:11px; color:#d1d5db; margin-bottom:6px;">
            Product: <b>${prod}</b> • Layer: <b>${layer}</b> • Status: <span style="background:rgba(34,197,94,0.15); color:#22c55e; padding:1px 6px; border-radius:3px;">${data.status}</span>
          </div>
          <div style="font-size:10px; color:var(--es-text-muted); line-height:1.4;">
            Target Point: (${S.lat.toFixed(4)}, ${S.lon.toFixed(4)}) • Time: 2020-01-01 to 2024-12-31<br>
            Download Bundle URL: <a href="${data.download_url}" target="_blank" style="color:var(--es-mint); text-decoration:underline;">${data.download_url}</a>
          </div>
        `;
      }
    } catch (e) {
      if (resBox) resBox.innerHTML = `<span style="color:#f43f5e;">AppEEARS error: ${e.message}</span>`;
    }
  };

  // Export Scientific Dossier
  window.exportDossier = function (format = 'html') {
    const url = `/api/earth/report?lat=${S.lat}&lon=${S.lon}&region_name=${encodeURIComponent(S.place)}&format=${format}`;
    window.open(url, '_blank');
  };

  // Smooth Navigation
  window.scrollToStation = function () {
    const el = document.getElementById('earthscope-station');
    if (!el) return;
    if (window.lenis && typeof window.lenis.scrollTo === 'function') {
      window.lenis.scrollTo(el, { duration: 1.4 });
    } else {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  window.scrollToSputnik = function () {
    const target = document.getElementById('header') || 0;
    if (window.lenis && typeof window.lenis.scrollTo === 'function') {
      window.lenis.scrollTo(target, { duration: 1.4 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Search Bar (Nominatim)
  function initSearch() {
    const inp = document.getElementById('stationSearchInput');
    if (!inp) return;
    inp.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const q = inp.value.trim();
        if (!q) return;
        try {
          const res = await fetch(`/api/earth/geocode?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (data.ok && data.results && data.results.length > 0) {
            const loc = data.results[0];
            const name = loc.display_name.split(',')[0];
            const sub = loc.display_name.split(',').slice(1, 3).join(', ');
            selectCoordinates(parseFloat(loc.lat), parseFloat(loc.lon), name, sub);
          }
        } catch (err) {
          console.warn('Geocoding error:', err);
        }
      }
    });
  }

  // Document Ready
  window.addEventListener('DOMContentLoaded', () => {
    initMap();
    initChart();
    initSearch();
    setTimeout(() => {
      runEarthscopeTrends();
    }, 400);
  });

})();
