import pdfplumber
from datetime import datetime
import re

def categorize(desc):
    desc = desc.lower()
    if any(k in desc for k in ['zomato', 'swiggy', 'mcdonalds', 'kfc', 'restaurant', 'pizza', 'food']):
        return 'Food'
    if any(k in desc for k in ['amazon', 'flipkart', 'myntra', 'ajio', 'shopping', 'reliance', 'mart']):
        return 'Shopping'
    if any(k in desc for k in ['uber', 'ola', 'irctc', 'makemytrip', 'petrol', 'fuel', 'metro']):
        return 'Transport'
    if any(k in desc for k in ['zerodha', 'groww', 'upstox', 'mutual', 'sip', 'investment']):
        return 'Investment'
    if any(k in desc for k in ['salary', 'neft', 'imps', 'upi/cr']):
        return 'Salary'
    return 'Other'

def parse_sbi_bank(pdf_path, password):
    transactions = []
    try:
        with pdfplumber.open(pdf_path, password=password) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        # Usually at least 6 columns
                        if not row or len(row) < 5:
                            continue
                        
                        date_str = row[0]
                        desc = row[1]
                        
                        # Sometimes there's no branch code, making Debit column index 4 or 5
                        # Safest way is from the end (Balance is last, Debit is -2, Credit is -3)
                        try:
                            debit = row[-2]
                            credit = row[-3]
                        except IndexError:
                            continue
                        
                        if not date_str or not desc:
                            continue
                            
                        # Try to parse date '12 May 2026', '12/05/2026', '06-04-26'
                        date_obj = None
                        for fmt in ("%d %b %Y", "%d/%m/%Y", "%d-%b-%Y", "%d %b %y", "%d-%b-%y", "%d-%m-%y", "%d-%m-%Y"):
                            try:
                                date_obj = datetime.strptime(date_str.strip(), fmt)
                                break
                            except ValueError:
                                pass
                        
                        if not date_obj:
                            continue # Not a transaction row
                            
                        amount = 0
                        type_ = "expense"
                        
                        # Clean debit/credit values
                        debit_val = debit.strip().replace(',', '') if debit else ''
                        credit_val = credit.strip().replace(',', '') if credit else ''
                        
                        if debit_val and debit_val != '0.00' and debit_val != '':
                            try:
                                amount = float(debit_val)
                                type_ = "expense"
                            except ValueError:
                                pass
                        elif credit_val and credit_val != '0.00' and credit_val != '':
                            try:
                                amount = float(credit_val)
                                type_ = "income"
                            except ValueError:
                                pass
                        
                        if amount == 0:
                            continue
                            
                        transactions.append({
                            "type": type_,
                            "title": desc.strip().replace('\n', ' '),
                            "amount": amount,
                            "category": categorize(desc),
                            "date": date_obj.isoformat() + "Z"
                        })
    except Exception as e:
        print(f"Error parsing bank statement: {e}")
        raise e
    return transactions

def parse_sbi_credit_card(pdf_path, password):
    transactions = []
    try:
        with pdfplumber.open(pdf_path, password=password) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text:
                    continue
                lines = text.split('\n')
                for line in lines:
                    # Match: DD MMM YY ... Amount (C/D)
                    match = re.match(r'^(\d{2}\s[A-Za-z]{3}\s\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})\s*([CDcd])\s*$', line.strip())
                    if match:
                        date_str, desc, amount_str, cd = match.groups()
                        
                        try:
                            date_obj = datetime.strptime(date_str.strip(), "%d %b %y")
                        except ValueError:
                            try:
                                date_obj = datetime.strptime(date_str.strip(), "%d %b %Y")
                            except ValueError:
                                continue
                                
                        amt_val = amount_str.replace(',', '')
                        is_credit = cd.upper() == 'C'
                        
                        try:
                            amount = float(amt_val)
                            
                            transactions.append({
                                "type": "income" if is_credit else "expense",
                                "title": desc.strip(),
                                "amount": amount,
                                "category": categorize(desc) if not is_credit else "Investment",
                                "date": date_obj.isoformat() + "Z"
                            })
                        except ValueError:
                            pass
    except Exception as e:
        print(f"Error parsing CC statement: {e}")
        raise e
    return transactions
