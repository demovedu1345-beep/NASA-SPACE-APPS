from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.main import app
from app.services.feature_status import FEATURE_CAPABILITIES
from app.services.layers import LAYER_GROUPS

errors: list[str] = []

# 1) Preserve the product's 37 capability contract.
if len(FEATURE_CAPABILITIES) != 37:
    errors.append(f"Expected 37 capabilities, found {len(FEATURE_CAPABILITIES)}")
if [item.get("id") for item in FEATURE_CAPABILITIES] != list(range(1, 38)):
    errors.append("Feature IDs must remain exactly 1..37")

# 2) Every capability endpoint must be registered by the running FastAPI app.
routes = {getattr(route, "path", None) for route in app.routes}

def route_exists(path: str) -> bool:
    if path in routes:
        return True
    parts = path.strip("/").split("/")
    for route in routes:
        if not route:
            continue
        route_parts = route.strip("/").split("/")
        if len(route_parts) == len(parts) and all(
            a == b or (a.startswith("{") and a.endswith("}"))
            for a, b in zip(route_parts, parts)
        ):
            return True
    return False

for feature in FEATURE_CAPABILITIES:
    endpoints = feature.get("endpoints") or []
    if not endpoints:
        errors.append(f"Feature {feature['id']} {feature['name']} has no runtime endpoint")
    for endpoint in endpoints:
        path = endpoint.split("?", 1)[0]
        if not route_exists(path):
            errors.append(f"Feature {feature['id']} {feature['name']} references missing route {path}")

# 3) Validate the active Mission Control frontend (not archived web/app.js).
html_path = ROOT / "web" / "index.html"
html = html_path.read_text(encoding="utf-8")
command_js = (ROOT / "web" / "command-center.js").read_text(encoding="utf-8")
cinematic_js = (ROOT / "web" / "cinematic-dashboard.js").read_text(encoding="utf-8")

required_views = {
    "overview", "observatory", "satellites", "layers", "forest", "fire",
    "climate", "intelligence", "analytics", "trend-detective",
    "operations", "reports", "systems",
}
present_views = set(re.findall(r'data-view="([^"]+)"', html))
for view in sorted(required_views - present_views):
    errors.append(f"Active Mission Control workspace #{view} is missing")

required_sections = {
    "mainNav", "earthCanvas", "earthDetailPanel", "earthDetailTitle",
    "worldMap", "searchResults", "layerInspectorContent", "layerGroups",
    "forestResult", "fireResults", "climateResult", "systemResults", "featureResults",
}
html_ids = set(re.findall(r'id="([^"]+)"', html))
for section in sorted(required_sections - html_ids):
    errors.append(f"Active Mission Control section #{section} is missing")

# Explicit controls must be referenced by the active controller (which uses a
# shared $() helper and delegated click listeners rather than web/app.js).
button_ids = list(dict.fromkeys(re.findall(r'<button[^>]*id="([^"]+)"', html)))
for button_id in button_ids:
    if button_id not in command_js and button_id not in cinematic_js:
        errors.append(f"Active dashboard button #{button_id} is not referenced by an active controller")

# The active controller must load the core provider-backed pages and services.
required_runtime_paths = (
    "/api/health", "/api/source-health", "/api/layers",
    "/api/eonet/events", "/api/weather", "/api/fire",
    "/api/satellite/latest", "/api/gibs/catalog", "/api/earth-engine/catalog",
    "/api/bhuvan/info", "/api/mosdac/info", "/api/forest-profile",
    "/api/investigate", "/api/features/status",
)
for path in required_runtime_paths:
    if path not in command_js:
        errors.append(f"Active controller does not reference required runtime endpoint {path}")

if "./dashboard/research.html" not in html or "trend-detective" not in command_js:
    errors.append("NASA Trend Detective is not integrated as a first-class workspace")

# 4) Layer catalogue remains served through the API and consumed by the active UI.
if len(LAYER_GROUPS) < 10:
    errors.append(f"Expected at least 10 geospatial layer groups, found {len(LAYER_GROUPS)}")
if "/api/layers" not in command_js:
    errors.append("Active Mission Control does not load the provider-backed layer registry")

# 5) Production UI must not expose synthetic demo scenario loaders.
for forbidden in ("demoScenarioSelect", "loadDemoScenario", "PRE-FLIGHT VERIFIED DEMO"):
    if forbidden in html or forbidden in command_js:
        errors.append(f"Production dashboard still exposes forbidden demo control/text: {forbidden}")

# 6) What-if deltas must default to neutral wherever that legacy form is present.
for input_id in ("whatTemp", "whatRain", "whatFire"):
    match = re.search(rf'id="{input_id}"[^>]*value="([^"]+)"', html)
    if match and float(match.group(1)) != 0:
        errors.append(f"Scenario input #{input_id} must default to zero in production")

# 7) Both 3D globes must use the shared real-data WGS84 model.
earth_model_path = ROOT / "web" / "earth-model.js"
if not earth_model_path.exists():
    errors.append("Shared Earth model module web/earth-model.js is missing")
else:
    earth_model = earth_model_path.read_text(encoding="utf-8")
    for symbol in (
        "applyWgs84Ellipsoid", "loadGlobalTerrariumDEM",
        "buildTerrainHeightSamples", "applyTerrainDisplacement",
        "earthPointToLatLon", "getSolarDirection",
    ):
        if f"function {symbol}" not in earth_model and f" {symbol}(" not in earth_model:
            errors.append(f"Shared Earth model function {symbol} is missing")

    for source in (
        "s3.amazonaws.com/elevation-tiles-prod/terrarium",
        "NASA",
    ):
        if source not in earth_model:
            errors.append(f"Earth model source marker {source!r} is missing")

if './earth-model.js' not in command_js:
    errors.append("Mission Control does not import the shared WGS84 Earth model")
for control_id in ("earthReliefToggle", "earthCloudToggle", "earthNightToggle"):
    if control_id not in html or control_id not in command_js:
        errors.append(f"Mission Control Earth layer control #{control_id} is not wired")

research_path = ROOT / "web" / "dashboard" / "research.html"
research_html = research_path.read_text(encoding="utf-8")
if 'import * as EarthModel from "../earth-model.js"' not in research_html:
    errors.append("Trend Detective does not import the shared WGS84 Earth model")
if "loadGlobalTerrariumDEM" not in research_html or "applyTerrainDisplacement" not in research_html:
    errors.append("Trend Detective does not load/apply real terrain elevation samples")
if "BlackMarble_2016_01deg.jpg" not in command_js or "BlackMarble_2016_01deg.jpg" not in research_html:
    errors.append("NASA VIIRS Black Marble night-light imagery is not configured in both globes")

if errors:
    print("EARTHSCOPE / VanRakshak acceptance check FAILED")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print("EARTHSCOPE / VanRakshak acceptance check PASSED")
print(f"- product capabilities: {len(FEATURE_CAPABILITIES)}/37")
print(f"- registered API routes: {len(routes)}")
print(f"- layer groups: {len(LAYER_GROUPS)}")
print(f"- active workspaces: {len(required_views)}/{len(required_views)}")
print(f"- active dashboard button IDs checked: {len(button_ids)}")
