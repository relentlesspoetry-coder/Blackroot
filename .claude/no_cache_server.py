#!/usr/bin/env python3
# Dev-only static server for in-browser phase verification.
# Sends no-store headers so edited JS/HTML is never served from browser cache
# (same-path files across versions would otherwise be cached stale).
import http.server, socketserver, sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', port), NoCacheHandler) as httpd:
        httpd.serve_forever()
