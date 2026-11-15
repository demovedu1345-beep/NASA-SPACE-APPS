const BACKEND_ORIGIN = "https://vanrakshak-ai-scu6.onrender.com";
const BLOCKED_REQUEST_HEADERS = new Set([
  "host", "connection", "content-length", "transfer-encoding", "accept-encoding"
]);
const BLOCKED_RESPONSE_HEADERS = new Set([
  "connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length"
]);


const COMPAT_EARTH_VARIABLES = {
  ndvi: {
    name: "Sentinel-2 NDVI",
    unit: "NDVI",
    dataset: "Sentinel-2 MSI Level-2A",
    provider: "ESA Copernicus Sentinel-2 L2A via existing Earth Search adapter",
    source: "Sentinel-2 L2A / Earth Search",
    resolution: "10 m",
    data_class: "ESA_DERIVED_METRIC",
    method: "Cloud/shadow-masked red and near-infrared reflectance, summarized over the selected area.",
    note: "ESA mission data, supplied as complementary Earth-observation evidence; not a NASA satellite product."
  },
  t2m: {
    name: "2 m Air Temperature",
    unit: "°C",
    dataset: "NASA POWER Daily Point API — T2M",
    provider: "NASA POWER / NASA GMAO",
    source: "NASA POWER Daily Point API",
    resolution: "0.5° × 0.625° gridded model/reanalysis",
    data_class: "NASA_MODEL_OUTPUT",
    method: "Monthly means from daily NASA POWER T2M values; months require at least 80% valid daily observations.",
    note: "NASA model/reanalysis output, not a direct satellite measurement or local weather-station observation."
  },
  precipitation: {
    name: "Precipitation",
    unit: "mm/month",
    dataset: "NASA POWER Daily Point API — PRECTOTCORR",
    provider: "NASA POWER / NASA GMAO",
    source: "NASA POWER Daily Point API",
    resolution: "0.5° × 0.625° gridded model/reanalysis",
    data_class: "NASA_MODEL_OUTPUT",
    method: "Monthly totals from daily NASA POWER PRECTOTCORR values; months require at least 80% valid daily observations.",
    note: "NASA model/reanalysis output, not a direct satellite rainfall retrieval or local rain-gauge measurement."
  },
  modis_ndvi: {
    name: "MODIS NDVI (Terra)",
    unit: "NDVI",
    dataset: "MODIS/061/MOD13Q1",
    provider: "Google Earth Engine / NASA Terra MODIS",
    source: "NASA Terra MODIS",
    resolution: "250 m",
    data_class: "NASA_DIRECT_OBSERVATION",
    method: "16-day quality-screened composite; Earth Engine extraction requires configured credentials.",
    note: "Unavailable unless the existing Earth Engine integration is configured and returns observations."
  },
  modis_evi: {
    name: "MODIS EVI (Terra)",
    unit: "EVI",
    dataset: "MODIS/061/MOD13Q1",
    provider: "Google Earth Engine / NASA Terra MODIS",
    source: "NASA Terra MODIS",
    resolution: "250 m",
    data_class: "NASA_DIRECT_OBSERVATION",
    method: "16-day quality-screened composite; Earth Engine extraction requires configured credentials.",
    note: "Unavailable unless the existing Earth Engine integration is configured and returns observations."
  },
  modis_lst_day: {
    name: "MODIS Daytime Land Surface Temperature",
    unit: "°C",
    dataset: "MODIS/061/MOD11A2",
    provider: "Google Earth Engine / NASA Terra MODIS",
    source: "NASA Terra MODIS",
    resolution: "1 km",
    data_class: "NASA_DIRECT_OBSERVATION",
    method: "8-day QC-screened land-surface-temperature composite; Earth Engine extraction requires configured credentials.",
    note: "Unavailable unless the existing Earth Engine integration is configured and returns observations."
  },
  modis_lst_night: {
    name: "MODIS Nighttime Land Surface Temperature",
    unit: "°C",
    dataset: "MODIS/061/MOD11A2",
    provider: "Google Earth Engine / NASA Terra MODIS",
    source: "NASA Terra MODIS",
    resolution: "1 km",
    data_class: "NASA_DIRECT_OBSERVATION",
    method: "8-day QC-screened land-surface-temperature composite; Earth Engine extraction requires configured credentials.",
    note: "Unavailable unless the existing Earth Engine integration is configured and returns observations."
  },
  gpm_precipitation: {
    name: "GPM IMERG Precipitation",
    unit: "mm/hr",
    dataset: "NASA/GPM_L3/IMERG_MONTHLY_V07",
    provider: "Google Earth Engine / NASA GPM IMERG",
    source: "NASA GPM IMERG",
    resolution: "0.1°",
    data_class: "NASA_SATELLITE_GAUGE_MERGED_PRODUCT",
    method: "Monthly merged satellite/gauge product; Earth Engine extraction requires configured credentials.",
    note: "Unavailable unless the existing Earth Engine integration is configured and returns observations."
  },
  merra2_t2m: {
    name: "MERRA-2 2 m Air Temperature",
    unit: "°C",
    dataset: "NASA/GSFC/MERRA/slv/2",
    provider: "Google Earth Engine / NASA MERRA-2",
    source: "NASA MERRA-2",
    resolution: "Approximately 69 × 55 km",
    data_class: "NASA_MODEL_OUTPUT",
    method: "Monthly means from the MERRA-2 reanalysis; Earth Engine extraction requires configured credentials.",
    note: "Unavailable unless the existing Earth Engine integration is configured and returns observations."
  },
  gldas_soil_moisture: {
    name: "GLDAS Surface Soil Moisture",
    unit: "kg/m²",
    dataset: "NASA/GLDAS/V021/NOAH/G025/T3H",
    provider: "Google Earth Engine / NASA GLDAS",
    source: "NASA GLDAS-2.1",
    resolution: "0.25°",
    data_class: "NASA_MODEL_OUTPUT",
    method: "Monthly means from the 0–10 cm soil-moisture layer; Earth Engine extraction requires configured credentials.",
    note: "Unavailable unless the existing Earth Engine integration is configured and returns observations."
  },
  omi_ozone: {
    name: "Merged TOMS / OMI Total Column Ozone",
    unit: "Dobson units",
    dataset: "TOMS/MERGED_V4",
    provider: "Google Earth Engine / NASA GES DISC",
    source: "NASA TOMS / OMI merged product",
    resolution: "Approximately 111 km",
    data_class: "NASA_MERGED_SATELLITE_PRODUCT",
    method: "Monthly means from the merged satellite record; Earth Engine extraction requires configured credentials.",
    note: "Unavailable unless the existing Earth Engine integration is configured and returns observations."
  }
};

