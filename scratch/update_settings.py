import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    settings_replacement = """  const [name, setName] = useState("Demo User");
  const [badgeId, setBadgeId] = useState("INS-8422-CLX");
  const [prefZone, setPrefZone] = useState("Mirpur");
  const [heatwaveAlerts, setHeatwaveAlerts] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = window.SUPABASE_SESSION_TOKEN || localStorage.getItem("sb-token");
        const res = await fetch(`${BACKEND_URL}/api/profile`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
          setName(json.data.full_name || "Demo User");
          setBadgeId(json.data.badge_id || "INS-8422-CLX");
          setPrefZone(json.data.pref_zone || "Mirpur");
          setHeatwaveAlerts(json.data.heatwave_alerts !== false);
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (window.SUPABASE_SESSION_TOKEN || localStorage.getItem("sb-token")) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const token = window.SUPABASE_SESSION_TOKEN || localStorage.getItem("sb-token");
      const res = await fetch(`${BACKEND_URL}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: name,
          badge_id: badgeId,
          pref_zone: prefZone,
          heatwave_alerts: heatwaveAlerts
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast("Profile settings successfully saved!", "success");
      } else {
        showToast("Failed to save profile: " + (json.error || "Unknown"), "error");
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      showToast("Server error during save", "error");
    }
  };"""

    target_regex = r'  const \[name, setName\] = useState\("Demo User"\);\s*const \[badgeId, setBadgeId\] = useState\("INS-8422-CLX"\);\s*const \[prefZone, setPrefZone\] = useState\("Mirpur"\);\s*const \[heatwaveAlerts, setHeatwaveAlerts\] = useState\(true\);\s*const handleSave = \(e\) => \{\s*e.preventDefault\(\);\s*showToast\("Profile settings successfully saved!", "success"\);\s*\};'
    content = re.sub(target_regex, settings_replacement, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx")
process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html")
print("Done")
