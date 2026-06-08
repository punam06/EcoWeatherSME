import re

# Add jsPDF to index.html
filepath_html = r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html"
with open(filepath_html, 'r', encoding='utf-8') as f:
    html_content = f.read()

jspdf_script = '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>'
if "jspdf.umd.min.js" not in html_content:
    html_content = html_content.replace('<!-- React & ReactDOM -->', f'{jspdf_script}\n    <!-- React & ReactDOM -->')

with open(filepath_html, 'w', encoding='utf-8') as f:
    f.write(html_content)

# Add dispatch slip generation to handleCheckout in climalogix_dashboard.jsx
filepath_jsx = r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx"
with open(filepath_jsx, 'r', encoding='utf-8') as f:
    jsx_content = f.read()

dispatch_func = """  const generateDispatchSlip = (product, orderId) => {
    if (typeof window.jspdf === 'undefined') return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129);
    doc.text("CLimaLogix AI - Dispatch Slip", 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Order ID: ${orderId}`, 20, 40);
    doc.text(`Product: ${product.name}`, 20, 50);
    doc.text(`Seller: ${product.seller}`, 20, 60);
    doc.text(`DVS Score: ${product.dvs}`, 20, 70);
    doc.text(`Trust Score: ${product.trust_score || 'N/A'}`, 20, 80);
    doc.text(`Date: ${new Date().toLocaleString()}`, 20, 90);
    
    doc.text("This batch has been certified viable for dispatch.", 20, 110);
    
    doc.save(`Dispatch_Slip_${orderId}_${product.id}.pdf`);
  };

  const handleCheckout = () => {"""

jsx_content = jsx_content.replace('  const handleCheckout = () => {', dispatch_func)

checkout_hook = """        setCheckoutSuccess({
          orderId,
          txHash,
          totalItems: cart.reduce((sum, item) => sum + item.quantity, 0),
          totalPrice: cart.reduce((sum, item) => {
            const rawPrice = Number((item.product.price || "").replace(/[^0-9.]/g, ""));
            const isClearance = item.product.dvs < 75;
            const price = isClearance ? Math.round(rawPrice * 0.7) : rawPrice;
            return sum + (price * item.quantity);
          }, 0) + getShippingCost(),
        });
        setCart([]);
        
        // Generate PDF Dispatch Slips for viable batches (DVS >= 60)
        cart.forEach(item => {
          if (item.product.dvs >= 60) {
            generateDispatchSlip(item.product, orderId);
          }
        });
"""

target_regex = r'        setCheckoutSuccess\(\{\s*orderId,\s*txHash,\s*totalItems: cart\.reduce\(\(sum, item\) => sum \+ item\.quantity, 0\),\s*totalPrice: cart\.reduce\(\(sum, item\) => \{\s*const rawPrice = Number\(\(item\.product\.price \|\| ""\)\.replace\(/\[ 3\\s,\]/g, ""\)\);\s*const isClearance = item\.product\.dvs < 75;\s*const price = isClearance \? Math\.round\(rawPrice \* 0\.7\) : rawPrice;\s*return sum \+ \(price \* item\.quantity\);\s*\}, 0\) \+ getShippingCost\(\),\s*\}\);\s*setCart\(\[\]\);'

jsx_content = re.sub(target_regex, checkout_hook, jsx_content)

with open(filepath_jsx, 'w', encoding='utf-8') as f:
    f.write(jsx_content)

print("Done")
