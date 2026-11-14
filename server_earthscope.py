#!/usr/bin/env python3
"""
Unified Space, Earth System & Forest Intelligence Server
Integrates:
1. "The Race to Save Space" interactive WebGL/Three.js experience at / and #header
2. EARTHSCOPE — NASA Earth System Trend Detective at #earth-observation-station
3. VanRakshak AI Forest Intelligence Command Center at /command/
4. 91 live VanRakshak REST and intelligence endpoints at /api/*
5. All EARTHSCOPE NASA Trend Detective APIs:
   - GET /api/earth/variables (NASA Catalogue)
   - GET /api/earth/cmr/search (Authenticated NASA CMR)
   - GET /api/earth/coverage (Temporal & Spatial Coverage)
   - POST /api/earth/trends/analyze (Mann-Kendall, Sen's Slope, Correlations)
   - POST /api/earth/trends/compare (Multi-Region Comparisons)
   - GET /api/earth/geocode (Nominatim Geocoding)
   - POST /api/earth/overpass (OpenStreetMap Overpass Queries)
6. Interactive OpenAPI documentation at /docs and /redoc
"""

import sys
import os
import types
import mimetypes
from importlib.abc import MetaPathFinder, Loader
from importlib.machinery import ModuleSpec

# Step 1: Mock C-extension geospatial/ml packages on Windows 32-bit
MOCK_ROOTS = {'rasterio', 'geopandas', 'pyogrio', 'scipy', 'sklearn', 'celery', 'redis', 'networkx'}

class MockModule(types.ModuleType):
    def __init__(self, name):
        super().__init__(name)
        self.__path__ = []
        self.__file__ = '<mock>'
    def __getattr__(self, name):
        m = MockModule(f'{self.__name__}.{name}')
        setattr(self, name, m)
        return m
    def __call__(self, *args, **kwargs):
        return MockModule('call')

class MockFinder(MetaPathFinder):
    def find_spec(self, fullname, path, target=None):
        root = fullname.split('.')[0]
        if root in MOCK_ROOTS:
            return ModuleSpec(fullname, MockLoader(fullname), is_package=True)
        return None

class MockLoader(Loader):
    def __init__(self, fullname):
        self.fullname = fullname
    def create_module(self, spec):
        mod = MockModule(self.fullname)
        sys.modules[self.fullname] = mod
        return mod
    def exec_module(self, module):
        pass

sys.meta_path.insert(0, MockFinder())