function compatErfc(value) {
  const x = Math.abs(Number(value));
  const t = 1 / (1 + 0.5 * x);
  const tau = t * Math.exp(
    -x * x - 1.26551223 +
    t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 +
    t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
  );
  return Number(value) >= 0 ? tau : 2 - tau;
}

function compatDateYear(dateText) {
  const stamp = Date.parse(String(dateText).slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(stamp)) return null;
  const date = new Date(stamp);
  const year = date.getUTCFullYear();
  const begin = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (stamp - begin) / (end - begin);
}

function compatMk(values) {
  const n = values.length;
  if (n < 4) return { n, s: 0, tau: null, z: null, p_value: null, variance: null };
  let s = 0;
  const ties = new Map();
  for (let i = 0; i < n; i++) {
    const key = Number(values[i]).toFixed(8);
    ties.set(key, (ties.get(key) || 0) + 1);
    for (let j = i + 1; j < n; j++) s += values[j] > values[i] ? 1 : values[j] < values[i] ? -1 : 0;
  }
  let tieSum = 0;
  for (const count of ties.values()) if (count > 1) tieSum += count * (count - 1) * (2 * count + 5);
  const variance = (n * (n - 1) * (2 * n + 5) - tieSum) / 18;
  const z = variance <= 0 ? 0 : s > 0 ? (s - 1) / Math.sqrt(variance) : s < 0 ? (s + 1) / Math.sqrt(variance) : 0;
  const p = compatErfc(Math.abs(z) / Math.SQRT2);
  return { n, s, tau: s / (0.5 * n * (n - 1)), z, p_value: p, variance };
}

