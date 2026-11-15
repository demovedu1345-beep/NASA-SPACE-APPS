"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.join(__dirname, "..", "web", "api", "proxy.js");
const source = fs.readFileSync(sourcePath, "utf8");

function nasaPowerFixture() {
  const temperature = {};
  const precipitation = {};
  for (let year = 2020; year <= 2024; year++) {
    for (let month = 1; month <= 12; month++) {
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      for (let day = 1; day <= days; day++) {
        const key = String(year) + String(month).padStart(2, "0") + String(day).padStart(2, "0");
        temperature[key] = 20 + (year - 2020) * 0.08 + month * 0.02 + (day % 7) * 0.001;
        precipitation[key] = 1.2 + month * 0.01;
      }
    }
  }
  return {
    properties: {
      parameter: {
        T2M: temperature,
        PRECTOTCORR: precipitation
      }
    }
  };
}

function makeHarness() {
  const calls = [];
  const fixture = nasaPowerFixture();
  const sentinelObservations = [
    ["2017-08-15T05:00:00Z", 0.79],
    ["2018-08-15T05:00:00Z", 0.78],
    ["2019-08-15T05:00:00Z", 0.76],
    ["2020-08-15T05:00:00Z", 0.74],
    ["2021-08-15T05:00:00Z", 0.72],
    ["2022-08-15T05:00:00Z", 0.70],
    ["2023-08-15T05:00:00Z", 0.68],
    ["2024-08-15T05:00:00Z", 0.66]
  ].map(([datetime, mean_ndvi]) => ({
    datetime,
    mean_ndvi,
    forest_fraction: 0.92,
    cloud_masked_fraction: 0.08,
    valid_pixels: 100
  }));
  const mockFetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.toString());

    if (url.hostname === "vanrakshak-ai-scu6.onrender.com") {
      const route = url.pathname;
      if (route === "/api/analysis/vegetation-series") {
        return new Response(JSON.stringify({
          source: "Sentinel-2 L2A / Earth Search",
          observations: sentinelObservations,
          errors: [],
          label: "DERIVED_METRIC"
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (route === "/api/weather") {
        return new Response(JSON.stringify({
          ok: true,
          provenance: { source: "Test existing weather provider adapter" },
          data: {
            current: { temperature_2m: 19.2, relative_humidity_2m: 80 },
            hourly: {
              time: [
                "2026-11-15T00:00", "2026-11-15T06:00",
                "2026-11-16T00:00", "2026-11-16T06:00"
              ],
              temperature_2m: [18, 25, 17, 26],
              precipitation: [0, 0.3, 0, 0.5],
              precipitation_probability: [0, 30, 0, 40],
              wind_speed_10m: [4, 8, 3, 9]
            }
          }
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ detail: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }

    if (url.hostname === "power.larc.nasa.gov") {
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    throw new Error("Unexpected outbound host in compatibility test: " + url.hostname);
  };

  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    Buffer,
    URL,
    Headers,
    AbortSignal,
    Response,
    Date,
    Math,
    console,
    fetch: mockFetch
  };
  vm.runInNewContext(source, context, { filename: sourcePath });

  async function invoke(route, query = {}, method = "GET", body) {
    const req = {
      method,
      query: { __proxy_path: route, ...query },
      headers: { accept: "application/json" },
      body
    };
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader(name, value) { headers[name.toLowerCase()] = value; },
      hasHeader(name) { return Object.prototype.hasOwnProperty.call(headers, name.toLowerCase()); },
      end(payload) { this.payload = payload == null ? "" : String(payload); }
    };
    await module.exports(req, res);
    let json = null;
    try { json = JSON.parse(res.payload); } catch (_) {}
    return { status: res.statusCode, headers, json, calls };
  }

  return { invoke, calls };
}

async function main() {
  const harness = makeHarness();

  const catalog = await harness.invoke("earth/variables");
  assert.equal(catalog.status, 200, "old backend 404 should activate local variable catalogue");
  assert.equal(catalog.json.count, 11);
  assert.ok(catalog.json.variables.ndvi);
  assert.ok(catalog.json.variables.t2m);

  const states = await harness.invoke("climate/states");
  assert.equal(states.status, 200, "old backend 404 should activate coordinate catalogue");
  assert.equal(states.json.count, 36);
  assert.ok(states.json.states.every((row) => row.data_mode === "COORDINATE_REFERENCE"));

  const trends = await harness.invoke("earth/investigate", {
    lat: "12.3375",
    lon: "75.8069",
    variable: "t2m",
    region_name: "Kodagu test",
    start_year: "2020",
    end_year: "2024"
  });
  assert.equal(trends.status, 200, "trend route should use the existing NASA POWER adapter on an old-backend 404");
  assert.equal(trends.json.ok, true);
  assert.deepEqual(trends.json.variables_evaluated, ["t2m"]);
  assert.equal(trends.json.time_series.t2m.values.length, 60);
  assert.equal(trends.json.metadata.t2m.provider, "NASA POWER Daily Point API");
  assert.equal(trends.json.trends.t2m.data_class, "NASA_MODEL_OUTPUT");
  assert.ok(trends.json.trends.t2m.p_value >= 0 && trends.json.trends.t2m.p_value <= 1);
  assert.match(trends.json.ai_research_analyst.interpretation_mode, /RULE_BASED/);
  assert.ok(harness.calls.some((url) => url.startsWith("https://power.larc.nasa.gov/")));

  const vegetationTrend = await harness.invoke("earth/investigate", {
    lat: "12.3375",
    lon: "75.8069",
    variable: "ndvi",
    region_name: "Kodagu NDVI test",
    start_year: "2017",
    end_year: "2024"
  });
  assert.equal(vegetationTrend.status, 200);
  assert.equal(vegetationTrend.json.ok, true);
  assert.equal(vegetationTrend.json.time_series.ndvi.values.length, 8);
  assert.match(vegetationTrend.json.metadata.ndvi.provider, /Earth Search/);
  assert.equal(vegetationTrend.json.metadata.ndvi.source, "Sentinel-2 L2A / Earth Search");
  assert.equal(vegetationTrend.json.trends.ndvi.data_class, "ESA_DERIVED_METRIC");
  assert.equal(vegetationTrend.json.trends.ndvi.direction, "DECREASING");

  const forecast = await harness.invoke("climate/forecast", {
    lat: "12.3375", lon: "75.8069", place: "Kodagu"
  });
  assert.equal(forecast.status, 200);
  assert.equal(forecast.json.ok, true);
  assert.equal(forecast.json.daily_forecast.length, 2);
  assert.equal(forecast.json.daily_forecast[0].temp_high, 25);
  assert.equal(forecast.json.source, "Test existing weather provider adapter");

  const selectedForecast = await harness.invoke("climate/forecast", {
    lat: "12.3375",
    lon: "75.8069",
    place: "Kodagu",
    start_date: "2026-11-16",
    days: "1"
  });
  assert.equal(selectedForecast.status, 200);
  assert.equal(selectedForecast.json.daily_forecast.length, 1);
  assert.equal(selectedForecast.json.daily_forecast[0].date, "2026-11-16");
  assert.equal(selectedForecast.json.daily_forecast[0].temp_high, 26);

  const outOfWindowForecast = await harness.invoke("climate/forecast", {
    lat: "12.3375",
    lon: "75.8069",
    place: "Kodagu",
    start_date: "2026-11-20",
    days: "1"
  });
  assert.equal(outOfWindowForecast.status, 422);

  console.log("EarthScope proxy compatibility checks passed: variable catalogue, 36 state/UT references, 60 NASA POWER monthly observations, 8 Sentinel-2 NDVI observations, weather forecast aggregation, and selected forecast-window filtering.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
