from __future__ import annotations

from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


def _sentinel_observations():
    rows = []
    for year in range(2017, 2025):
        # Test fixture only: provider adapter is monkeypatched below; this is not production data.
        rows.append({
            "datetime": f"{year}-08-15T05:00:00Z",
            "mean_ndvi": round(0.78 - (year - 2017) * 0.012, 4),
            "forest_fraction": 0.82,
            "cloud_masked_fraction": 0.12,
            "valid_pixels": 100,
        })
    return rows


def test_earth_trend_get_route_uses_returned_sentinel_observations(monkeypatch):
    async def fake_vegetation_series(*args, **kwargs):
        return {
            "source": "Test Sentinel-2 provider fixture",
            "observations": _sentinel_observations(),
            "label": "DERIVED_METRIC",
        }

    monkeypatch.setattr(main, "vegetation_series_ep", fake_vegetation_series)
    response = client.get(
        "/api/earth/investigate",
        params={
            "lat": 12.3375,
            "lon": 75.8069,
            "variable": "ndvi",
            "region_name": "Kodagu test area",
            "start_year": 2017,
            "end_year": 2024,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["variables_evaluated"] == ["ndvi"]
    assert body["metadata"]["ndvi"]["provider"] == "Test Sentinel-2 provider fixture"
    trend = body["trends"]["ndvi"]
    assert trend["n"] == 8
    assert trend["direction"] == "DECREASING"
    assert trend["sens_slope"] is not None
    assert trend["p_value"] is not None
    assert body["time_series"]["ndvi"]["values"] == [row["mean_ndvi"] for row in _sentinel_observations()]
    assert "synthetic" in " ".join(body["ai_research_analyst"]["limitations"]).lower()


def test_earth_trend_marks_insufficient_observations_unavailable(monkeypatch):
    async def fake_vegetation_series(*args, **kwargs):
        return {
            "source": "Test Sentinel-2 provider fixture",
            "observations": _sentinel_observations()[:3],
            "label": "DERIVED_METRIC",
        }

    monkeypatch.setattr(main, "vegetation_series_ep", fake_vegetation_series)
    response = client.get(
        "/api/earth/trends/analyze",
        params={
            "lat": 12.3375,
            "lon": 75.8069,
            "variables": "ndvi",
            "start_year": 2020,
            "end_year": 2024,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["trends"] == {}
    assert "Fewer than four" in body["unavailable_variables"]["ndvi"]


def test_earth_trend_variable_catalog_only_lists_connected_trend_variables():
    response = client.get("/api/earth/variables")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 5
    assert set(body["variables"]) == {"ndvi", "t2m", "precipitation", "modis_ndvi", "modis_lst_day"}


def test_climate_state_catalog_is_coordinate_reference_not_live_weather():
    response = client.get("/api/climate/states")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == len(body["states"])
    assert body["count"] >= 28
    assert all(item["data_mode"] == "COORDINATE_REFERENCE" for item in body["states"])
    assert all(item.get("lat") is not None and item.get("lon") is not None for item in body["states"])


def test_climate_forecast_returns_only_provider_forecast_values(monkeypatch):
    async def fake_forecast(*args, **kwargs):
        return {
            "current": {
                "temperature_2m": 23.4,
                "relative_humidity_2m": 81,
                "precipitation": 0.2,
                "wind_speed_10m": 8.5,
                "pressure_msl": 1008.2,
            },
            "daily": {
                "time": [f"2026-11-{day:02d}" for day in range(15, 22)],
                "temperature_2m_max": [25, 26, 25, 24, 27, 26, 25],
                "temperature_2m_min": [18, 19, 18, 17, 20, 19, 18],
                "precipitation_sum": [0, 2.4, 0.2, 8.1, 0, 1.1, 0],
                "precipitation_probability_max": [0, 30, 10, 70, 0, 20, 0],
                "wind_speed_10m_max": [12, 15, 14, 22, 13, 16, 11],
            },
        }

    async def fake_history(*args, **kwargs):
        return (
            {
                "daily": {
                    "time": [f"2025-{month:02d}-15" for month in range(1, 13)],
                    "temperature_2m_mean": [20 + month for month in range(1, 13)],
                    "precipitation_sum": [month / 10 for month in range(1, 13)],
                }
            },
            "Test Historical Climate Provider",
            [],
        )

    monkeypatch.setattr(main.weather, "get_json", fake_forecast)
    monkeypatch.setattr(main, "historical_climate_daily_real", fake_history)
    response = client.get(
        "/api/climate/forecast",
        params={"lat": 12.3375, "lon": 75.8069, "place": "Kodagu test"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert len(body["daily_forecast"]) == 7
    assert body["daily_forecast"][3]["rain_mm"] == 8.1
    assert body["insights"]["pressure"] == 1008.2
    assert body["insights"]["maxPrecip"] == "8.1 mm/day"
    assert body["insights"]["rainyDays"] == "4 days"
    assert body["climatology_source"] == "Test Historical Climate Provider"
    assert len(body["monthly_temps"]) == 12


def test_trend_climate_variables_use_nasa_power_as_primary_source(monkeypatch):
    async def fake_power_history(lat, lon, start, end):
        dates = []
        temps = []
        rain = []
        for year in range(2017, 2025):
            for month in range(1, 13):
                for day in range(1, 29):
                    dates.append(f"{year}-{month:02d}-{day:02d}")
                    temps.append(24.0 + (year - 2017) * 0.04 + month * 0.01)
                    rain.append(2.5 + month * 0.02 - (year - 2017) * 0.01)
        return {
            "daily": {
                "time": dates,
                "temperature_2m_mean": temps,
                "precipitation_sum": rain,
            }
        }

    async def forbidden_non_nasa_fallback(*args, **kwargs):
        raise AssertionError("Trend analysis must not silently use a non-NASA archive")

    monkeypatch.setattr(main.power, "historical_daily", fake_power_history)
    monkeypatch.setattr(main, "historical_climate_daily_real", forbidden_non_nasa_fallback)

    response = client.get(
        "/api/earth/trends/analyze",
        params={
            "lat": 12.3375,
            "lon": 75.8069,
            "variables": "t2m,precipitation",
            "start_year": 2017,
            "end_year": 2024,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert set(body["variables_evaluated"]) == {"t2m", "precipitation"}
    assert body["metadata"]["t2m"]["provider"] == "NASA POWER Daily Point API"
    assert body["metadata"]["precipitation"]["provider"] == "NASA POWER Daily Point API"
    assert body["trends"]["t2m"]["n"] == 96
    assert body["trends"]["precipitation"]["n"] == 96
    assert body["trends"]["t2m"]["data_class"] == "NASA_MODEL_OUTPUT"
    assert body["trends"]["precipitation"]["data_class"] == "NASA_MODEL_OUTPUT"


def test_modis_ndvi_trend_uses_quality_filtered_earth_engine_observations(monkeypatch):
    observations = []
    for year in range(2015, 2025):
        for month in range(1, 13):
            observations.append({
                "date": f"{year}-{month:02d}-08",
                "value": 0.78 - (year - 2015) * 0.004 + month * 0.0002,
            })

    def fake_modis_timeseries(layer_id, lat, lon, start_date, end_date):
        assert layer_id == "modis_ndvi"
        assert start_date == "2015-01-01"
        assert end_date == "2025-01-01"
        return {
            "source": "Test NASA Terra MODIS / Earth Engine fixture",
            "dataset": "MODIS/061/MOD13Q1",
            "quality_mask": "SummaryQA <= 1",
            "observations": observations,
        }

    monkeypatch.setattr(main.ee, "timeseries", fake_modis_timeseries)
    response = client.get(
        "/api/earth/investigate",
        params={
            "lat": 12.3375,
            "lon": 75.8069,
            "variable": "modis_ndvi",
            "region_name": "Kodagu MODIS test area",
            "start_year": 2015,
            "end_year": 2024,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["variables_evaluated"] == ["modis_ndvi"]
    assert body["metadata"]["modis_ndvi"]["provider"] == "Test NASA Terra MODIS / Earth Engine fixture"
    assert body["metadata"]["modis_ndvi"]["quality_control"] == "SummaryQA <= 1"
    assert body["trends"]["modis_ndvi"]["n"] == 120
    assert body["trends"]["modis_ndvi"]["data_class"] == "NASA_DIRECT_OBSERVATION"
    assert body["time_series"]["modis_ndvi"]["dates"][0] == "2015-01-08"


def test_modis_lst_reports_credential_or_provider_failure_without_fabricating_data(monkeypatch):
    def unavailable_modis(*args, **kwargs):
        raise RuntimeError("Earth Engine is not authenticated")

    monkeypatch.setattr(main.ee, "timeseries", unavailable_modis)
    response = client.get(
        "/api/earth/investigate",
        params={
            "lat": 12.3375,
            "lon": 75.8069,
            "variable": "modis_lst_day",
            "start_year": 2015,
            "end_year": 2024,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["trends"] == {}
    assert "Earth Engine is not authenticated" in body["unavailable_variables"]["modis_lst_day"]