function compatTrendStats(rows, alpha) {
  const clean = (rows || []).map(row => ({
    date: String(row.date || "").slice(0, 10),
    value: Number(row.value)
  })).filter(row => row.date && Number.isFinite(compatDateYear(row.date)) && Number.isFinite(row.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  const n = clean.length;
  const unavailable = { n, mann_kendall_z: null, p_value: null, sens_slope: null, ci_95: null, significant: null, direction: "INSUFFICIENT_DATA", seasonal_mk_z: null, seasonal_months_with_repeated_samples: null };
  if (n < 4) return unavailable;

  const x = clean.map(row => compatDateYear(row.date));
  const y = clean.map(row => row.value);
  const mk = compatMk(y);
  const slopes = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[j] - x[i];
      if (dx > 1e-9) slopes.push((y[j] - y[i]) / dx);
    }
  }
  slopes.sort((a, b) => a - b);
  const median = arr => {
    if (!arr.length) return null;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };
  const slope = median(slopes);
  const intercept = median(y.map((value, i) => value - slope * x[i]));
  const fit = y.map((_, i) => intercept + slope * x[i]);
  const rmse = Math.sqrt(y.reduce((sum, value, i) => sum + Math.pow(value - fit[i], 2), 0) / n);
  const zCrit = 1.959963984540054;
  let ci = null;
  if (slopes.length && mk.variance != null) {
    const rankSpread = zCrit * Math.sqrt(Math.max(0, mk.variance));
    const lowIndex = Math.max(0, Math.floor((slopes.length - rankSpread) / 2));
    const highIndex = Math.min(slopes.length - 1, Math.ceil((slopes.length + rankSpread) / 2));
    ci = [slopes[lowIndex], slopes[highIndex]];
  }

  const seasonalGroups = new Map();
  for (const row of clean) {
    const month = row.date.slice(5, 7);
    if (!seasonalGroups.has(month)) seasonalGroups.set(month, []);
    seasonalGroups.get(month).push(row.value);
  }
  let seasonalS = 0;
  let seasonalVariance = 0;
  let seasonalMonths = 0;
  for (const group of seasonalGroups.values()) {
    if (group.length < 4) continue;
    const seasonal = compatMk(group);
    seasonalS += seasonal.s;
    seasonalVariance += seasonal.variance || 0;
    seasonalMonths++;
  }
  const seasonalZ = seasonalMonths >= 3 && seasonalVariance > 0
    ? (seasonalS > 0 ? seasonalS - 1 : seasonalS < 0 ? seasonalS + 1 : 0) / Math.sqrt(seasonalVariance)
    : null;

  const significant = mk.p_value != null && mk.p_value < alpha;
  const yearlyChange = slope * (x[n - 1] - x[0]);
  const tolerance = Math.max(1e-8, (Math.max(...y) - Math.min(...y)) * 0.005);
  const direction = yearlyChange > tolerance ? "INCREASING" : yearlyChange < -tolerance ? "DECREASING" : "STABLE";
  return {
    n,
    mann_kendall_s: mk.s,
    mann_kendall_tau: mk.tau,
    mann_kendall_z: mk.z,
    p_value: mk.p_value,
    variance: mk.variance,
    sens_slope: slope,
    ci_95: ci,
    significant,
    direction,
    seasonal_mk_z: seasonalZ,
    seasonal_months_with_repeated_samples: seasonalMonths,
    rmse,
    first_value: y[0],
    latest_value: y[n - 1],
    first_date: clean[0].date,
    latest_date: clean[n - 1].date,
    label: "REAL_PROVIDER_DERIVED_TREND"
  };
}

async function compatFetchBackend(path, params = {}) {
  const url = new URL(path, BACKEND_ORIGIN);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.detail || body.error || ("Backend returned " + response.status + " for " + path));
    error.status = response.status;
    throw error;
  }
  return body;
}

