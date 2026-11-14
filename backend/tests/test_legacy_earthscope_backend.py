from __future__ import annotations

import asyncio
import json
from datetime import date, timedelta

import earthscope_backend


class _FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def test_nasa_power_daily_precipitation_is_summed_to_monthly_total(monkeypatch):
    parameter = {"T2M": {}, "T2M_MAX": {}, "T2M_MIN": {}, "PRECTOTCORR": {}}
    day = date(2020, 1, 1)
    while day.month == 1:
        key = day.strftime("%Y%m%d")
        parameter["T2M"][key] = 20.0
        parameter["T2M_MAX"][key] = 25.0
        parameter["T2M_MIN"][key] = 15.0
        parameter["PRECTOTCORR"][key] = 1.0
        day += timedelta(days=1)

    payload = {"properties": {"parameter": parameter}, "header": {"title": "NASA POWER"}}
    monkeypatch.setattr(
        earthscope_backend.urllib.request,
        "urlopen",
        lambda request, timeout=30: _FakeResponse(payload),
    )

    result = asyncio.run(earthscope_backend.fetch_nasa_power_monthly(12.3, 75.8, 2020, 2020))

    assert result["ok"] is True
    assert result["t2m"] == [{"date": "2020-01", "value": 20.0}]
    assert result["precipitation"] == [{"date": "2020-01", "value": 31.0}]
    assert "summed to monthly total" in result["meta"]["aggregation"]


def test_legacy_trend_engine_never_substitutes_synthetic_ndvi(monkeypatch):
    monthly = []
    for year in range(2017, 2025):
        for month in range(1, 13):
            monthly.append({
                "date": f"{year}-{month:02d}",
                "value": 24.0 + (year - 2017) * 0.03 + month * 0.01,
            })

    async def fake_power(*args, **kwargs):
        return {
            "ok": True,
            "t2m": monthly,
            "precipitation": monthly,
            "meta": {"source": "NASA POWER Daily Point API"},
        }

    monkeypatch.setattr(earthscope_backend, "fetch_nasa_power_monthly", fake_power)

    result = asyncio.run(
        earthscope_backend.run_earthscope_investigation(
            12.3, 75.8, "Test region", ["ndvi", "t2m"], 2017, 2024
        )
    )

    assert result["ok"] is True
    assert result["variables_evaluated"] == ["t2m"]
    assert "ndvi" in result["unavailable_variables"]
    assert "No synthetic or proxy series" in result["unavailable_variables"]["ndvi"]
    assert result["results"]["t2m"]["provenance"]["data_class"] == "NASA_MODEL_OUTPUT"
