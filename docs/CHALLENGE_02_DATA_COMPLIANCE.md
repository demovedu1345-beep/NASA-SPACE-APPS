# EARTHSCOPE — NASA Challenge 02 Data Compliance

## What Challenge 02 actually requires

The tool must let a user select Earth-science variables measured by NASA missions or produced by NASA models, acquire those variables for a chosen region, build a sufficiently long time series, visualize it, estimate the rate of change, and test whether the trend is statistically significant. A catalogue entry or map tile alone does not satisfy data acquisition or trend analysis.

## Runtime truth table

| Source / product | Scientific role | Current status in the active FastAPI trend route |
|---|---|---|
| NASA POWER T2M | NASA POWER / GMAO gridded near-surface air-temperature model/reanalysis | **Connected** — daily values retrieved from NASA POWER and aggregated to monthly means |
| NASA POWER PRECTOTCORR | NASA POWER gridded precipitation estimate | **Connected** — daily values retrieved from NASA POWER and summed to monthly totals |
| Sentinel-2 MSI L2A NDVI | ESA Copernicus satellite-derived vegetation index | **Connected as complementary non-NASA evidence** — must not be described as a NASA mission variable |
| NASA Terra MODIS MOD13Q1 NDVI/EVI | NASA satellite vegetation-index product | **Catalogue / credential-gated** — not counted as a live trend variable until a real AppEEARS or Earth Engine extraction succeeds |
| NASA Terra MODIS MOD11A2 LST | NASA satellite land-surface temperature | **Catalogue / credential-gated** — no trend result until real quality-filtered values are extracted |
| NASA/JAXA GPM IMERG | Satellite precipitation retrieval | **Catalogue / extraction pending** — CMR discovery is not a retrieved time series |
| NASA MERRA-2 / GLDAS | NASA model/reanalysis land and atmospheric variables | **Catalogue / extraction pending** — must be fetched as real regional values before trend calculation |
| NASA AIRS / Aura OMI | NASA atmospheric composition/sounding observations | **Catalogue / extraction pending** — no synthetic substitute is allowed |
| NASA GIBS | NASA imagery visualization service | **Imagery only** — map tiles are not numeric time-series measurements |
| NASA EONET | Natural-event metadata | **Context only** — event records are not a continuous environmental variable |
| NASA FIRMS | Satellite fire detections | **Credential-gated** — MAP key required for the full detections API; never label EONET fallback as FIRMS detections |

## Statistical contract

For each variable that has a real time series:

1. Preserve observation dates, source, product identifier, units, resolution, and retrieval time.
2. Exclude provider fill values and invalid quality flags; never replace missing observations with zero.
3. Sort by actual observation date and retain missing intervals.
4. Calculate Mann–Kendall trend statistics and Sen's slope using elapsed time, not an assumed uniform sample index where observations are irregular.
5. Report p-value, confidence interval, sample count, and the selected significance threshold.
6. Report seasonal diagnostics where repeated seasonal samples exist.
7. Apply Benjamini–Hochberg correction when testing multiple variables and show both nominal p-values and adjusted q-values.
8. Treat serial autocorrelation as a limitation or correct it before claiming inferential significance.
9. Label correlation as descriptive; it does not establish causation.
10. If data are insufficient or a provider fails, return an explicit unavailable state and no trend conclusion.

## Important source distinctions

- Sentinel-2 is an ESA/Copernicus mission. It is useful supplementary evidence, but it is not a NASA satellite.
- NASA POWER is a NASA model/reanalysis-derived gridded product, not a ground weather station.
- MODIS and GPM are satellite products. Their catalogue metadata, CMR collection discovery, or GIBS imagery does not prove that regional numerical values were extracted.
- AppEEARS request previews are not submitted jobs. A real task ID, completed status, and downloaded output are required before the UI can say the product was extracted.
- A map being rendered does not prove that its underlying variable has a valid long-term time series.

## Credential and deployment gates

- NASA POWER: public API; no key required for the current product path.
- NASA Earthdata / AppEEARS: requires an Earthdata Login account/token for authenticated task submission and retrieval.
- Google Earth Engine: requires an enabled Google Cloud project and valid Earth Engine credentials.
- NASA FIRMS: requires a valid MAP key for the full fire-detection API.
- Missing credentials must produce a precise unavailable/credential-required state, never sample data or fabricated measurements.

## Release gate

Do not call the project fully NASA-data-complete until the live production backend passes:
- NASA POWER temperature and precipitation extraction at a selected coordinate;
- MODIS MOD13Q1 and MOD11A2 regional extraction with QA masking and source timestamps;
- any additional claimed GPM/MERRA-2/GLDAS/AIRS/OMI products with real retrieved records;
- statistical tests against deterministic fixtures and at least one independently checked real-data case;
- API source-health and frontend interaction tests;
- production API proxy and backend health checks.