async function compatFetchNasaPower(lat, lon, startYear, endYear) {
  const latestDate = new Date(Date.now() - 2 * 86400000);
  const endDate = new Date(Date.UTC(Number(endYear), 11, 31));
  const cutoff = latestDate < endDate ? latestDate : endDate;
  const startText = String(startYear) + "0101";
  const endText = cutoff.getUTCFullYear().toString() +
    String(cutoff.getUTCMonth() + 1).padStart(2, "0") +
    String(cutoff.getUTCDate()).padStart(2, "0");
  const url = new URL("https://power.larc.nasa.gov/api/temporal/daily/point");
  url.searchParams.set("parameters", "T2M,PRECTOTCORR");
  url.searchParams.set("community", "AG");
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("start", startText);
  url.searchParams.set("end", endText);
  url.searchParams.set("format", "JSON");
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload && payload.message) || ("NASA POWER returned " + response.status));
  const parameters = payload && payload.properties && payload.properties.parameter;
  if (!parameters) throw new Error("NASA POWER returned no parameter time series.");
  const monthBuckets = new Map();
  const dates = Object.keys(parameters.T2M || {}).sort();
  for (const key of dates) {
    const month = key.slice(0, 6);
    if (!monthBuckets.has(month)) monthBuckets.set(month, { temp: [], rain: [] });
    const bucket = monthBuckets.get(month);
    const temp = Number(parameters.T2M[key]);
    const rain = Number((parameters.PRECTOTCORR || {})[key]);
    if (Number.isFinite(temp) && temp > -900) bucket.temp.push(temp);
    if (Number.isFinite(rain) && rain > -900) bucket.rain.push(rain);
  }

  const temperature = [];
  const precipitation = [];
  for (const [month, bucket] of [...monthBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const year = Number(month.slice(0, 4));
    const monthNum = Number(month.slice(4, 6));
    const days = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const minimum = Math.ceil(days * 0.8);
    const date = month.slice(0, 4) + "-" + month.slice(4, 6) + "-15";
    if (bucket.temp.length >= minimum) temperature.push({ date, value: bucket.temp.reduce((a, b) => a + b, 0) / bucket.temp.length });
    if (bucket.rain.length >= minimum) precipitation.push({ date, value: bucket.rain.reduce((a, b) => a + b, 0) });
  }
  return {
    temperature,
    precipitation,
    source: "NASA POWER Daily Point API",
    product: "NASA GMAO POWER daily T2M and PRECTOTCORR",
    retrieved_at: new Date().toISOString(),
    first_available_day: dates[0] || null,
    last_available_day: dates[dates.length - 1] || null
  };
}

