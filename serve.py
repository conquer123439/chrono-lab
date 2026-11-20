"""Local static server for Chrono Lab.

Serves the game folder on 127.0.0.1:5173 with caching disabled so that
edited files always show up after a normal refresh. Also prints a clear
message when the port is already taken by a stale server.
"""

import os
import sys
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = int(os.environ.get("CHRONO_PORT", "5173"))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        # Ignore conditional requests so edited files are never answered with 304.
        if self.headers.get("If-Modified-Since"):
            del self.headers["If-Modified-Since"]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the window readable
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    root = os.path.dirname(os.path.abspath(__file__))
    handler = partial(NoCacheHandler, directory=root)
    try:
        server = ThreadingHTTPServer((HOST, PORT), handler)
    except OSError:
        print("")
        print("!! Port %d is already in use." % PORT)
        print("!! Another copy of the game server is probably still running.")
        print("!! Close the old command window (or end the python process), then run this again.")
        print("")
        input("Press Enter to exit...")
        return 1

    url = "http://%s:%d/" % (HOST, PORT)
    print("Chrono Lab serving: %s" % root)
    print("Open: %s" % url)
    print("Keep this window open while playing. Press Ctrl+C to stop.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
