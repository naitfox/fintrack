// Fintrack App Logic

document.addEventListener('DOMContentLoaded', () => {
    // Data Management
    let transactions = JSON.parse(localStorage.getItem('fintrack_data')) || [];
    let myChart = null;
    let expenseChart = null;
    let currentPeriod = 'week'; // Default
    let livePrices = {};
    let editingId = null;

    // DOM Elements
    const elements = {
        tabs: document.querySelectorAll('.nav-item'),
        views: document.querySelectorAll('.tab-view'),
        periodBtns: document.querySelectorAll('.period-btn'),
        addBtn: document.getElementById('addBtn'),
        fabBtn: document.getElementById('fabBtn'),
        modal: document.getElementById('modal'),
        closeModal: document.getElementById('closeModal'),
        txForm: document.getElementById('txForm'),
        recentList: document.getElementById('recentList'),
        fullExpenses: document.getElementById('fullExpensesList'),
        fullInvestments: document.getElementById('fullInvestmentsList'),
        netWorth: document.getElementById('totalNetWorth'),
        totalExp: document.getElementById('monthlyExpenses'),
        totalInv: document.getElementById('totalInvestments'),
        bankBalance: document.getElementById('bankBalance'),
        exportBtn: document.getElementById('exportBtn'),
        importBtn: document.getElementById('importBtn'),
        importFile: document.getElementById('importFile'),
        chartCanvas: document.getElementById('spendingChart'),
        expenseChartCanvas: document.getElementById('expenseBreakdownChart'),
        holdingsList: document.getElementById('holdingsList'),
        investFields: document.getElementById('invest-fields'),
        qtyInput: document.getElementById('qty'),
        priceInput: document.getElementById('price'),
        amountInput: document.getElementById('amount'),
        holdingsTable: document.getElementById('holdingsTable'),
        headerTimestamp: document.getElementById('headerTimestamp'),
        uploadPdfBtn: document.getElementById('uploadPdfBtn'),
        uploadModal: document.getElementById('uploadModal'),
        closeUploadModal: document.getElementById('closeUploadModal'),
        uploadForm: document.getElementById('uploadForm'),
        stmtType: document.getElementById('stmtType'),
        pdfPassword: document.getElementById('pdfPassword'),
        uploadStatus: document.getElementById('uploadStatus')
    };

    // Initialization
    async function init() {
        await loadFromServer();
        setupTabs();
        setupModal();
        setupUploadModal();
        setupForm();
        setupDataActions();
        initChart();
        initExpenseChart();
        refreshUI();
        fetchPrices();
        startClock();
        lucide.createIcons();

        // Check for edit state
        const editId = localStorage.getItem('editingTxId');
        if (editId) {
            localStorage.removeItem('editingTxId');
            const tx = transactions.find(t => t.id == editId);
            if (tx) {
                editingId = tx.id;
                document.querySelector('#modal h3').textContent = 'Edit Transaction';
                elements.txForm.type.value = tx.type;
                document.getElementById('title').value = tx.title;
                document.getElementById('category').value = tx.category;
                elements.amountInput.value = tx.amount;
                elements.qtyInput.value = tx.qty || '';
                elements.priceInput.value = tx.price || '';
                toggleInvestFields();
                elements.modal.style.display = 'flex';
            }
        }
    }

    async function loadFromServer() {
        try {
            const resp = await fetch('/load');
            if (resp.ok) {
                transactions = await resp.json();
            }
        } catch (e) {
            console.log("No server found, using local storage fallback");
        }
    }

    async function saveToServer() {
        try {
            await fetch('/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactions)
            });
        } catch (e) {
            console.log("Failed to save to server");
        }
    }

    function setupTabs() {
        elements.tabs.forEach(tab => {
            tab.onclick = () => {
                const target = tab.dataset.tab;
                elements.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                elements.views.forEach(v => {
                    v.classList.remove('active');
                    if (v.id === `${target}-view`) v.classList.add('active');
                });
            };
        });

        // Period Switcher
        elements.periodBtns.forEach(btn => {
            btn.onclick = () => {
                currentPeriod = btn.dataset.period;
                // Sync all period buttons across tabs
                elements.periodBtns.forEach(b => {
                    b.classList.toggle('active', b.dataset.period === currentPeriod);
                });
                refreshUI();
            };
        });
    }

    function setupModal() {
        const openModal = () => {
            editingId = null;
            elements.txForm.reset();
            document.querySelector('#modal h3').textContent = 'Add New Transaction';
            elements.modal.style.display = 'flex';
            toggleInvestFields();
        };

        elements.addBtn.onclick = openModal;
        if (elements.fabBtn) elements.fabBtn.onclick = openModal;

        elements.closeModal.onclick = () => elements.modal.style.display = 'none';
        window.onclick = (e) => { 
            if (e.target === elements.modal) elements.modal.style.display = 'none'; 
            if (e.target === elements.uploadModal) elements.uploadModal.style.display = 'none';
        };

        // Toggle fields in modal
        elements.txForm.type.forEach(radio => {
            radio.onchange = toggleInvestFields;
        });
        document.getElementById('category').onchange = toggleInvestFields;
    }

    function toggleInvestFields() {
        const type = elements.txForm.type.value;
        const category = document.getElementById('category').value;
        
        if (type === 'investment' && category === 'Stock') {
            elements.investFields.classList.add('show');
        } else {
            elements.investFields.classList.remove('show');
        }
        
        // Auto-set category if type changes
        if (type === 'investment' && category !== 'Stock' && category !== 'Mutual Fund') {
            document.getElementById('category').value = 'Stock';
            toggleInvestFields(); // Re-run to show fields
        }
    }

    function setupUploadModal() {
        elements.uploadPdfBtn.onclick = () => {
            elements.uploadForm.reset();
            elements.uploadStatus.style.display = 'none';
            elements.stmtType.dispatchEvent(new Event('change')); // Trigger auto-fill password
            elements.uploadModal.style.display = 'flex';
        };

        elements.closeUploadModal.onclick = () => {
            elements.uploadModal.style.display = 'none';
        };
        
        elements.stmtType.onchange = (e) => {
            if (e.target.value === 'bank') {
                elements.pdfPassword.value = '78103101299';
            } else if (e.target.value === 'cc') {
                elements.pdfPassword.value = '101219991272';
            }
        };

        elements.uploadForm.onsubmit = async (e) => {
            e.preventDefault();
            const file = document.getElementById('pdfFile').files[0];
            if (!file) return;

            elements.uploadStatus.style.display = 'block';
            elements.uploadStatus.textContent = 'Processing PDF... Please wait.';
            elements.uploadStatus.style.color = 'var(--text)';
            
            document.getElementById('uploadSubmitBtn').disabled = true;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Data = event.target.result.split(',')[1];
                const payload = {
                    pdf_base64: base64Data,
                    password: elements.pdfPassword.value,
                    type: elements.stmtType.value
                };

                try {
                    const response = await fetch('/upload-pdf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    const result = await response.json();
                    if (result.status === 'success' && result.data && result.data.length > 0) {
                        const newTxs = result.data.map((t, i) => ({
                            ...t,
                            id: Date.now() + i
                        }));
                        transactions = [...newTxs, ...transactions];
                        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
                        
                        saveData();
                        refreshUI();
                        
                        elements.uploadStatus.textContent = `Successfully added ${newTxs.length} transactions!`;
                        elements.uploadStatus.style.color = '#10b981'; // text-green
                        setTimeout(() => {
                            elements.uploadModal.style.display = 'none';
                            document.getElementById('uploadSubmitBtn').disabled = false;
                        }, 2000);
                    } else if (result.status === 'success') {
                        elements.uploadStatus.textContent = 'No valid transactions found in PDF.';
                        elements.uploadStatus.style.color = '#ef4444'; // text-red
                        document.getElementById('uploadSubmitBtn').disabled = false;
                    } else {
                        throw new Error(result.message || 'Server Error');
                    }
                } catch (error) {
                    elements.uploadStatus.textContent = 'Error: ' + error.message;
                    elements.uploadStatus.style.color = '#ef4444'; // text-red
                    document.getElementById('uploadSubmitBtn').disabled = false;
                }
            };
            reader.readAsDataURL(file);
        };
    }

    function setupForm() {
        elements.txForm.onsubmit = (e) => {
            e.preventDefault();
            const type = elements.txForm.type.value;
            let amount = parseFloat(elements.amountInput.value);
            const qty = parseFloat(elements.qtyInput.value) || 0;
            const price = parseFloat(elements.priceInput.value) || 0;

            if (type === 'investment' && qty > 0 && price > 0) {
                amount = qty * price;
            }

            if (editingId) {
                const index = transactions.findIndex(t => t.id === editingId);
                if (index !== -1) {
                    transactions[index] = {
                        ...transactions[index],
                        type, title: document.getElementById('title').value, amount, qty, price,
                        category: document.getElementById('category').value
                    };
                }
                editingId = null;
            } else {
                const tx = {
                    id: Date.now(),
                    type: type,
                    title: document.getElementById('title').value,
                    amount: amount,
                    qty: qty,
                    price: price,
                    category: document.getElementById('category').value,
                    date: new Date().toISOString()
                };
                transactions.unshift(tx);
            }
            saveData();
            refreshUI();
            fetchPrices();
            elements.modal.style.display = 'none';
            elements.txForm.reset();
        };
    }

    function setupDataActions() {
        elements.exportBtn.onclick = () => {
            const blob = new Blob([JSON.stringify(transactions)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fintrack_backup.json`;
            a.click();
        };

        elements.importBtn.onclick = () => elements.importFile.click();
        elements.importFile.onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    transactions = JSON.parse(event.target.result);
                    saveData();
                    refreshUI();
                    alert('Import Successful!');
                } catch(e) { alert('Invalid File'); }
            };
            reader.readAsText(e.target.files[0]);
        };
    }

    function saveData() {
        localStorage.setItem('fintrack_data', JSON.stringify(transactions));
        saveToServer();
    }

    async function fetchPrices() {
        const stocks = transactions
            .filter(t => t.type === 'investment')
            .map(t => t.title.toUpperCase().trim());
        
        const uniqueStocks = [...new Set(stocks)];
        if (uniqueStocks.length === 0) return;

        try {
            const resp = await fetch(`/prices?tickers=${uniqueStocks.join(',')}`);
            if (resp.ok) {
                const prices = await resp.json();
                livePrices = { ...livePrices, ...prices };
                refreshUI();
            }
        } catch (e) {
            console.log("Failed to fetch live prices", e);
        }
    }

    function refreshUI() {
        const now = new Date();
        const filteredTransactions = transactions.filter(t => {
            const tDate = new Date(t.date);
            if (currentPeriod === 'week') {
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return tDate >= oneWeekAgo;
            } else if (currentPeriod === 'month') {
                return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
            } else if (currentPeriod === 'year') {
                return tDate.getFullYear() === now.getFullYear();
            }
            return true;
        });

        const expenses = filteredTransactions.filter(t => t.type === 'expense');

        // Global Calculations for Cumulative Metrics
        const allExpenses = transactions.filter(t => t.type === 'expense');
        const allInvestments = transactions.filter(t => t.type === 'investment');
        const allIncomes = transactions.filter(t => t.type === 'income');

        const sumAllExp = allExpenses.reduce((s, t) => s + t.amount, 0);
        const sumAllInv = allInvestments.reduce((s, t) => s + t.amount, 0);
        const sumAllInc = allIncomes.reduce((s, t) => s + t.amount, 0);

        const currentBankBalance = sumAllInc - sumAllExp;

        // Current Value of Investments
        const holdings = calculateHoldings();
        const totalCurrentInvestments = holdings.reduce((sum, h) => {
            const price = livePrices[h.title] || h.avgPrice;
            return sum + (price * h.totalQty);
        }, 0);

        // Period-specific Calculations
        const sumPeriodExp = expenses.reduce((s, t) => s + t.amount, 0);

        if (elements.bankBalance) {
            elements.bankBalance.textContent = `₹${currentBankBalance.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
        }

        elements.netWorth.textContent = `₹${(totalCurrentInvestments + currentBankBalance).toLocaleString(undefined, {maximumFractionDigits: 2})}`;
        elements.totalExp.textContent = `₹${sumPeriodExp.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
        elements.totalInv.textContent = `₹${totalCurrentInvestments.toLocaleString(undefined, {maximumFractionDigits: 2})}`;

        renderList(elements.recentList, transactions.slice(0, 5)); // Keep recent list global
        renderList(elements.fullExpenses, transactions.filter(t => t.type === 'expense'));
        renderList(elements.fullInvestments, transactions.filter(t => t.type === 'investment'));
        renderHoldings();
        renderHoldingsTable();
        
        if (myChart) updateChart(currentBankBalance, totalCurrentInvestments);
        if (expenseChart) updateExpenseChart(expenses);
        lucide.createIcons();
    }

    function renderList(container, data) {
        if (!data.length) {
            container.innerHTML = `<div style="padding: 2rem; color: #94a3b8; text-align: center;">No activity found.</div>`;
            return;
        }
        container.innerHTML = data.map(t => `
            <div class="transaction-item">
                <div class="tx-info">
                    <strong style="display: block;">${t.title}</strong>
                    <small style="color: #94a3b8">${t.category} • ${new Date(t.date).toLocaleDateString()}</small>
                </div>
                <div class="tx-right">
                    <span class="text-${t.type === 'expense' ? 'red' : 'green'}">
                        ${t.type === 'expense' ? '-' : '+'}₹${t.amount.toLocaleString()}
                    </span>
                    <div class="tx-actions">
                        <button class="action-icon edit" onclick="window.editTx(${t.id})" title="Edit">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button class="action-icon delete" onclick="window.deleteTx(${t.id})" title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Global Action Handlers


    function startClock() {
        const update = () => {
            const now = new Date();
            const options = { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true 
            };
            elements.headerTimestamp.textContent = now.toLocaleString('en-IN', options).replace(',', ' •');
        };
        update();
        setInterval(update, 1000);
    }

    window.deleteTx = (id) => {
        if (confirm('Are you sure you want to delete this transaction?')) {
            transactions = transactions.filter(t => t.id !== id);
            saveData();
            refreshUI();
        }
    };

    window.editTx = (id) => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;

        editingId = id;
        document.querySelector('#modal h3').textContent = 'Edit Transaction';
        
        // Fill form
        elements.txForm.type.value = tx.type;
        document.getElementById('title').value = tx.title;
        document.getElementById('category').value = tx.category;
        elements.amountInput.value = tx.amount;
        elements.qtyInput.value = tx.qty || '';
        elements.priceInput.value = tx.price || '';
        
        toggleInvestFields();
        elements.modal.style.display = 'flex';
    };

    // Global action handlers are attached to window above.



    function initChart() {
        const ctx = elements.chartCanvas.getContext('2d');
        myChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Cash in Bank', 'Investments'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#38bdf8', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8' } },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ₹${context.raw.toLocaleString()}`
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    function updateChart(currentBankBalance, totalCurrentInvestments) {
        myChart.data.datasets[0].data = [Math.max(0, currentBankBalance), totalCurrentInvestments];
        myChart.update();
    }
    
    function initExpenseChart() {
        if (!elements.expenseChartCanvas) return;
        const ctx = elements.expenseChartCanvas.getContext('2d');
        expenseChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#fb923c', '#6366f1', '#38bdf8', '#f472b6', '#10b981', '#f43f5e', '#94a3b8'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8' } }
                }
            }
        });
    }

    function updateExpenseChart(expenses) {
        const categories = {};
        expenses.forEach(e => {
            if (e.title === 'Opening Balance') return;
            categories[e.category] = (categories[e.category] || 0) + e.amount;
        });

        expenseChart.data.labels = Object.keys(categories);
        expenseChart.data.datasets[0].data = Object.values(categories);
        expenseChart.update();
    }

    function renderHoldings() {
        const holdings = calculateHoldings();
        if (!holdings.length) {
            elements.holdingsList.innerHTML = `<div style="grid-column: 1/-1; padding: 2rem; color: #94a3b8; text-align: center;">No holdings found. Add investments to see them here.</div>`;
            return;
        }

        elements.holdingsList.innerHTML = holdings.map(h => {
            const currentPrice = livePrices[h.title] || 0;
            const currentValue = currentPrice * h.totalQty;
            const pnl = currentValue > 0 ? currentValue - h.totalInvested : 0;
            const pnlPercent = h.totalInvested > 0 ? (pnl / h.totalInvested) * 100 : 0;
            const isProfit = pnl >= 0;

            return `
                <div class="holding-card glass">
                    <div class="ticker">${h.title}</div>
                    <div class="main-val">₹${(currentValue || h.totalInvested).toLocaleString()}</div>
                    <div class="stats">
                        <span>Qty: <b>${h.totalQty.toLocaleString()}</b></span>
                        <span>Avg: <b>₹${h.avgPrice.toLocaleString(undefined, {maximumFractionDigits: 1})}</b></span>
                        ${currentPrice ? `<span>LTP: <b>₹${currentPrice.toLocaleString()}</b></span>` : ''}
                    </div>
                    ${currentPrice ? `
                        <div class="pnl-badge ${isProfit ? 'profit' : 'loss'}">
                            <i data-lucide="${isProfit ? 'trending-up' : 'trending-down'}"></i>
                            ${isProfit ? '+' : ''}${pnlPercent.toFixed(1)}% (₹${Math.abs(pnl).toLocaleString()})
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }
    
    function renderHoldingsTable() {
        const holdings = calculateHoldings();
        if (!holdings.length) {
            elements.holdingsTable.innerHTML = `<div style="padding: 2rem; color: #94a3b8; text-align: center;">No holdings found.</div>`;
            return;
        }

        let tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Ticker</th>
                        <th>Qty</th>
                        <th>Avg Price</th>
                        <th>LTP</th>
                        <th>Current Value</th>
                        <th>P&L</th>
                        <th>Change %</th>
                    </tr>
                </thead>
                <tbody>
        `;

        tableHtml += holdings.map(h => {
            const currentPrice = livePrices[h.title] || 0;
            const currentValue = currentPrice * h.totalQty;
            const pnl = currentValue > 0 ? currentValue - h.totalInvested : 0;
            const pnlPercent = h.totalInvested > 0 ? (pnl / h.totalInvested) * 100 : 0;
            const isProfit = pnl >= 0;
            const pnlClass = isProfit ? 'text-green' : 'text-red';

            return `
                <tr>
                    <td class="ticker-cell">${h.title}</td>
                    <td>${h.totalQty.toLocaleString()}</td>
                    <td class="amount-cell">₹${h.avgPrice.toLocaleString(undefined, {maximumFractionDigits: 1})}</td>
                    <td class="amount-cell">${currentPrice ? `₹${currentPrice.toLocaleString()}` : '-'}</td>
                    <td class="amount-cell">₹${(currentValue || h.totalInvested).toLocaleString()}</td>
                    <td class="amount-cell ${pnlClass}">${isProfit ? '+' : ''}₹${Math.abs(pnl).toLocaleString()}</td>
                    <td class="amount-cell ${pnlClass}">${isProfit ? '+' : ''}${pnlPercent.toFixed(1)}%</td>
                </tr>
            `;
        }).join('');

        // Calculate Overall Totals
        const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
        const totalCurrent = holdings.reduce((sum, h) => {
            const price = livePrices[h.title] || 0;
            return sum + (price > 0 ? price * h.totalQty : h.totalInvested);
        }, 0);
        const totalPnl = totalCurrent - totalInvested;
        const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
        const overallIsProfit = totalPnl >= 0;
        const overallPnlClass = overallIsProfit ? 'text-green' : 'text-red';

        tableHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4">Overall Total</td>
                        <td class="amount-cell">₹${totalCurrent.toLocaleString()}</td>
                        <td class="amount-cell ${overallPnlClass}">${overallIsProfit ? '+' : ''}₹${Math.abs(totalPnl).toLocaleString()}</td>
                        <td class="amount-cell ${overallPnlClass}">${overallIsProfit ? '+' : ''}${totalPnlPercent.toFixed(1)}%</td>
                    </tr>
                </tfoot>
            </table>
        `;

        elements.holdingsTable.innerHTML = tableHtml;
    }

    function calculateHoldings() {
        const holdingsMap = {};
        transactions.filter(t => t.type === 'investment').forEach(t => {
            const key = t.title.toUpperCase().trim();
            if (!holdingsMap[key]) {
                holdingsMap[key] = { title: key, totalQty: 0, totalInvested: 0 };
            }
            const qty = t.qty || 1; // Fallback for old data
            const amount = t.amount || 0;
            holdingsMap[key].totalQty += qty;
            holdingsMap[key].totalInvested += amount;
        });

        return Object.values(holdingsMap).map(h => ({
            ...h,
            avgPrice: h.totalInvested / h.totalQty
        }));
    }

    window.toggleSection = (header) => {
        const section = header.parentElement;
        section.classList.toggle('active');
        // If content height changes, we might need to refresh icons
        lucide.createIcons();
    };

    init();
});