async function compatRunEarthTrend(input) {
  const lat = Number(input.lat ?? 12.3375);
  const lon = Number(input.lon ?? 75.8069);
  const startYear = Number(input.start_year ?? 2015);
  const endYear = Number(input.end_year ?? new Date().getUTCFullYear());
  const alpha = Number(input.alpha ?? 0.05);
  const regionName = String(input.region_name || input.place || "Selected study area").slice(0, 120);
  const variables = Array.isArray(input.variables)
    ? input.variables.map(value => String(value).trim().toLowerCase()).filter(Boolean)
    : String(input.variable || input.variables || "t2m").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return { status: 422, body: { detail: "Latitude or longitude is outside valid bounds." } };
  }
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 1981 || endYear < startYear || endYear > new Date().getUTCFullYear()) {
    return { status: 422, body: { detail: "Choose a valid historical start and end year." } };
  }
  if (!(alpha > 0 && alpha < 0.5)) return { status: 422, body: { detail: "alpha must be between 0 and 0.5." } };

  const requested = [...new Set(variables)].filter(value => COMPAT_EARTH_VARIABLES[value]);
  const unavailable = {};
  const providerErrors = [];
  const seriesByVariable = {};
  const metadata = {};
  const stats = {};
  const startDate = startYear + "-01-01";
  const today = new Date().toISOString().slice(0, 10);
  const requestedEnd = endYear + "-12-31";
  const endDate = requestedEnd > today ? today : requestedEnd;

  const needNdvi = requested.includes("ndvi");
  const climateVariables = requested.filter(value => value === "t2m" || value === "precipitation");
  const work = [];
  if (needNdvi) {
    work.push((async () => {
      try {
        const series = await compatFetchBackend("/api/analysis/vegetation-series", {
          lat, lon, start: startDate, end: endDate, max_observations: 16
        });
        const rows = (series.observations || []).map(row => ({
          date: String(row.datetime || "").slice(0, 10),
          value: Number(row.mean_ndvi)
        })).filter(row => row.date && Number.isFinite(row.value));
        if (rows.length >= 4) {
          seriesByVariable.ndvi = rows;
          metadata.ndvi = {
            ...COMPAT_EARTH_VARIABLES.ndvi,
            sample_count: rows.length,
            first_observation: rows[0].date,
            last_observation: rows[rows.length - 1].date,
            cloud_masked: true,
            source: series.source || COMPAT_EARTH_VARIABLES.ndvi.source
          };
        } else {
          unavailable.ndvi = "Sentinel-2 returned " + rows.length + " usable scene summaries; at least four are required for a trend test.";
        }
      } catch (error) {
        unavailable.ndvi = "Sentinel-2 vegetation observations unavailable: " + String(error.message || error).slice(0, 200);
        providerErrors.push({ variable: "ndvi", error: String(error.message || error).slice(0, 240) });
      }
    })());
  }

  if (climateVariables.length) {
    work.push((async () => {
      try {
        const power = await compatFetchNasaPower(lat, lon, startYear, endYear);
        for (const variable of climateVariables) {
          const rows = variable === "t2m" ? power.temperature : power.precipitation;
          if (rows.length >= 12) {
            seriesByVariable[variable] = rows;
            metadata[variable] = {
              ...COMPAT_EARTH_VARIABLES[variable],
              sample_count: rows.length,
              first_observation: rows[0].date,
              last_observation: rows[rows.length - 1].date,
              provider: power.source,
              source: power.source
            };
          } else {
            unavailable[variable] = "NASA POWER returned " + rows.length + " valid monthly observations; at least 12 are required for trend analysis.";
          }
        }
      } catch (error) {
        for (const variable of climateVariables) {
          unavailable[variable] = "NASA POWER historical observations unavailable: " + String(error.message || error).slice(0, 200);
        }
        providerErrors.push({ variable: "nasa_power", error: String(error.message || error).slice(0, 240) });
      }
    })());
  }

  for (const variable of requested) {
    if (["ndvi", "t2m", "precipitation"].includes(variable)) continue;
    unavailable[variable] = COMPAT_EARTH_VARIABLES[variable].note;
  }
  for (const variable of variables) {
    if (!COMPAT_EARTH_VARIABLES[variable]) unavailable[variable] = "This variable is not registered in the connected trend catalogue.";
  }

  await Promise.all(work);
  for (const [variable, rows] of Object.entries(seriesByVariable)) {
    stats[variable] = compatTrendStats(rows, alpha);
    stats[variable].unit = COMPAT_EARTH_VARIABLES[variable].unit;
    stats[variable].source = metadata[variable].provider || metadata[variable].source;
    stats[variable].data_class = COMPAT_EARTH_VARIABLES[variable].data_class;
    stats[variable].fdr_q_value = null;
    stats[variable].fdr_significant = null;
  }

  const ranked = Object.entries(stats).filter(([, value]) => value.p_value != null).sort((a, b) => a[1].p_value - b[1].p_value);
  const qValues = {};
  let running = 1;
  for (let i = ranked.length - 1; i >= 0; i--) {
    const [variable, value] = ranked[i];
    running = Math.min(running, value.p_value * ranked.length / (i + 1));
    qValues[variable] = Math.min(1, running);
    value.fdr_q_value = qValues[variable];
    value.fdr_significant = qValues[variable] < alpha;
  }

  const timeSeries = {};
  for (const [variable, rows] of Object.entries(seriesByVariable)) {
    timeSeries[variable] = { dates: rows.map(row => row.date), values: rows.map(row => row.value) };
  }
  const summary = Object.entries(stats).map(([variable, result]) => {
    const label = result.p_value == null ? "insufficient data" : ((result.significant ? "statistically significant " : "not statistically significant ") + String(result.direction || "").toLowerCase() + " trend");
    return COMPAT_EARTH_VARIABLES[variable].name + ": " + label +
      (result.sens_slope == null ? "." : " (Sen's slope " + result.sens_slope.toFixed(5) + " " + result.unit + "/year; p=" + result.p_value.toFixed(5) + ").");
  });

  return {
    status: 200,
    body: {
      ok: Object.keys(stats).length > 0,
      investigation_id: "ESC-COMPAT-" + Date.now(),
      region: { name: regionName, latitude: lat, longitude: lon },
      timeframe: { start_year: startYear, end_year: endYear, start_date: startDate, end_date: endDate },
      variables_evaluated: Object.keys(stats),
      unavailable_variables: unavailable,
      trends: stats,
      results: stats,
      time_series: timeSeries,
      metadata,
      correlation_matrix: {},
      multiple_testing_fdr: { method: "Benjamini-Hochberg", alpha, q_values: qValues, significant: Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, value.fdr_significant])) },
      provider_errors: providerErrors,
      ai_research_analyst: {
        grounded_interpretation: summary.join(" "),
        limitations: [
          "All values come from provider observations returned for this location and time window; no synthetic time series are inserted.",
          "Sentinel-2 is an ESA Copernicus mission and provides complementary vegetation evidence, not a NASA mission product.",
          "NASA POWER temperature and precipitation values are gridded model/reanalysis output, not direct satellite measurements or station observations.",
          "Sentinel-2 acquisitions are irregular and cloud-masked; the requested calendar window may contain fewer years of valid observations.",
          "Earth Engine-only MODIS, GPM, MERRA-2, GLDAS and ozone series remain unavailable until the existing Earth Engine credentials are configured.",
          "The analyst text is generated from the returned statistical calculations; no external generative AI service is called.",
          "Correlation does not establish causation; NDVI decline is a screening signal and not legal proof of deforestation."
        ],
        interpretation_mode: "RULE_BASED_STATISTICAL_SUMMARY_NOT_GENERATIVE_AI"
      },
      retrieved_at: new Date().toISOString(),
      compatibility_mode: "EXISTING_BACKEND_ADAPTERS_AND_NASA_POWER_FALLBACK"
    }
  };
}

