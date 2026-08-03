from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "generic_data_entry_test_server", PROJECT_DIR / "SchemaCraft.py"
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load SchemaCraft.py")
APP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(APP)

if len(sys.argv) not in {2, 3}:
    raise SystemExit("Usage: test_server.py DATA_DIR [--builder]")

APP.DATA_DIR = Path(sys.argv[1]).resolve()
APP.SCHEMA_PATH = APP.DATA_DIR / "schema.json"
APP.WORKBOOK_PATH = APP.DATA_DIR / "database.xlsx"
APP.DEVELOPER_MODE = len(sys.argv) == 3 and sys.argv[2] == "--builder"
APP.ensure_storage()

server = APP.DataEntryHTTPServer((APP.HOST, 0), APP.DataEntryRequestHandler)
print(f"PORT={server.server_address[1]}", flush=True)

try:
    server.serve_forever(poll_interval=0.1)
finally:
    server.server_close()
