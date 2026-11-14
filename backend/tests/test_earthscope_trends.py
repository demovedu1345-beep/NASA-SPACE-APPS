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