async function compatClimateForecast(lat, lon, place) {
  const weather = await compatFetchBackend("/api/weather", { lat, lon });
  const payload = weather.data || {};
  const hourly = payload.hourly || {};
  const times = hourly.time || [];
  const days = new Map();
  for (let i = 0; i < times.length; i++) {
    const date = String(times[i]).slice(0, 10);
    if (!date) continue;
    if (!days.has(date)) days.set(date, { temps: [], rain: [], rainProb: [], wind: [] });
    const bucket = days.get(date);
    const temp = Number((hourly.temperature_2m || [])[i]);
    const rain = Number((hourly.precipitation || [])[i]);
    const probability = Number((hourly.precipitation_probability || [])[i]);
    const wind = Number((hourly.wind_speed_10m || [])[i]);
    if (Number.isFinite(temp)) bucket.temps.push(temp);
    if (Number.isFinite(rain) && rain >= 0) bucket.rain.push(rain);
    if (Number.isFinite(probability)) bucket.rainProb.push(probability);
    if (Number.isFinite(wind)) bucket.wind.push(wind);
  }
  const daily = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, row]) => {
    const avg = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const d = new Date(date + "T12:00:00Z");
    return {
      date,
      day: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      temp_high: row.temps.length ? Math.max(...row.temps) : null,
      temp_low: row.temps.length ? Math.min(...row.temps) : null,
      rain_mm: row.rain.length ? row.rain.reduce((a, b) => a + b, 0) : null,
      rain_prob: row.rainProb.length ? Math.max(...row.rainProb) : null,
      wind_kmh: row.wind.length ? Math.max(...row.wind) : null,
      source: "Existing weather provider adapter"
    };
  });
  const current = payload.current || {};
  const highs = daily.map(row => row.temp_high).filter(Number.isFinite);
  const lows = daily.map(row => row.temp_low).filter(Number.isFinite);
  const rains = daily.map(row => row.rain_mm).filter(Number.isFinite);
  const winds = daily.map(row => row.wind_kmh).filter(Number.isFinite);
  const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const sum = values => values.length ? values.reduce((a, b) => a + b, 0) : null;
  return {
    ok: daily.length > 0,
    location: { lat, lon, place: place || "Selected region" },
    source: weather.provenance && weather.provenance.source ? weather.provenance.source : "Existing weather provider adapter",
    forecast_window: daily.length ? { start: daily[0].date, end: daily[daily.length - 1].date, days: daily.length } : null,
    daily_forecast: daily,
    insights: {
      avgTemp: mean(highs) == null ? null : mean(highs).toFixed(1) + " °C mean daily high",
      minTemp: lows.length ? Math.min(...lows).toFixed(1) + " °C" : null,
      maxTemp: highs.length ? Math.max(...highs).toFixed(1) + " °C" : null,
      totalPrecip: sum(rains) == null ? null : sum(rains).toFixed(1) + " mm",
      maxPrecip: rains.length ? Math.max(...rains).toFixed(1) + " mm/day" : null,
      rainyDays: rains.length ? rains.filter(value => value > 0.1).length + " days" : null,
      avgWind: mean(winds) == null ? null : mean(winds).toFixed(1) + " km/h",
      maxWind: winds.length ? Math.max(...winds).toFixed(1) + " km/h" : null,
      pressure: current.pressure_msl == null ? null : current.pressure_msl,
      weatherPattern: daily.length + "-day provider forecast",
      patternDetail: "Forecast values are aggregated from returned hourly provider values; no additional forecast days are fabricated."
    },
    provenance: weather.provenance || null
  };
}

