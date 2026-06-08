import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    replacement = """  const [shipments, setShipments] = useState([]);
  const [optLog, setOptLog] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const token = window.SUPABASE_SESSION_TOKEN || localStorage.getItem("sb-token");
        const res = await fetch(`${BACKEND_URL}/api/deliveries`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
          setShipments(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch deliveries:", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (window.SUPABASE_SESSION_TOKEN || localStorage.getItem("sb-token")) {
      fetchDeliveries();
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleOptimize = async (shipmentId) => {
    setShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, optimized: true, temp: "26.5°C", eta: "50 mins" } : s));
    setOptLog(`[AI OPTIMIZATION] Re-routed shipment ${shipmentId} away from Hazaribagh thermal corridor (+3.5°C) to greenbelt bypass path. Dynamic decay risk reduced!`);
    
    try {
      const token = window.SUPABASE_SESSION_TOKEN || localStorage.getItem("sb-token");
      await fetch(`${BACKEND_URL}/api/deliveries/${shipmentId}/optimize`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Failed to optimize delivery:", err);
    }
  };

  const handleAcknowledge = async (shipmentId) => {
    setShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, status: "delivered", eta: "completed" } : s));
    if (onUpdateTrustScore) onUpdateTrustScore(prev => Math.min(100, prev + 4));
    
    try {
      const token = window.SUPABASE_SESSION_TOKEN || localStorage.getItem("sb-token");
      const res = await fetch(`${BACKEND_URL}/api/deliveries/${shipmentId}/acknowledge`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Delivery acknowledged! BARI Trust Score increased due to chain-of-custody confirmation.`, "success");
      } else {
        showToast("Failed to acknowledge: " + (json.error || "Unknown"), "error");
      }
    } catch (err) {
      console.error("Failed to acknowledge delivery:", err);
      showToast("Server error during acknowledgment", "error");
    }
  };"""

    # We need to replace the state initialization and the two handler functions
    # Using regex to match from `const [shipments...` up to the end of `handleAcknowledge`
    target_regex = r'  const \[shipments, setShipments\] = useState\(\[\s*\{ id: "SH-102"[^\]]+\]\);\s*const \[optLog, setOptLog\] = useState\(""\);\s*const handleOptimize = \(shipmentId\) => \{.*?\};\s*const handleAcknowledge = \(shipmentId\) => \{.*?\};'
    
    content = re.sub(target_regex, replacement, content, flags=re.DOTALL)

    # We also want to wrap the shipments mapping with an isLoading check just to be safe
    # But wait, we can just let it render empty if it's empty. Let's add a quick loading indicator if we want.
    # Replace `{shipments.map(s => (` with `{isLoading ? <div style={{padding: "20px", color: "var(--text-secondary)"}}>Loading deliveries...</div> : shipments.map(s => (`
    content = content.replace('{shipments.map(s => (', '{isLoading ? <div style={{padding: "20px", color: "var(--text-secondary)"}}>Loading deliveries...</div> : shipments.map(s => (')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx")
process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html")
print("Done")
