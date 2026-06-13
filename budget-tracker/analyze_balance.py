import json

with open('data.json', 'r') as f:
    data = json.load(f)

incomes = sum(t['amount'] for t in data if t.get('type') == 'income')
expenses = sum(t['amount'] for t in data if t.get('type') == 'expense')
investments = sum(t['amount'] for t in data if t.get('type') == 'investment')

print(f"Total Incomes: {incomes}")
print(f"Total Expenses: {expenses}")
print(f"Total Investments: {investments}")
print(f"Calculated Balance: {incomes - expenses - investments}")

# Print largest expenses to see what's draining it
exp_list = sorted([t for t in data if t.get('type') == 'expense'], key=lambda x: x['amount'], reverse=True)
print("\nTop 10 Expenses:")
for t in exp_list[:10]:
    print(f"{t['amount']} | {t['title']} | {t['category']}")