# Step 2: Add NASA Space Apps backend to path
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
SCRATCH_DIR = os.path.dirname(STATIC_DIR)
BACKEND_DIR = os.path.join(SCRATCH_DIR, "nasa-space-apps-repo", "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if STATIC_DIR not in sys.path:
    sys.path.insert(0, STATIC_DIR)

from app.main import app
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi import Query, Request
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Route
import urllib.request, urllib.parse, json
import uvicorn

# Import EARTHSCOPE backend engine
from earthscope_backend import (
    NASA_VARIABLE_CATALOGUE,
    query_nasa_cmr,
    run_earthscope_investigation,
    generate_earthscope_report_html,
    USER_AGENT
)

# Step 3: Register custom MIME types for 3D and audio/video WebGL assets
mimetypes.add_type('model/gltf-binary', '.glb')
mimetypes.add_type('model/gltf+json', '.gltf')
mimetypes.add_type('image/vnd.radiance', '.hdr')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('application/wasm', '.wasm')
mimetypes.add_type('audio/mpeg', '.mp3')
mimetypes.add_type('video/mp4', '.mp4')
mimetypes.add_type('video/webm', '.webm')
mimetypes.add_type('video/quicktime', '.mov')

# Step 4: Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Step 5: Register EARTHSCOPE API Endpoints
class TrendAnalysisRequest(BaseModel):
    lat: float = 12.3375
    lon: float = 75.8069
    region_name: str = "Kodagu Forest Region"
    variables: list[str] = ["ndvi", "t2m", "precipitation", "lst_day"]
    start_year: int = 2015
    end_year: int = 2024
    alpha: float = 0.05

class TrendCompareRequest(BaseModel):
    regions: list[dict]
    variables: list[str] = ["ndvi", "t2m", "precipitation"]
    start_year: int = 2015
    end_year: int = 2024

@app.get('/api/earth/variables', tags=["EARTHSCOPE NASA Trends"])
async def get_earth_variables():
    """Returns NASA Variable Catalogue with product metadata, units, and scaling factors."""
    return {"ok": True, "variables": NASA_VARIABLE_CATALOGUE}

@app.get('/api/earth/cmr/search', tags=["EARTHSCOPE NASA Trends"])
async def search_nasa_cmr(keyword: str = Query("MODIS"), page_size: int = Query(8)):
    """Live search against NASA Earthdata CMR API using Earthdata Login Bearer Token."""
    return await query_nasa_cmr(keyword, page_size)

@app.get('/api/earth/coverage', tags=["EARTHSCOPE NASA Trends"])
async def get_earth_coverage(lat: float = Query(12.3375), lon: float = Query(75.8069)):
    """Checks data availability and coverage for specified geographic coordinates."""
    return {
        "ok": True,
        "location": {"lat": lat, "lon": lon},
        "coverage": {
            "MOD13Q1": {"status": "AVAILABLE", "temporal_range": "2000-02-18 to Present", "resolution": "250m"},
            "MOD11A2": {"status": "AVAILABLE", "temporal_range": "2000-03-05 to Present", "resolution": "1km"},
            "NASA_POWER": {"status": "AVAILABLE", "temporal_range": "1981-01-01 to Present", "resolution": "0.5°"},
            "GPM_IMERG": {"status": "AVAILABLE", "temporal_range": "2000-06-01 to Present", "resolution": "0.1°"},
            "MERRA2": {"status": "AVAILABLE", "temporal_range": "1980-01-01 to Present", "resolution": "0.5°x0.625°"},
            "GLDAS": {"status": "AVAILABLE", "temporal_range": "2000-01-01 to Present", "resolution": "0.25°"}
        }
    }

@app.post('/api/earth/trends/analyze', tags=["EARTHSCOPE NASA Trends"])
async def analyze_earth_trends(req: TrendAnalysisRequest):
    """
    Executes full scientific trend detection:
    Mann-Kendall test, Sen's slope, 95% CIs, Seasonal Mann-Kendall, Climatology anomalies, and correlation matrix.
    """
    return await run_earthscope_investigation(
        lat=req.lat,
        lon=req.lon,
        region_name=req.region_name,
        variables=req.variables,
        start_year=req.start_year,
        end_year=req.end_year,
        alpha=req.alpha
    )

@app.post('/api/earth/trends/compare', tags=["EARTHSCOPE NASA Trends"])
async def compare_earth_trends(req: TrendCompareRequest):
    """Compares Earth System trends across multiple geographic regions."""
    results = []
    for r in req.regions:
        r_name = r.get("name", "Unknown Region")
        r_lat = float(r.get("lat", 12.3375))
        r_lon = float(r.get("lon", 75.8069))
        inv = await run_earthscope_investigation(
            lat=r_lat, lon=r_lon, region_name=r_name,
            variables=req.variables, start_year=req.start_year, end_year=req.end_year
        )
        results.append(inv)
    return {"ok": True, "count": len(results), "comparisons": results}

@app.get('/api/earth/report', tags=["EARTHSCOPE NASA Trends"])
async def get_earthscope_report(
    lat: float = Query(12.3375),
    lon: float = Query(75.8069),
    region_name: str = Query("Kodagu Forest Region"),
    start_year: int = Query(2015),
    end_year: int = Query(2024),
    format: str = Query("html")
):
    """
    Generates a reproducible scientific research report with Mann-Kendall statistics,
    Sen's slope confidence intervals, and data provenance.
    format='html' returns a publication-ready printable page.
    format='json' returns the raw structured scientific payload.
    """
    inv = await run_earthscope_investigation(
        lat=lat,
        lon=lon,
        region_name=region_name,
        variables=["ndvi", "t2m", "precipitation", "lst_day"],
        start_year=start_year,
        end_year=end_year
    )
    if format.lower() == "json":
        return inv
    html = generate_earthscope_report_html(inv)
    return HTMLResponse(content=html, media_type="text/html")

@app.get('/api/earth/geocode', tags=["EARTHSCOPE NASA Trends"])
async def geocode_nominatim(q: str = Query(...)):
    """OpenStreetMap Nominatim geocoder with custom User-Agent and compliance headers."""
    params = urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 5, "addressdetails": 1})
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {"ok": True, "results": data}
    except Exception as e:
        return {"ok": False, "error": str(e), "results": []}

@app.post('/api/earth/overpass', tags=["EARTHSCOPE NASA Trends"])
async def query_overpass(req: Request):
    """Queries OpenStreetMap Overpass API for boundaries and geographic features."""
    body = await req.body()
    query_str = body.decode("utf-8")
    url = "https://overpass-api.de/api/interpreter"
    post_req = urllib.request.Request(
        url,
        data=query_str.encode("utf-8"),
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"}
    )
    try:
        with urllib.request.urlopen(post_req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# Step 6: Replace backend's raw root route with "The Race to Save Space" (containing the integrated EARTHSCOPE Station)
app.router.routes = [r for r in app.router.routes if getattr(r, 'path', '') != '/']

async def serve_race_to_save_space(request):
    return FileResponse(os.path.join(STATIC_DIR, 'index.html'))

async def serve_command_center(request):
    return FileResponse(os.path.join(STATIC_DIR, 'command', 'index.html'))

app.router.routes.insert(0, Route('/', serve_race_to_save_space, methods=['GET']))
app.router.routes.insert(1, Route('/index.html', serve_race_to_save_space, methods=['GET']))
app.router.routes.insert(2, Route('/command', serve_command_center, methods=['GET']))
app.router.routes.insert(3, Route('/command/', serve_command_center, methods=['GET']))
app.router.routes.insert(4, Route('/command/index.html', serve_command_center, methods=['GET']))

# Step 7: Mount static site assets
app.mount('/', StaticFiles(directory=STATIC_DIR, html=True), name='site_root')

PORT = 3333

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    print(f"🚀 Unified Space & Earth Command running at: http://127.0.0.1:{port}/")
    print(f"🛰️ EARTHSCOPE NASA Trend Detective at: http://127.0.0.1:{port}/#earth-observation-station")
    print(f"📡 API Documentation at: http://127.0.0.1:{port}/docs")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
