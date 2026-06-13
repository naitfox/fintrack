import http.server
import json
import os
import base64
import yfinance as yf
from urllib.parse import urlparse, parse_qs
from socketserver import ThreadingMixIn

PORT = 8000

import requests

def get_mf_nav(name):
    try:
        # Search for fund
        resp = requests.get(f"https://api.mfapi.in/mf/search?q={name}", timeout=5)
        results = resp.json()
        if results:
            code = results[0]['schemeCode']
            # Get latest NAV
            nav_resp = requests.get(f"https://api.mfapi.in/mf/{code}", timeout=5)
            nav_data = nav_resp.json()
            if nav_data and 'data' in nav_data:
                return float(nav_data['data'][0]['nav'])
    except Exception as e:
        print(f"MF Fetch Error for {name}: {e}")
    return None

def search_stock(query):
    try:
        # Search Yahoo Finance for the ticker
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=1"
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
        data = resp.json()
        if data.get('quotes'):
            return data['quotes'][0]['symbol']
    except Exception as e:
        print(f"Stock Search Error for {query}: {e}")
    return None

class DataHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            with open('data.json', 'w') as f:
                f.write(post_data.decode('utf-8'))
                
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode())
        elif self.path == '/upload-pdf':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))
            
            pdf_bytes = base64.b64decode(payload['pdf_base64'])
            password = payload.get('password', '')
            stmt_type = payload.get('type', 'bank')
            
            import tempfile, os
            import sbi_parser
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                tmp.write(pdf_bytes)
                tmp_path = tmp.name
                
            try:
                if stmt_type == 'cc':
                    transactions = sbi_parser.parse_sbi_credit_card(tmp_path, password)
                else:
                    transactions = sbi_parser.parse_sbi_bank(tmp_path, password)
                    
                os.remove(tmp_path)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "data": transactions}).encode())
            except Exception as e:
                os.remove(tmp_path)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
        else:
            super().do_POST()

    def do_GET(self):
        if self.path.startswith('/prices'):
            query = parse_qs(urlparse(self.path).query)
            tickers_raw = query.get('tickers', [])
            tickers = tickers_raw[0].split(',') if tickers_raw else []
            
            results = {}
            for t in tickers:
                if not t: continue
                symbol = t.upper().strip()
                
                price = None
                # 1. Try direct Ticker (with .NS fallback)
                try:
                    yf_symbol = symbol if ('.' in symbol or ' ' in symbol) else symbol + ".NS"
                    ticker = yf.Ticker(yf_symbol)
                    
                    try:
                        price = ticker.fast_info.get('last_price') or ticker.fast_info.get('lastPrice')
                    except: pass
                        
                    if not price:
                        hist = ticker.history(period="1d")
                        if not hist.empty:
                            price = hist['Close'].iloc[-1]
                except:
                    pass

                # 2. If direct fails and it looks like a name, try searching for the ticker
                if (not price or price <= 0) and (' ' in t or len(t) > 6):
                    found_symbol = search_stock(t)
                    if found_symbol:
                        try:
                            ticker = yf.Ticker(found_symbol)
                            hist = ticker.history(period="1d")
                            if not hist.empty:
                                price = hist['Close'].iloc[-1]
                        except: pass

                # 3. Fallback to Mutual Fund API
                if not price or price <= 0:
                    price = get_mf_nav(t)
                
                if price and price > 0:
                    results[t] = round(float(price), 2)
                else:
                    results[t] = None
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(results).encode())
        elif self.path == '/load':
            if os.path.exists('data.json'):
                with open('data.json', 'r') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(content.encode())
            else:
                self.send_response(404)
                self.end_headers()
        else:
            super().do_GET()

class ThreadingHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    pass

if __name__ == '__main__':
    server = ThreadingHTTPServer(('', PORT), DataHandler)
    print(f"\n🚀 Fintrack Server started at http://localhost:{PORT}")
    print("Press Ctrl+C to safely shut down.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Received shut down signal (Ctrl+C).")
        print("Shutting down gracefully...")
        server.server_close()
        print("👋 Goodbye, Swastik! Fintrack closed safely.\n")
