#!/usr/bin/env python3
"""Dragon Flyby installer.

Runs once each time the add-on starts:

1. Copies the dragon script into Home Assistant's ``www`` folder, which the
   frontend serves at ``/local/``.
2. Registers (or updates) a dashboard resource pointing at it, with the
   add-on options passed in the query string.

With ``enabled: false`` it does the reverse and removes both again.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import time
from urllib.parse import urlencode

from websockets.sync.client import connect

OPTIONS_FILE = os.environ.get("DRAGON_OPTIONS", "/data/options.json")
SOURCE_JS = os.environ.get("DRAGON_SOURCE", "/usr/share/dragon-flyby/dragon-flyby.js")
HA_CONFIG = os.environ.get("DRAGON_HA_CONFIG", "/homeassistant")
WS_URL = os.environ.get("DRAGON_WS_URL", "ws://supervisor/core/websocket")
TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")
CONNECT_TIMEOUT = float(os.environ.get("DRAGON_CONNECT_TIMEOUT", "120"))

FOLDER = "dragon-flyby"
FILENAME = "dragon-flyby.js"
URL_PATH = f"/local/{FOLDER}/{FILENAME}"
MAX_DURATION = 10

DEFAULTS = {
    "enabled": True,
    "interval_minutes": 15,
    "duration_seconds": 5,
    "dragon": "random",
    "size": "medium",
    "dashboards_only": True,
    "fly_on_load": False,
}


class CommandError(Exception):
    """Home Assistant answered a websocket command with an error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


def log(message: str) -> None:
    print(f"[dragon-flyby] {message}", flush=True)


def load_options() -> dict:
    options = dict(DEFAULTS)
    try:
        with open(OPTIONS_FILE, encoding="utf-8") as handle:
            options.update(json.load(handle))
    except FileNotFoundError:
        log(f"No options file at {OPTIONS_FILE}, using defaults.")
    options["interval_minutes"] = max(1, int(options["interval_minutes"]))
    options["duration_seconds"] = min(MAX_DURATION, max(1, float(options["duration_seconds"])))
    return options


def resource_url(options: dict, digest: str) -> str:
    duration = options["duration_seconds"]
    query = {
        "interval": options["interval_minutes"],
        "duration": int(duration) if float(duration).is_integer() else duration,
        "dragon": options["dragon"],
        "size": options["size"],
        "dashboards": int(bool(options["dashboards_only"])),
        "onload": int(bool(options["fly_on_load"])),
        "v": digest,
    }
    return f"{URL_PATH}?{urlencode(query)}"


def install_file() -> tuple[str, bool]:
    """Copy the script into www. Returns (content hash, www folder was new)."""
    www = os.path.join(HA_CONFIG, "www")
    www_is_new = not os.path.isdir(www)
    target_dir = os.path.join(www, FOLDER)
    os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, FILENAME)
    shutil.copyfile(SOURCE_JS, target)
    with open(target, "rb") as handle:
        digest = hashlib.sha256(handle.read()).hexdigest()[:10]
    log(f"Copied dragon script to {target}")
    return digest, www_is_new


def remove_file() -> None:
    target_dir = os.path.join(HA_CONFIG, "www", FOLDER)
    if os.path.isdir(target_dir):
        shutil.rmtree(target_dir)
        log(f"Removed {target_dir}")


class HomeAssistant:
    """Minimal client for the Home Assistant websocket API."""

    def __init__(self, url: str, token: str, timeout: float) -> None:
        self._id = 0
        self._ws = self._connect(url, token, timeout)

    @staticmethod
    def _connect(url: str, token: str, timeout: float):
        deadline = time.monotonic() + timeout
        delay = 2.0
        while True:
            try:
                ws = connect(url, open_timeout=10, max_size=None)
                hello = json.loads(ws.recv(timeout=10))
                if hello.get("type") != "auth_required":
                    raise ConnectionError(f"unexpected greeting {hello}")
                ws.send(json.dumps({"type": "auth", "access_token": token}))
                reply = json.loads(ws.recv(timeout=10))
                if reply.get("type") != "auth_ok":
                    ws.close()
                    raise PermissionError(reply.get("message", "authentication failed"))
                return ws
            except PermissionError:
                raise
            except Exception as err:  # noqa: BLE001 - keep retrying until HA is up
                if time.monotonic() + delay > deadline:
                    raise ConnectionError(f"could not reach Home Assistant at {url}: {err}") from err
                log(f"Waiting for Home Assistant ({err})...")
                time.sleep(delay)
                delay = min(delay * 1.5, 15)

    def call(self, command: str, **data):
        self._id += 1
        msg_id = self._id
        self._ws.send(json.dumps({"id": msg_id, "type": command, **data}))
        while True:
            reply = json.loads(self._ws.recv(timeout=30))
            if reply.get("id") != msg_id or reply.get("type") != "result":
                continue
            if reply.get("success"):
                return reply.get("result")
            error = reply.get("error") or {}
            raise CommandError(error.get("code", "unknown"), error.get("message", ""))

    def close(self) -> None:
        self._ws.close()


def ours(resources: list[dict]) -> list[dict]:
    return [r for r in resources if str(r.get("url", "")).split("?")[0] == URL_PATH]


def sync_resource(ha: HomeAssistant, url: str) -> str:
    existing = ours(ha.call("lovelace/resources") or [])
    for extra in existing[1:]:
        ha.call("lovelace/resources/delete", resource_id=extra["id"])
    if not existing:
        ha.call("lovelace/resources/create", res_type="module", url=url)
        return "created"
    first = existing[0]
    if first.get("url") == url and first.get("type") == "module":
        return "unchanged"
    ha.call("lovelace/resources/update", resource_id=first["id"], res_type="module", url=url)
    return "updated"


def remove_resources(ha: HomeAssistant) -> int:
    existing = ours(ha.call("lovelace/resources") or [])
    for resource in existing:
        ha.call("lovelace/resources/delete", resource_id=resource["id"])
    return len(existing)


def manual_instructions(url: str) -> None:
    log("Could not register the dashboard resource automatically.")
    log("This happens when dashboard resources are managed in YAML.")
    log("Add this to the 'resources' list in your configuration and restart:")
    log(f"  - url: {url}")
    log("    type: module")


def main() -> int:
    options = load_options()
    enabled = bool(options["enabled"])

    url = None
    www_is_new = False
    if enabled:
        digest, www_is_new = install_file()
        url = resource_url(options, digest)

    try:
        ha = HomeAssistant(WS_URL, TOKEN, CONNECT_TIMEOUT)
    except (ConnectionError, PermissionError) as err:
        log(f"Error: {err}")
        if url:
            manual_instructions(url)
        return 1

    try:
        if enabled:
            action = sync_resource(ha, url)
            log(f"Dashboard resource {action}: {url}")
            log(
                f"A dragon will fly every {options['interval_minutes']} min "
                f"for {options['duration_seconds']} s. Refresh open dashboards to apply changes."
            )
            if www_is_new:
                log(
                    "The 'www' folder was just created. Restart Home Assistant once "
                    "so it starts serving /local/ files, then refresh your dashboard."
                )
        else:
            removed = remove_resources(ha)
            remove_file()
            log(f"Dragon Flyby disabled, removed {removed} dashboard resource(s).")
    except CommandError as err:
        log(f"Home Assistant refused the request ({err}).")
        if url:
            manual_instructions(url)
        else:
            log(f"Remove the resource {URL_PATH} from your dashboard resources by hand.")
    finally:
        ha.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