const COMPAT_STATE_CATALOG = [
  ["Andhra Pradesh", 15.9129, 79.7400], ["Arunachal Pradesh", 28.2180, 94.7278],
  ["Assam", 26.2006, 92.9376], ["Bihar", 25.0961, 85.3131],
  ["Chhattisgarh", 21.2787, 81.8661], ["Goa", 15.2993, 74.1240],
  ["Gujarat", 22.2587, 71.1924], ["Haryana", 29.0588, 76.0856],
  ["Himachal Pradesh", 31.1048, 77.1734], ["Jharkhand", 23.6102, 85.2799],
  ["Karnataka", 15.3173, 75.7139], ["Kerala", 10.8505, 76.2711],
  ["Madhya Pradesh", 22.9734, 78.6569], ["Maharashtra", 19.7515, 75.7139],
  ["Manipur", 24.6637, 93.9063], ["Meghalaya", 25.4670, 91.3662],
  ["Mizoram", 23.1645, 92.9376], ["Nagaland", 26.1584, 94.5624],
  ["Odisha", 20.9517, 85.0985], ["Punjab", 31.1471, 75.3412],
  ["Rajasthan", 27.0238, 74.2179], ["Sikkim", 27.5330, 88.5122],
  ["Tamil Nadu", 11.1271, 78.6569], ["Telangana", 18.1124, 79.0193],
  ["Tripura", 23.9408, 91.9882], ["Uttar Pradesh", 26.8467, 80.9462],
  ["Uttarakhand", 30.0668, 79.0193], ["West Bengal", 22.9868, 87.8550],
  ["Andaman and Nicobar Islands", 11.7401, 92.6586], ["Chandigarh", 30.7333, 76.7794],
  ["Dadra and Nagar Haveli and Daman and Diu", 20.1809, 73.0169], ["Delhi", 28.7041, 77.1025],
  ["Jammu and Kashmir", 33.7782, 76.5762], ["Ladakh", 34.1526, 77.5771],
  ["Lakshadweep", 10.5667, 72.6417], ["Puducherry", 11.9416, 79.8083]
];

