"""Capture real screenshots of the Chrono Lab game through the Chrome DevTools Protocol.

The Edge/Chrome `--screenshot` flag can only grab one frame right after load, which
is useless for a menu that needs a click or for a demo that needs to play. This
script drives a headless browser instead: it navigates, clicks real buttons on the
page, waits, and captures composited frames.

No third-party packages are needed: the DevTools websocket client is implemented
here with the standard library.

Usage:
    python tools/cdp_shot.py --url http://127.0.0.1:5174/ --out screenshots
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import secrets
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request

DEFAULT_BROWSERS = (
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
)


# --------------------------------------------------------------------------- #
# Minimal websocket client
# --------------------------------------------------------------------------- #

class WebSocket:
    def __init__(self, url: str, timeout: float = 25.0):
        if not url.startswith("ws://"):
            raise ValueError(f"unsupported url: {url}")
        hostport, _, path = url[5:].partition("/")
        host, _, port = hostport.partition(":")
        self.sock = socket.create_connection((host, int(port)), timeout=timeout)
        key = base64.b64encode(secrets.token_bytes(16)).decode()
        request = (
            f"GET /{path} HTTP/1.1\r\n"
            f"Host: {hostport}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(request.encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise EOFError("websocket handshake closed early")
            head += chunk
        status = head.split(b"\r\n", 1)[0]
        if b"101" not in status:
            raise RuntimeError(f"websocket handshake failed: {status!r}")

    def _recv_exact(self, n: int) -> bytes:
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise EOFError("websocket closed")
            buf += chunk
        return buf

    def send(self, text: str) -> None:
        payload = text.encode("utf-8")
        header = bytearray([0x81])  # FIN + text frame
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", length)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", length)
        mask = secrets.token_bytes(4)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + masked)

    def recv(self) -> str:
        while True:
            first, second = self._recv_exact(2)
            opcode = first & 0x0F
            length = second & 0x7F
            if length == 126:
                length = struct.unpack(">H", self._recv_exact(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self._recv_exact(8))[0]
            mask = self._recv_exact(4) if second & 0x80 else None
            data = self._recv_exact(length) if length else b""
            if mask:
                data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
            if opcode == 0x1:
                return data.decode("utf-8")
            if opcode == 0x8:
                raise EOFError("websocket closed by peer")
            # ping/pong/binary frames are ignored

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


# --------------------------------------------------------------------------- #
# DevTools client
# --------------------------------------------------------------------------- #

class DevTools:
    def __init__(self, ws_url: str):
        self.ws = WebSocket(ws_url)
        self.next_id = 0

    def call(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        message = {"id": self.next_id, "method": method}
        if params:
            message["params"] = params
        self.ws.send(json.dumps(message))
        while True:
            reply = json.loads(self.ws.recv())
            if reply.get("id") != self.next_id:
                continue  # an event, not our reply
            if "error" in reply:
                raise RuntimeError(f"{method}: {reply['error']}")
            return reply.get("result", {})

    def evaluate(self, expression: str):
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "awaitPromise": True, "returnByValue": True},
        )
        return result.get("result", {}).get("value")

    def screenshot(self, path: str) -> None:
        data = self.call("Page.captureScreenshot", {"format": "png"})["data"]
        with open(path, "wb") as handle:
            handle.write(base64.b64decode(data))


# --------------------------------------------------------------------------- #
# Driver
# --------------------------------------------------------------------------- #

def find_browser(explicit: str | None) -> str:
    if explicit:
        return explicit
    for candidate in DEFAULT_BROWSERS:
        if os.path.exists(candidate):
            return candidate
    raise SystemExit("No Edge/Chrome found; pass --browser")


def wait_for_port(port: int, timeout: float = 25.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=2) as resp:
                json.load(resp)
                return page_ws(port)
        except Exception:
            time.sleep(0.4)
    raise SystemExit(f"DevTools did not start on port {port}")


def page_ws(port: int) -> str:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5) as resp:
        targets = json.load(resp)
    for target in targets:
        if target.get("type") == "page" and target.get("webSocketDebuggerUrl"):
            return target["webSocketDebuggerUrl"]
    raise SystemExit("no page target found")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--browser")
    parser.add_argument("--port", type=int, default=9222)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    browser = find_browser(args.browser)
    profile = tempfile.mkdtemp(prefix="cdp-profile-")

    process = subprocess.Popen(
        [
            browser,
            "--headless=new",
            "--no-sandbox",
            "--mute-audio",
            "--autoplay-policy=no-user-gesture-required",
            f"--remote-debugging-port={args.port}",
            f"--user-data-dir={profile}",
            f"--window-size={args.width},{args.height}",
            "--hide-scrollbars",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    shots: list[tuple[str, str]] = []
    try:
        client = DevTools(wait_for_port(args.port))
        client.call("Page.enable")
        client.call(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": args.width,
                "height": args.height,
                "deviceScaleFactor": 1,
                "mobile": False,
            },
        )
        client.call("Page.navigate", {"url": args.url})
        time.sleep(3.5)

        def grab(name: str) -> None:
            path = os.path.join(args.out, f"{name}.png")
            client.screenshot(path)
            shots.append((name, path))
            print(f"captured {name} -> {path}")

        # 1. Title screen with the three buttons.
        grab("01-title-screen")

        # 2. Start the automated demo and follow it.
        client.evaluate("document.querySelector('#demo').click()")
        time.sleep(6)
        grab("02-demo-walking")
        time.sleep(5)
        grab("03-demo-echo-spawned")
        time.sleep(8)
        grab("04-demo-crossing-gate")
        time.sleep(9)
        grab("05-demo-core")

        # 3. Wait for the demo to hand control back, then show normal play.
        time.sleep(6)
        client.evaluate("document.querySelector('#start').click()")
        time.sleep(4)
        grab("06-normal-play-hud")

        # Report the on-screen state so the images can be trusted.
        state = client.evaluate(
            "(() => { const c = window.chronoLab;"
            " const p = c.player.position;"
            " return JSON.stringify({x:+p.x.toFixed(2), z:+p.z.toFixed(2),"
            " clone:c.hasClone, rec:+c.recordingTime.toFixed(1),"
            " menuHidden:document.querySelector('#menu').hidden,"
            " hud:document.querySelector('#loop-status').textContent,"
            " objective:document.querySelector('#level-status').textContent}); })()"
        )
        print("STATE " + str(state))
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()

    print(f"done: {len(shots)} screenshots in {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
