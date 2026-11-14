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
    assert body["count"] == 3
    assert set(body["variables"]) == {"ndvi", "t2m", "precipitation"}


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
