#!/usr/bin/env python3
"""Local dev server for web/ with caching disabled.

The browser app is edited and its constants regenerated constantly; a stock
`python -m http.server` lets browsers cache stale modules, which silently shows old
code. This serves web/ with Cache-Control: no-store instead.

    python engine/serve.py            # http://localhost:8793
    python engine/serve.py 9000
"""
import functools, http.server, sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web"

class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript",
                      ".woff2": "font/woff2"}
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a):
        pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8793
    handler = functools.partial(NoCache, directory=str(WEB))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as srv:
        print(f"serving {WEB} on http://localhost:{port}")
        srv.serve_forever()
