from __future__ import annotations
from datetime import datetime, timedelta, timezone
from app.adapters.base import AdapterError
from app.config import settings

EE_LAYERS = {
    "dynamic_world_trees": {"dataset": "GOOGLE/DYNAMICWORLD/V1", "kind": "collection", "band": "trees", "vis": {"min": 0, "max": 1, "palette": ["0b1f15", "1fd17f"]}, "freshness": "DYNAMIC_RECENT", "resolution_m": 10},
    "dynamic_world_label": {"dataset": "GOOGLE/DYNAMICWORLD/V1", "kind": "collection", "band": "label", "vis": {"min": 0, "max": 8, "palette": ["419bdf","397d49","88b053","7a87c6","e49635","dfc35a","c4281b","a59b8f","b39fe1"]}, "freshness": "DYNAMIC_RECENT", "resolution_m": 10},
    "hansen_lossyear": {"dataset": "UMD/hansen/global_forest_change_2025_v1_13", "kind": "image", "band": "lossyear", "vis": {"min": 1, "max": 25, "palette": ["ffff00","ff0000"]}, "freshness": "HISTORICAL", "resolution_m": 30},
    "hansen_treecover": {"dataset": "UMD/hansen/global_forest_change_2025_v1_13", "kind": "image", "band": "treecover2000", "vis": {"min": 0, "max": 100, "palette": ["f2efe9","006400"]}, "freshness": "REFERENCE", "resolution_m": 30},
    "srtm_elevation": {"dataset": "USGS/SRTMGL1_003", "kind": "image", "band": "elevation", "vis": {"min": 0, "max": 3500, "palette": ["0b3d2e","d9c98b","ffffff"]}, "freshness": "REFERENCE", "resolution_m": 30},
    "jrc_water_occurrence": {"dataset": "JRC/GSW1_4/GlobalSurfaceWater", "kind": "image", "band": "occurrence", "vis": {"min": 0, "max": 100, "palette": ["ffffff","0050ff"]}, "freshness": "HISTORICAL", "resolution_m": 30},
    "modis_ndvi": {"dataset": "MODIS/061/MOD13Q1", "kind": "collection", "band": "NDVI", "qa_band": "SummaryQA", "qa_method": "lte", "qa_max": 1, "scale_factor": 0.0001, "offset": 0.0, "unit": "NDVI", "quality_label": "SummaryQA <= 1 (good or marginal)", "buffer_m": 1500, "vis": {"min": -2000, "max": 10000, "palette": ["8c510a","d8b365","f6e8c3","c7eae5","5ab4ac","01665e"]}, "freshness": "DYNAMIC_RECENT", "resolution_m": 250},
    "modis_lst": {"dataset": "MODIS/061/MOD11A2", "kind": "collection", "band": "LST_Day_1km", "qa_band": "QC_Day", "qa_method": "bitwise_eq", "qa_mask": 3, "qa_value": 0, "scale_factor": 0.02, "offset": -273.15, "unit": "°C", "quality_label": "QC_Day mandatory QA bits == 0", "buffer_m": 3000, "vis": {"min": 13000, "max": 16500, "palette": ["313695","74add1","ffffbf","f46d43","a50026"]}, "freshness": "DYNAMIC_RECENT", "resolution_m": 1000},
    "chirps_rainfall": {"dataset": "UCSB-CHG/CHIRPS/DAILY", "kind": "collection", "band": "precipitation", "vis": {"min": 0, "max": 100, "palette": ["ffffff","a6cee3","1f78b4","08306b"]}, "freshness": "DYNAMIC_RECENT", "resolution_m": 5566},
    "modis_burned_area": {"dataset": "MODIS/061/MCD64A1", "kind": "collection", "band": "BurnDate", "vis": {"min": 1, "max": 366, "palette": ["ffffcc","fd8d3c","bd0026"]}, "freshness": "DYNAMIC_RECENT", "resolution_m": 500},
    "gedi_agbd": {"dataset": "LARSE/GEDI/GEDI04_A_002_MONTHLY", "kind": "collection", "band": "agbd", "vis": {"min": 0, "max": 300, "palette": ["fff7bc","7fcdbb","2c7fb8","253494"]}, "freshness": "REFERENCE", "resolution_m": 25, "quality": "gedi_l4a"},
    "worldpop_population": {"dataset": "WorldPop/GP/100m/pop", "kind": "collection", "band": "population", "vis": {"min": 0, "max": 50, "palette": ["24126c","1fff4f","d4ff50"]}, "freshness": "REFERENCE", "resolution_m": 100, "static_latest": True},
    "human_modification": {"dataset": "CSP/HM/GlobalHumanModification", "kind": "collection", "band": "gHM", "vis": {"min": 0, "max": 1, "palette": ["0c0c0c","071aff","ff0000","ffbd03","fffdfd"]}, "freshness": "REFERENCE", "resolution_m": 1000, "static_latest": True},
    "srtm_slope": {"dataset": "USGS/SRTMGL1_003", "kind": "terrain", "band": "slope", "vis": {"min": 0, "max": 60, "palette": ["0b3d2e","f5d76e","a93226"]}, "freshness": "REFERENCE", "resolution_m": 30},
    "srtm_aspect": {"dataset": "USGS/SRTMGL1_003", "kind": "terrain", "band": "aspect", "vis": {"min": 0, "max": 360, "palette": ["313695","74add1","ffffbf","f46d43","a50026"]}, "freshness": "REFERENCE", "resolution_m": 30},
    "wcmc_carbon_density": {"dataset": "WCMC/biomass_carbon_density/v1_0/2010", "kind": "image", "band": "carbon_tonnes_per_ha", "vis": {"min": 1, "max": 180, "palette": ["d9f0a3","78c679","238443","005a32"]}, "freshness": "REFERENCE", "resolution_m": 300},
    "wdpa_protected": {"dataset": "WCMC/WDPA/current/polygons", "kind": "feature_collection", "band": None, "vis": {"min": 0, "max": 1, "palette": ["2ed033"]}, "freshness": "REFERENCE", "resolution_m": None},
}

