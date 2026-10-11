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
FRONTEND_DIRECTORY = os.path.join(DIRECTORY, "dist")
SCHEDULE_FILE = os.path.join(DIRECTORY, "schedule.json")
COMMENTS_FILE = os.path.join(DIRECTORY, "comments.json")

class TVApiHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIRECTORY, **kwargs)

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
        clean_path = self.path.split('?')[0]
        # 1. API: Get live schedule
        if clean_path == '/api/schedule':
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
        elif clean_path == '/api/time':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            data = {"timestamp": int(time.time()), "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            self.wfile.write(json.dumps(data).encode('utf-8'))
            return

        # 3. API: Real Danmaku comments
        elif clean_path == '/api/comments':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            if os.path.exists(COMMENTS_FILE):
                try:
                    with open(COMMENTS_FILE, 'r', encoding='utf-8') as f:
                        self.wfile.write(f.read().encode('utf-8'))
                    return
                except Exception:
                    pass
            self.wfile.write(b"[]")
            return

        # 4. Default: Serve static files (HTML, CSS, JS)
        super().do_GET()

    def do_POST(self):
        clean_path = self.path.split('?')[0]
        # API: Update schedule from admin/studio
        if clean_path == '/api/schedule':
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

        elif clean_path == '/api/comments':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                comment = json.loads(body)
                comments = []
                if os.path.exists(COMMENTS_FILE):
                    try:
                        with open(COMMENTS_FILE, 'r', encoding='utf-8') as f:
                            comments = json.load(f)
                    except Exception:
                        comments = []
                comments.append(comment)
                if len(comments) > 200:
                    comments = comments[-200:]
                with open(COMMENTS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(comments, f, ensure_ascii=False, indent=2)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def run():
    if not os.path.isfile(os.path.join(FRONTEND_DIRECTORY, 'index.html')):
        print('Сначала соберите интерфейс: npm run build')
        return
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