async function compatFallback(path, method, req) {
  if (path === "earth/variables" && method === "GET") {
    return {
      status: 200,
      body: {
        ok: true,
        count: Object.keys(COMPAT_EARTH_VARIABLES).length,
        variables: COMPAT_EARTH_VARIABLES,
        note: "Catalogue metadata is not a claim of live availability. Each analysis response and provider health check determine whether observations were actually returned."
      }
    };
  }
  if (path === "climate/states" && method === "GET") {
    const states = COMPAT_STATE_CATALOG.map(([name, lat, lon]) => ({
      name, lat, lon, data_mode: "COORDINATE_REFERENCE",
      climate_zone: "Provider-derived climate data is loaded after selection",
      hotspot: "Reference coordinate only; not a measured hotspot"
    }));
    return { status: 200, body: { ok: true, count: states.length, states, note: "Coordinates are state-level reference points, not state-boundary centroids or live observations." } };
  }
  if (path === "climate/forecast" && method === "GET") {
    const q = req.query || {};
    try {
      return { status: 200, body: await compatClimateForecast(Number(q.lat ?? 12.3375), Number(q.lon ?? 75.8069), q.place) };
    } catch (error) {
      return { status: 503, body: { ok: false, detail: "Existing forecast provider unavailable: " + String(error.message || error).slice(0, 220) } };
    }
  }
  if ((path === "earth/investigate" || path === "earth/trends/analyze") && (method === "GET" || method === "POST")) {
    const input = method === "POST" && req.body && typeof req.body === "object" ? req.body : (req.query || {});
    try {
      return await compatRunEarthTrend(input);
    } catch (error) {
      return { status: error.status || 503, body: { ok: false, detail: "Provider-backed trend analysis failed: " + String(error.message || error).slice(0, 240), provider_error: true } };
    }
  }
  if (path === "earth/trends/compare" && method === "POST") {
    const input = req.body && typeof req.body === "object" ? req.body : {};
    const regions = Array.isArray(input.regions) ? input.regions.slice(0, 8) : [];
    if (regions.length < 2) return { status: 422, body: { detail: "At least two regions are required for comparison." } };
    const comparisons = await Promise.all(regions.map(async region => {
      const result = await compatRunEarthTrend({
        ...input,
        lat: region.lat,
        lon: region.lon,
        region_name: region.name
      });
      return result.body;
    }));
    return { status: 200, body: { ok: comparisons.some(item => item && item.ok), count: comparisons.length, comparisons, compatibility_mode: "PROVIDER_BACKED_REGION_COMPARISON" } };
  }
  return null;
}

module.exports = async function handler(req, res) {
  const rawPath = req.query && req.query.__proxy_path;
  const path = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath || "");

  // Only forward valid relative API paths; do not accept arbitrary upstream URLs.
  const segments = path.split("/");
  if (!path || segments.some(part => !part || part === "." || part === ".." || !/^[A-Za-z0-9._~-]+$/.test(part))) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Invalid API path" }));
    return;
  }

  const upstreamUrl = new URL("/api/" + segments.map(encodeURIComponent).join("/"), BACKEND_ORIGIN);
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "__proxy_path" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      upstreamUrl.searchParams.append(key, String(item));
    }
  }

  const method = String(req.method || "GET").toUpperCase();
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    const lower = key.toLowerCase();
    if (BLOCKED_REQUEST_HEADERS.has(lower) || value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }

  let body;
  if (!["GET", "HEAD"].includes(method) && req.body !== undefined) {
    if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
    }
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(55000)
    });

    // Older Render deployments may not yet contain the newer research routes.
    // Prefer the real backend route; activate the local adapter only on a route 404.
    if (upstream.status === 404) {
      const compatibility = await compatFallback(path, method, req);
      if (compatibility) {
        res.statusCode = compatibility.status;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify(compatibility.body));
        return;
      }
    }

    res.statusCode = upstream.status;
    for (const [key, value] of upstream.headers.entries()) {
      if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
    }
    if (!res.hasHeader("cache-control")) res.setHeader("cache-control", "no-store");
    if (method === "HEAD") {
      res.end();
      return;
    }
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.end(payload);
  } catch (error) {
    console.error("API proxy request failed", {
      path,
      method,
      name: error && error.name
    });
    res.statusCode = 502;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({
      ok: false,
      error: "The data service could not be reached. Retry shortly."
    }));
  }
};