class EarthEngineAdapter:
    name = "google_earth_engine"
    source_url = "https://developers.google.com/earth-engine/datasets/"
    api_repo_url = "https://github.com/google/earthengine-api"

    def _ee(self):
        if not settings.google_cloud_project:
            raise AdapterError(
                "Earth Engine is not configured. Set GOOGLE_CLOUD_PROJECT and provide Application Default Credentials."
            )
        try:
            import ee
        except Exception as e:
            raise AdapterError("earthengine-api package is unavailable") from e
        try:
            # Earth Engine's Python API requires an eligible Cloud project for initialization.
            ee.Initialize(project=settings.google_cloud_project)
        except Exception as e:
            raise AdapterError("Earth Engine is not authenticated. Configure GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_CLOUD_PROJECT.") from e
        return ee

    def catalog(self):
        return EE_LAYERS

    def health(self):
        """Validate the official Earth Engine Python API against the configured project.

        This makes a tiny server-side request. It never exposes credential material.
        """
        ee = self._ee()
        probe = ee.Number(1).getInfo()
        if probe != 1:
            raise AdapterError("Earth Engine authentication probe returned an unexpected result")
        return {
            "ok": True,
            "project": settings.google_cloud_project,
            "python_package": "earthengine-api",
            "official_repository": self.api_repo_url,
            "catalog_layers": len(EE_LAYERS),
        }

    def _apply_quality_mask(self, ee, image, cfg):
        qa_band = cfg.get("qa_band")
        if not qa_band:
            return image
        qa = image.select(qa_band)
        if cfg.get("qa_method") == "lte":
            mask = qa.lte(cfg.get("qa_max", 1))
        elif cfg.get("qa_method") == "bitwise_eq":
            mask = qa.bitwiseAnd(cfg.get("qa_mask", 3)).eq(cfg.get("qa_value", 0))
        else:
            return image
        return image.updateMask(mask)

    def sample(self, layer_id: str, lat: float, lon: float, days: int = 3650):
        cfg = EE_LAYERS.get(layer_id)
        if not cfg:
            raise AdapterError(f"Unknown Earth Engine layer: {layer_id}")
        ee = self._ee()
        pt = ee.Geometry.Point([lon, lat])
        if cfg["kind"] == "feature_collection":
            fc = ee.FeatureCollection(cfg["dataset"]).filterBounds(pt).filter(ee.Filter.eq("PARENT_ISO", "IND"))
            feats = fc.limit(10).getInfo().get("features", [])
            rows=[]
            for f in feats:
                props=f.get("properties") or {}
                rows.append({k:props.get(k) for k in ("WDPAID","WDPA_PID","NAME","ORIG_NAME","DESIG_ENG","IUCN_CAT","STATUS","REP_AREA","GIS_AREA") if k in props})
            return {"layer_id":layer_id,"inside_protected_area":bool(rows),"matches":rows,"dataset":cfg["dataset"],"freshness":cfg["freshness"],"source":"Google Earth Engine / UNEP-WCMC WDPA"}
        if cfg["kind"] == "image":
            image = ee.Image(cfg["dataset"]).select(cfg["band"])
        elif cfg["kind"] == "terrain":
            terrain = ee.Terrain.products(ee.Image(cfg["dataset"]))
            image = terrain.select(cfg["band"])
        else:
            col = ee.ImageCollection(cfg["dataset"]).filterBounds(pt)
            if cfg.get("qa_band"):
                col = col.map(lambda image: self._apply_quality_mask(ee, image, cfg))
            if cfg.get("static_latest"):
                image = ee.Image(col.sort("system:time_start", False).first()).select(cfg["band"])
            else:
                end = datetime.now(timezone.utc)
                start = end - timedelta(days=max(1, min(days, 3650)))
                col = col.filterDate(start.isoformat(), end.isoformat())
                if cfg.get("quality") == "gedi_l4a":
                    def quality_mask(im):
                        return im.updateMask(im.select("l4_quality_flag").eq(1)).updateMask(im.select("degrade_flag").eq(0))
                    col = col.map(quality_mask)
                image = col.select(cfg["band"]).mean()
        if cfg.get("scale_factor") is not None:
            image = image.multiply(cfg["scale_factor"]).add(cfg.get("offset", 0.0))
        scale = cfg["resolution_m"]
        val = image.reduceRegion(reducer=ee.Reducer.mean(), geometry=pt, scale=scale, bestEffort=True, maxPixels=1e7).get(cfg["band"]).getInfo()
        return {"layer_id":layer_id,"value":val,"unit":cfg.get("unit"),"band":cfg["band"],"dataset":cfg["dataset"],"resolution_m":scale,"freshness":cfg["freshness"],"quality_mask":cfg.get("quality_label"),"source":"Google Earth Engine Data Catalog"}

    def timeseries(self, layer_id: str, lat: float, lon: float, start_date: str, end_date: str):
        """Extract a quality-masked NASA MODIS point-buffer time series from Earth Engine."""
        cfg = EE_LAYERS.get(layer_id)
        if not cfg or cfg.get("kind") != "collection" or not cfg.get("qa_band"):
            raise AdapterError(f"Layer {layer_id!r} has no validated time-series extraction configuration")
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise AdapterError("Coordinates must be valid WGS84 latitude/longitude")
        ee = self._ee()
        try:
            region = ee.Geometry.Point([lon, lat]).buffer(cfg.get("buffer_m", 1500))
            collection = (
                ee.ImageCollection(cfg["dataset"])
                .filterBounds(region)
                .filterDate(start_date, end_date)
                .map(lambda image: self._apply_quality_mask(ee, image, cfg))
            )

            def to_feature(image):
                scaled = image.select(cfg["band"]).multiply(cfg.get("scale_factor", 1.0)).add(cfg.get("offset", 0.0))
                reduced = scaled.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=region,
                    scale=cfg["resolution_m"],
                    bestEffort=True,
                    maxPixels=1e7,
                )
                return ee.Feature(None, {
                    "date": image.date().format("YYYY-MM-dd"),
                    "value": reduced.get(cfg["band"]),
                })

            features = ee.FeatureCollection(collection.map(to_feature)).filter(ee.Filter.notNull(["value"]))
            raw = features.getInfo().get("features", [])
            observations = []
            for feature in raw:
                props = feature.get("properties") or {}
                value = props.get("value")
                date_value = props.get("date")
                if date_value and value is not None:
                    try:
                        numeric = float(value)
                    except (TypeError, ValueError):
                        continue
                    if numeric == numeric and abs(numeric) != float("inf"):
                        observations.append({"date": str(date_value)[:10], "value": numeric})
            observations.sort(key=lambda row: row["date"])
            return {
                "layer_id": layer_id,
                "dataset": cfg["dataset"],
                "band": cfg["band"],
                "unit": cfg.get("unit"),
                "resolution_m": cfg["resolution_m"],
                "quality_mask": cfg.get("quality_label"),
                "source": "Google Earth Engine / NASA Terra MODIS",
                "observations": observations,
                "sample_count": len(observations),
                "period": {"start": start_date, "end": end_date},
            }
        except AdapterError:
            raise
        except Exception as exc:
            raise AdapterError(f"NASA MODIS time-series extraction failed: {exc}") from exc

    def tile(self, layer_id: str, lat: float | None = None, lon: float | None = None, days: int = 30):
        cfg = EE_LAYERS.get(layer_id)
        if not cfg:
            raise AdapterError(f"Unknown Earth Engine layer: {layer_id}")
        ee = self._ee()
        if cfg["kind"] == "feature_collection":
            fc = ee.FeatureCollection(cfg["dataset"]).filter(ee.Filter.eq("PARENT_ISO", "IND"))
            image = ee.Image().byte().paint(fc, 1).selfMask()
        elif cfg["kind"] == "image":
            image = ee.Image(cfg["dataset"]).select(cfg["band"])
        elif cfg["kind"] == "terrain":
            image = ee.Terrain.products(ee.Image(cfg["dataset"])).select(cfg["band"])
        else:
            col = ee.ImageCollection(cfg["dataset"])
            if lat is not None and lon is not None:
                col = col.filterBounds(ee.Geometry.Point([lon, lat]))
            if cfg.get("qa_band"):
                col = col.map(lambda image: self._apply_quality_mask(ee, image, cfg))
            if cfg.get("static_latest"):
                image = ee.Image(col.sort("system:time_start", False).first()).select(cfg["band"])
            else:
                end = datetime.now(timezone.utc)
                start = end - timedelta(days=max(1, min(days, 3650)))
                col = col.filterDate(start.isoformat(), end.isoformat())
                if cfg.get("quality") == "gedi_l4a":
                    def quality_mask(im):
                        return im.updateMask(im.select("l4_quality_flag").eq(1)).updateMask(im.select("degrade_flag").eq(0))
                    col = col.map(quality_mask)
                image = col.select(cfg["band"]).mean()
        info = image.getMapId(cfg["vis"])
        return {
            "layer_id": layer_id,
            "dataset": cfg["dataset"],
            "band": cfg["band"],
            "tile_url": info["tile_fetcher"].url_format,
            "freshness": cfg["freshness"],
            "resolution_m": cfg["resolution_m"],
            "source": "Google Earth Engine Data Catalog",
        }
