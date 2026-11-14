# Build Verification

This marker was added after the complete VanRakshak AI v2 source tree was applied to `main`.

Local pre-push verification completed:
- Python compilation: passed
- Backend test suite: 19 passed
- Frontend JavaScript syntax check: passed
- FastAPI local health endpoint: passed

External provider availability remains dependent on provider network access and configured credentials. The CI workflow validates the repository build/test path without fabricating external data.


## EarthScope integration verification (2026-11-15)

- Trend Detective is integrated as a first-class Mission Control view, using web/dashboard/research.html.
- Ten EarthScope / climate routes were added to the active FastAPI runtime for trend analysis, variable catalogue, comparison, CMR, geocoding, coverage, seven-day forecast and state coordinate references.
- The current backend source contains 95 route decorators in total (93 API routes plus root and favicon), not 131.
- New tests cover observation-backed Sentinel-2 trend analysis, insufficient sample behavior, the connected variable catalogue, coordinate-reference semantics and seven-day forecast schema.
- The last completed CI run before the newest test and acceptance-gate edits reported 89 backend tests passed. The latest branch CI run is still queued and must complete before marking the branch fully verified.
- The configured Render backend origin returned HTTP 503 during the current check. Hosted API functionality requires service recovery.
- Vercel's deployment API returned HTTP 402 for its daily deployment quota when asked to preview the current commit. The newest commits have not been promoted to the production alias.
