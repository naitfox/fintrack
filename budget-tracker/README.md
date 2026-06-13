# 💸 Fintrack Personal Finance Tracker

A powerful, locally-hosted personal finance tracking application designed to provide a comprehensive view of your wealth, including bank balances, daily expenses, and live investment portfolios.

## ✨ Features

- **📊 Comprehensive Dashboard:** Instantly view your Net Worth, Bank Balance, Monthly Expenses, and Total Investments with dynamic charts.
- **📈 Live Investment Tracking:** Automatically fetches real-time prices for Stocks (via Yahoo Finance) and Mutual Funds (via MFAPI).
- **🤖 Automated PDF Statement Parsing:** 
  - Upload password-protected **SBI Bank Statements** and **SBI Credit Card Bills**.
  - The built-in Python parsing engine automatically extracts transactions and categorizes them smartly (Food, Shopping, Transport, etc.).
- **🔒 Privacy First:** All data is stored locally in `data.json`. No cloud syncing, giving you full ownership of your financial data.
- **🎨 Modern UI:** Sleek, glassmorphism design with responsive tabs and collapsible accordion layouts.

## 🚀 How to Run

1. **Install Dependencies:**
   Ensure you have Python 3 installed. You will need a few libraries for live prices and PDF parsing:
   ```bash
   pip install yfinance requests pdfplumber
   ```

2. **Start the Application:**
   Run the included launch script to start the server and open the app in your browser automatically:
   ```bash
   ./LaunchFintrack.sh
   ```

3. **Graceful Shutdown:**
   To stop the server, simply press `Ctrl + C` in the terminal window where the server is running. It will gracefully close and save any pending connections.

## 📂 Project Structure

- `index.html`: The main user interface and layout.
- `app.js`: Frontend logic for UI updates, chart rendering, and server communication.
- `styles.css`: Custom CSS styling using modern CSS variables and glassmorphism.
- `server.py`: The Python backend server that handles data persistence and live price fetching.
- `sbi_parser.py`: The robust regex and table-based engine for parsing SBI PDF statements.
- `data.json`: The local database file where all your transactions are securely stored.
- `LaunchFintrack.sh`: The convenient bash script to launch the app.

---
*Built for tracking wealth securely and beautifully.*
