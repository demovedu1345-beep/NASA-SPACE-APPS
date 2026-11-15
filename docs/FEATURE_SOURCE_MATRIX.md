# EARTHSCOPE / VANRAKSHAK — Runtime Feature-to-Source Matrix

**Repository:** `demovedu1345-beep/NASA-SPACE-APPS`  
**Audit date:** 2026-11-15  
**Scope:** Existing repository adapters and read-only production health checks. This document does not claim that every source is configured or every feature has been exercised end-to-end.

## Runtime provider snapshot

The production `/api/source-health` endpoint was queried for Kodagu (12.3375 N, 75.8069 E) on 2026-11-15. The returned provider states were:

| Provider | Observed state | Operational interpretation |
|---|---|---|
| Copernicus STAC | OK | Sentinel-2 catalogue reachable |
| Element 84 Earth Search | OK | Public Sentinel-2 catalogue/COG path reachable |
| Open-Meteo | OK | Weather and historical climate adapter reachable |
| NASA POWER | OK | NASA climate-model/reanalysis adapter reachable |
| Sentinel-1 ASF | OK | Radar scene discovery reachable |
| Microsoft Planetary Computer | OK | Public satellite catalogue reachable |
| NASA GIBS | OK | NASA imagery/map layer service reachable |
| NASA EONET | OK | Natural-event service reachable; a separate Kodagu request returned zero events |
| Nominatim / Photon | OK | Geocoding adapters reachable |
| MET Norway | OK | Weather fallback reachable |
| Google News RSS | OK | News/context feed reachable |
| SoilGrids | TIMEOUT | Probe exceeded the 5-second health budget; do not show as healthy |
| NASA FIRMS | NOT_CONFIGURED | MAP key absent; EONET/GIBS context is not equivalent to pixel-level FIRMS detections |
| Protected Planet | NOT_CONFIGURED | Token absent; use only the configured OSM reference fallback where it returns data |
| Google Earth Engine | NOT_CONFIGURED | Earth Engine datasets requiring project credentials cannot be treated as available |

Health checks show endpoint reachability at probe time, not completeness of a particular raster, scene, region, or date window. Cached probes may report very low latency. Satellite imagery is not continuous live video.

## Feature matrix

