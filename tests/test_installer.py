"""Tests for the add-on installer against a fake Home Assistant websocket API.

Run with:  pip install websockets && python3 -m unittest discover tests
"""

from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from websockets.sync.server import serve

ROOT = Path(__file__).resolve().parents[1]
ADDON = ROOT / "dragon_flyby"

spec = importlib.util.spec_from_file_location("install", ADDON / "installer" / "install.py")
install = importlib.util.module_from_spec(spec)
spec.loader.exec_module(install)

TOKEN = "test-token"


class FakeHomeAssistant:
    """Speaks just enough of the websocket API for dashboard resources."""

    def __init__(self, yaml_mode: bool = False) -> None:
        self.yaml_mode = yaml_mode
        self.resources: list[dict] = []
        self._next_id = 1
        self.server = serve(self._handler, "127.0.0.1", 0)
        self.port = self.server.socket.getsockname()[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    @property
    def url(self) -> str:
        return f"ws://127.0.0.1:{self.port}"

    def add(self, url: str, res_type: str = "module") -> None:
        self.resources.append({"id": str(self._next_id), "type": res_type, "url": url})
        self._next_id += 1

    def stop(self) -> None:
        self.server.shutdown()
        self.thread.join(timeout=5)

    def _handler(self, ws) -> None:
        ws.send(json.dumps({"type": "auth_required"}))
        auth = json.loads(ws.recv())
        if auth.get("access_token") != TOKEN:
            ws.send(json.dumps({"type": "auth_invalid", "message": "bad token"}))
            return
        ws.send(json.dumps({"type": "auth_ok"}))
        for raw in ws:
            msg = json.loads(raw)
            # Unrelated traffic must be ignored by the client.
            ws.send(json.dumps({"id": 999, "type": "event", "event": {}}))
            ws.send(json.dumps(self._answer(msg)))

    def _answer(self, msg: dict) -> dict:
        ok = lambda result=None: {"id": msg["id"], "type": "result", "success": True, "result": result}  # noqa: E731
        kind = msg["type"]
        if kind == "lovelace/resources":
            return ok([dict(r) for r in self.resources])
        if self.yaml_mode:
            return {"id": msg["id"], "type": "result", "success": False,
                    "error": {"code": "unknown_command", "message": "Unknown command."}}
        if kind == "lovelace/resources/create":
            self.add(msg["url"], msg["res_type"])
            return ok(self.resources[-1])
        if kind == "lovelace/resources/update":
            for r in self.resources:
                if r["id"] == msg["resource_id"]:
                    r.update(url=msg["url"], type=msg["res_type"])
                    return ok(r)
        if kind == "lovelace/resources/delete":
            self.resources = [r for r in self.resources if r["id"] != msg["resource_id"]]
            return ok()
        return {"id": msg["id"], "type": "result", "success": False,
                "error": {"code": "not_found", "message": kind}}


class InstallerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.config = Path(self.tmp.name) / "homeassistant"
        self.config.mkdir()
        self.options = Path(self.tmp.name) / "options.json"
        self.ha = FakeHomeAssistant()
        self._patch(self.ha.url)

    def tearDown(self) -> None:
        self.ha.stop()
        self.tmp.cleanup()

    def _patch(self, ws_url: str) -> None:
        install.HA_CONFIG = str(self.config)
        install.OPTIONS_FILE = str(self.options)
        install.SOURCE_JS = str(ADDON / "www" / "dragon-flyby.js")
        install.WS_URL = ws_url
        install.TOKEN = TOKEN
        install.CONNECT_TIMEOUT = 3

    def run_with(self, **options) -> int:
        self.options.write_text(json.dumps({**install.DEFAULTS, **options}))
        return install.main()

    @property
    def installed_js(self) -> Path:
        return self.config / "www" / "dragon-flyby" / "dragon-flyby.js"

    def test_first_run_copies_script_and_creates_resource(self) -> None:
        self.assertEqual(self.run_with(), 0)
        self.assertTrue(self.installed_js.is_file())
        self.assertEqual(len(self.ha.resources), 1)
        res = self.ha.resources[0]
        self.assertEqual(res["type"], "module")
        self.assertTrue(res["url"].startswith("/local/dragon-flyby/dragon-flyby.js?"))
        self.assertIn("interval=15", res["url"])
        self.assertIn("duration=5", res["url"])
        self.assertIn("theme=dragons", res["url"])
        self.assertIn("dragon=random", res["url"])

    def test_changed_options_update_the_same_resource(self) -> None:
        self.run_with()
        first_id = self.ha.resources[0]["id"]
        self.run_with(interval_minutes=30, theme="christmas", dragon="ember", size="large")
        self.assertEqual(len(self.ha.resources), 1)
        res = self.ha.resources[0]
        self.assertEqual(res["id"], first_id)
        self.assertIn("interval=30", res["url"])
        self.assertIn("theme=christmas", res["url"])
        self.assertIn("dragon=ember", res["url"])
        self.assertIn("size=large", res["url"])

    def test_australian_christmas_theme_is_passed_through(self) -> None:
        self.run_with(theme="australianchristmas")
        self.assertIn("theme=australianchristmas", self.ha.resources[0]["url"])
        self.run_with(theme="minecraft")
        self.assertIn("theme=minecraft", self.ha.resources[0]["url"])

    def test_duration_up_to_ten_seconds_is_kept(self) -> None:
        self.run_with(duration_seconds=8)
        self.assertIn("duration=8&", self.ha.resources[0]["url"])

    def test_duration_is_capped_at_ten_seconds(self) -> None:
        self.run_with(duration_seconds=12)
        self.assertIn("duration=10&", self.ha.resources[0]["url"])

    def test_other_resources_are_left_alone_and_duplicates_removed(self) -> None:
        self.ha.add("/hacsfiles/button-card/button-card.js")
        self.ha.add("/local/dragon-flyby/dragon-flyby.js?v=old")
        self.ha.add("/local/dragon-flyby/dragon-flyby.js?v=older")
        self.run_with()
        urls = [r["url"] for r in self.ha.resources]
        self.assertIn("/hacsfiles/button-card/button-card.js", urls)
        self.assertEqual(sum(u.startswith("/local/dragon-flyby/") for u in urls), 1)

    def test_disabling_removes_resource_and_file(self) -> None:
        self.ha.add("/hacsfiles/button-card/button-card.js")
        self.run_with()
        self.run_with(enabled=False)
        self.assertFalse(self.installed_js.exists())
        self.assertEqual([r["url"] for r in self.ha.resources], ["/hacsfiles/button-card/button-card.js"])

    def test_yaml_dashboards_get_manual_instructions(self) -> None:
        self.ha.stop()
        self.ha = FakeHomeAssistant(yaml_mode=True)
        self._patch(self.ha.url)
        self.assertEqual(self.run_with(), 0)
        self.assertTrue(self.installed_js.is_file())
        self.assertEqual(self.ha.resources, [])

    def test_bad_token_fails_cleanly(self) -> None:
        install.TOKEN = "wrong"
        self.assertEqual(self.run_with(), 1)

    def test_unreachable_home_assistant_fails_cleanly(self) -> None:
        self._patch("ws://127.0.0.1:1")
        install.CONNECT_TIMEOUT = 0.5
        self.assertEqual(self.run_with(), 1)

    def test_unicorn_chance_is_passed_and_capped(self) -> None:
        self.run_with()
        self.assertIn("unicorn=5&", self.ha.resources[0]["url"])
        self.run_with(unicorn_chance=0)
        self.assertIn("unicorn=0&", self.ha.resources[0]["url"])
        self.run_with(unicorn_chance=60)
        self.assertIn("unicorn=25&", self.ha.resources[0]["url"])

    def test_optional_dragon_defaults_to_random(self) -> None:
        options = {k: v for k, v in install.DEFAULTS.items() if k != "dragon"}
        self.options.write_text(json.dumps(options))
        self.assertEqual(install.main(), 0)
        self.assertIn("dragon=random", self.ha.resources[0]["url"])
        self.run_with(dragon="ember", size="extralarge")
        self.assertIn("dragon=ember", self.ha.resources[0]["url"])
        self.assertIn("size=extralarge", self.ha.resources[0]["url"])

    def test_weather_holidays_and_birthdays_are_passed(self) -> None:
        self.run_with(
            theme="weather",
            weather_entity=" weather.melbourne ",
            auto_holidays=["birthdays", "diwali", "nonsense"],
            birthdays=[
                {"name": "Mia", "day": 12, "month": 3, "year": 2019},
                {"name": "Sam", "day": 4, "month": 11},
                {"name": "", "day": 1, "month": 1},
                {"name": "Bad date", "day": 40, "month": 1},
            ],
        )
        query = parse_qs(urlsplit(self.ha.resources[0]["url"]).query)
        self.assertEqual(query["theme"], ["weather"])
        self.assertEqual(query["weather"], ["weather.melbourne"])
        self.assertEqual(query["holidays"], ["birthdays,diwali"])
        self.assertEqual(json.loads(query["birthdays"][0]), [
            {"name": "Mia", "day": 12, "month": 3, "year": 2019},
            {"name": "Sam", "day": 4, "month": 11},
        ])

    def test_defaults_use_auto_weather_all_holidays_and_no_birthdays(self) -> None:
        self.run_with()
        query = parse_qs(urlsplit(self.ha.resources[0]["url"]).query, keep_blank_values=True)
        self.assertEqual(query["weather"], ["auto"])
        self.assertEqual(query["holidays"], [",".join(install.HOLIDAYS)])
        self.assertNotIn("birthdays", query)
        self.run_with(auto_holidays=[], weather_entity="")
        query = parse_qs(urlsplit(self.ha.resources[0]["url"]).query, keep_blank_values=True)
        self.assertEqual(query["holidays"], [""])
        self.assertEqual(query["weather"], ["auto"])

    def test_addon_schema_matches_installer_defaults(self) -> None:
        text = (ADDON / "config.yaml").read_text()
        self.assertIn("  dragon: list(random|shadow|spike|ember|moon)?\n", text)
        self.assertIn("  birthdays: []\n", text)
        for holiday in install.HOLIDAYS:
            self.assertIn(f"    - {holiday}\n", text)
        for key, value in install.DEFAULTS.items():
            if key == "dragon" or isinstance(value, list):  # optional, or checked above
                continue
            expected = str(value).lower() if isinstance(value, bool) else str(value)
            self.assertIn(f"  {key}: {expected}\n", text)


if __name__ == "__main__":
    unittest.main()
