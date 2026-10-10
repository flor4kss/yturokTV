import http.server
import socketserver
import os
import sys
import json
import time
import webbrowser

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
SCHEDULE_FILE = os.path.join(DIRECTORY, "schedule.json")

class TVApiHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Disable cache & enable CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # 1. API: Get live schedule
        if self.path == '/api/schedule':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            try:
                with open(SCHEDULE_FILE, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        # 2. API: Server time synchronization (prevents local client clock drift)
        elif self.path == '/api/time':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            data = {"timestamp": int(time.time()), "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            self.wfile.write(json.dumps(data).encode('utf-8'))
            return

        # 3. Default: Serve static files (HTML, CSS, JS)
        super().do_GET()

    def do_POST(self):
        # API: Update schedule from admin/studio
        if self.path == '/api/schedule':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                parsed = json.loads(body)
                with open(SCHEDULE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(parsed, f, ensure_ascii=False, indent=2)
                
                # Also sync channels.js
                with open(os.path.join(DIRECTORY, "channels.js"), 'w', encoding='utf-8') as f:
                    f.write("// Автоматически синхронизированная сетка\nexport const DEFAULT_CHANNELS = " + json.dumps(parsed, ensure_ascii=False, indent=2) + ";\n")

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": "Сетка успешно обновлена"}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def run():
    os.chdir(DIRECTORY)
    TVApiHandler.extensions_map.update({
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.html': 'text/html; charset=utf-8'
    })

    for port in range(PORT, PORT + 20):
        try:
            with socketserver.TCPServer(("", port), TVApiHandler) as httpd:
                url = f"http://localhost:{port}"
                print("=" * 60)
                print(f"📺 yturokTV Backend & Frontend запущены!")
                print(f"👉 Открой в браузере: {url}")
                print(f"📡 API эндпоинты: {url}/api/schedule | {url}/api/time")
                print("=" * 60)
                webbrowser.open(url)
                httpd.serve_forever()
                break
        except OSError:
            continue

if __name__ == '__main__':
    run()