| # | Feature | Primary implementation / endpoint | Evidence source | Fallback or limitation |
|---:|---|---|---|---|
| 1 | Real Satellite Monitoring | `/api/satellite/latest`, `/api/map/satellite-layer` | Copernicus STAC, Earth Search, Planetary Computer; NASA GIBS for supported layers | Latest available scene, not live video; scene capture timestamp and cloud cover matter |
| 2 | Forest Cover Monitoring | `/api/layers`, `/api/map/gfw-layer` | GFW public tiles and Sentinel-2-derived masks | Dynamic World/Hansen Earth Engine layers require Earth Engine credentials |
| 3 | AI Deforestation Detection | `/api/analysis/remote-change`, `/api/analysis/sar-change`, `/api/ai/change-model/status` | Sentinel-2 multispectral indices; Sentinel-1 ASF where usable | Source-backed baseline works; Open-CD/deep model is not configured or validated in the observed production runtime |
| 4 | Before–After Satellite Comparison | `/api/map/compare`, `/api/analysis/remote-change` | Historical Sentinel-2/Landsat scenes available through configured adapters | Must show matched dates, resolution, cloud mask and source coverage; unavailable dates must remain unavailable |
| 5 | Multi-Spectral Analysis | `/api/map/satellite-layer`, `/api/analysis/remote-change` | Sentinel-2 red/NIR/SWIR bands and derived NDVI/NDMI/NBR/NDWI | Derived indices require valid pixels and cloud/shadow masking; not every layer has every date |
| 6 | Multi-Layer Earth Map | `/api/layers`, `/api/gibs/layer/{layer_id}`, `/api/map/gfw-layer` | NASA GIBS, Sentinel-2, GFW and supported provider tiles | Earth Engine and Bhuvan/MOSDAC layers are separately gated by credentials and service response |
| 7 | Deep Region Investigation | `/api/investigate`, `/api/analysis/evidence-chain` | Geocoding, satellite scenes, climate, event and contextual adapters | Each component can fail independently; incomplete evidence must be disclosed in the result |
| 8 | Temperature Intelligence | `/api/weather`, `/api/climate/anomaly` | Open-Meteo, MET Norway, NASA POWER | NASA POWER is gridded model/reanalysis output; it is not a local station or direct satellite temperature measurement |
| 9 | Weather Intelligence | `/api/weather`, `/api/climate/forecast` | Open-Meteo and MET Norway | Forecast horizon and fields depend on the provider response; no forecast days should be invented |
| 10 | Drought & Water Stress | `/api/climate/anomaly`, `/api/weather`, Earth Engine water layers | Historical climate and weather adapters | SoilGrids timed out; Earth Engine unavailable in the observed runtime; soil/water fields must show their own source status |
| 11 | Fire & Heat Detection | `/api/fire`, `/api/fire/intelligence`, `/api/eonet/events`, `/api/gibs/catalog` | NASA EONET and NASA GIBS; FIRMS when configured | FIRMS MAP key absent. EONET/GIBS context is not equivalent to pixel-level thermal detections. Kodagu event query returned zero events |
| 12 | Vegetation Health | `/api/analysis/vegetation-series`, `/api/map/satellite-layer?mode=ndvi` | Sentinel-2 L2A / Earth Search | Irregular scene cadence and cloud masking limit temporal density; observed endpoint returned 8 usable scene summaries for one test window |
| 13 | Environmental Anomaly Radar | `/api/intelligence/anomaly-radar`, `/api/climate/anomaly` | Derived climate, weather, vegetation and risk signals | An anomaly is a screening signal; it does not establish cause or field-confirmed damage |
| 14 | AI Forest Doctor | `/api/intelligence/forest-doctor`, `/api/analysis/evidence-chain` | Multi-source evidence bundle | Interpretation must state which components were unavailable; it is not an independent field diagnosis |
| 15 | Smart Warning System | `/api/intelligence/risk`, `/api/analysis/evidence-chain` | Rule-based risk from observed/derived environmental evidence | Risk class is an estimate; missing evidence must not be silently replaced with invented values |
| 16 | Threat Prediction | `/api/intelligence/predict-location`, `/api/intelligence/predict` | Sentinel-derived screening-risk history | Baseline projection only; temporal holdout metrics require sufficient observations and do not measure deforestation classification accuracy |
| 17 | Threat Cascade Engine | `/api/intelligence/cascade`, `/api/intelligence/live` | Derived relationships among heat, drought, vegetation stress, fire and canopy change | Scenario relationships are explanatory models, not proof that one event caused another |
| 18 | AI Priority Engine | `/api/intelligence/compare-live`, `/api/intelligence/risk` | Evidence-backed risk, severity, recency and contextual factors | Priority depends on source completeness and selected AOI; show missing evidence |
| 19 | Investigation / Patrol Optimizer | `/api/patrol/live`, `/api/patrol/road-route` | Change polygons, OSM road network and OSRM route geometry | Requires valid before/after dates and candidate geometry; straight-line fallback is not equivalent to a verified road route |
| 20 | AI What-If Simulator | `/api/intelligence/what-if-location`, `/api/intelligence/what-if` | Selected location's real-evidence baseline plus user scenario deltas | Scenario deltas are hypothetical; outputs are not forecasts or observed outcomes |
| 21 | Intervention Engine | `/api/intelligence/intervention`, `/api/intelligence/live` | Evidence-derived risk drivers and action rules | Recommendations are decision support; implementation and ecological suitability require field review |
| 22 | Recovery Intelligence | `/api/analysis/recovery-location`, `/api/intelligence/recovery` | Sentinel-2 vegetation/forest-fraction time series | Observed Kodagu test returned a deteriorating screening result from 8 scenes; seasonality and cloud gaps remain limitations |
| 23 | Recovery Exit Conditions | `/api/analysis/recovery-location`, `/api/intelligence/recovery` | Baseline-relative NDVI and forest-fraction conditions | Exit thresholds are model rules, not field certification |
| 24 | Forest Resilience Score | `/api/intelligence/resilience`, `/api/intelligence/live` | Derived environmental and forest evidence | Composite estimate; each component and missing input must be visible |
| 25 | Protected Area Intelligence | `/api/protected-area/context`, `/api/protected-areas` | Protected Planet when token is configured; OSM protected-area reference fallback | Protected Planet token absent; OSM coverage is incomplete and does not prove absence of protection |
| 26 | Forest Fragmentation Analysis | `/api/analysis/fragmentation`, `/api/analysis/remote-change` | Internal raster/vector metrics derived from provider imagery | Requires valid raster/change geometry; no result should be inferred without inputs |
| 27 | Carbon Loss Calculator | `/api/carbon`, `/api/analysis/evidence-chain` | Location-specific biomass/carbon references where available | GEDI/Earth Engine paths are gated; Tier-1 values are reference estimates, not local measurements |
| 28 | Climate–Forest Correlation | `/api/analysis/climate-forest-correlation` | Sentinel-2 scenes matched with Open-Meteo historical climate | Endpoint was exercised and returned 8 date-matched rows in one test window; correlation does not establish causation |
| 29 | AI Evidence Chain | `/api/analysis/evidence-chain` | Satellite, radar, climate, fire, protected-area and human-pressure adapters | Each source contribution must include its status/provenance; do not present missing evidence as negative evidence |
| 30 | Explainable AI | `/api/intelligence/risk`, `/api/analysis/evidence-chain` | Rule/feature contribution data; SHAP only after a validated supervised model exists | No validated Open-CD checkpoint/benchmark was present in the observed production runtime; do not claim deep-model accuracy |
| 31 | Natural-Language Earth Query | `/api/query/live`, `/api/query` | Existing query parser and structured filters | Query parsing is not a generative scientific conclusion; results need a separate evidence workflow |
| 32 | Automatic Investigation Report | `/api/report`, `/api/report/investigation` | Evidence-chain result, source metadata and report renderer | Report quality is constrained by source completeness; verify PDF generation and citations for each investigation |
| 33 | Regional Threat Comparison | `/api/intelligence/compare-live`, `/api/intelligence/compare-regions` | Repeated location-level evidence and normalized risk metrics | Comparisons must use comparable periods, resolution and data classes |
| 34 | Forest Time Machine | `/api/time-machine` | Historical satellite/land-cover imagery | Timeline is constrained by each product's actual archive and observation availability |
| 35 | Live Command Center | `/api/health`, `/api/source-health`, `/api/fallbacks/status` | Runtime health and provider probes | Health is point-in-time telemetry; one successful probe does not guarantee every layer/query succeeds |
| 36 | Forest Digital Profile | `/api/forest-profile` | Available satellite, climate, terrain, soil, conservation and contextual datasets | The profile must distinguish unavailable fields from zero-valued measurements |
| 37 | News & Internet Intelligence | `/api/news`, `/api/analysis/evidence-chain` | Google News RSS and configured news/context adapters | News is supporting context only; it is never proof of causation or illegal activity |

## Release gates

1. The CI suite must pass, including API proxy compatibility tests and existing backend tests.
2. The latest Vercel build must include the tested commit and return HTTP 200 for the research dashboard.
3. The Trend Detective must return provider-backed series or a clear unavailable state for every selected variable.
4. No module may label an unconfigured provider as healthy.
5. No page may label satellite imagery as continuous live video.
6. A release is not complete until the production domain has been smoke-tested after promotion.

## Credential configuration blockers observed at audit time

- `FIRMS_MAP_KEY` is not configured.
- Protected Planet token is not configured.
- Earth Engine project/credentials are not configured.
- SoilGrids probe timed out at the observation point.

Do not publish real API tokens in GitHub, the browser bundle, or this document. Use the project's deployment secret store and verify only presence/status, never print secret values.
