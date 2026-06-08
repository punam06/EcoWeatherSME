import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add gpsError state to CLimaLogixApp
    state_injection = """  const [gpsError, setGpsError] = useState(null);
"""
    content = re.sub(r'(  const \[liveWeather, setLiveWeather\] = useState\(\{[^}]+\}\);)', r'\1\n' + state_injection, content)

    # Update detectGpsLocation
    detect_gps_replacement = """  const detectGpsLocation = () => {
    setGpsError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setLiveWeather(prev => ({ ...prev, source: "fetching" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsError(null);
        const { latitude, longitude } = pos.coords;
        const closest = findClosestZone(latitude, longitude);
        setActiveZone(closest);
        setLiveWeather(prev => ({ ...prev, source: "live-device" }));
      },
      (err) => {
        setGpsError("GPS auto-detection failed: " + err.message + ". Please select manually.");
        console.warn("[LiveWeather] Geolocation failed:", err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };"""

    target_regex = r'  const detectGpsLocation = \(\) => \{\s*if \(typeof navigator === "undefined" \|\| !navigator\.geolocation\) \{\s*showToast\("Geolocation is not supported by your browser.", "error"\);\s*return;\s*\}\s*setLiveWeather\(prev => \(\{ \.\.\.prev, source: "fetching" \}\)\);\s*navigator\.geolocation\.getCurrentPosition\(\s*\(pos\) => \{\s*const \{ latitude, longitude \} = pos\.coords;\s*const closest = findClosestZone\(latitude, longitude\);\s*setActiveZone\(closest\);\s*setLiveWeather\(prev => \(\{ \.\.\.prev, source: "live-device" \}\)\);\s*\},\s*\(err\) => \{\s*showToast\("GPS auto-detection failed: " \+ err\.message \+ "\. Falling back to manual selection\.", "error"\);\s*console\.warn\("\[LiveWeather\] Geolocation failed:", err\);\s*\},\s*\{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 \}\s*\);\s*\};'
    content = re.sub(target_regex, detect_gps_replacement, content)

    # Pass gpsError to DashboardView
    # Wait, in the DashboardView, the user selects the zone via LocationPicker. It's inside DashboardView.
    # Where does DashboardView receive detectGpsLocation? 
    # `<DashboardView trustScore={trustScore} dvs={dvs} setDvs={setDvs} activeZone={activeZone} setActiveZone={setActiveZone} liveWeather={liveWeather} detectGpsLocation={detectGpsLocation} />`
    content = content.replace('detectGpsLocation={detectGpsLocation}', 'detectGpsLocation={detectGpsLocation} gpsError={gpsError}')
    
    # Update DashboardView signature
    content = re.sub(r'function DashboardView\(\{(.*?)(detectGpsLocation)(.*?)\}\)', r'function DashboardView({\1\2, gpsError\3})', content)

    # Insert gpsError inside DashboardView right after the detectGpsLocation button
    # The button is usually `<button onClick={detectGpsLocation} ...`
    # Let's find it.
    error_html = """
              </div>
              {gpsError && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: ACCENT.red, background: ACCENT.redBg, padding: "8px 12px", borderRadius: "6px", border: `1px solid ${ACCENT.redBorder}` }}>
                  {gpsError}
                </div>
              )}"""
    
    # Wait, in DashboardView, there is a `LocationPicker`.
    # Let's find `<LocationPicker activeZone={activeZone} setActiveZone={setActiveZone} detectGpsLocation={detectGpsLocation} />`
    content = content.replace('detectGpsLocation={detectGpsLocation}', 'detectGpsLocation={detectGpsLocation} gpsError={gpsError}')
    content = re.sub(r'function LocationPicker\(\{(.*?)(detectGpsLocation)(.*?)\}\)', r'function LocationPicker({\1\2, gpsError\3})', content)
    
    # Now in LocationPicker:
    # <div style={{ display: "flex", gap: "10px" }}>
    #   <select ...>
    #   <button onClick={detectGpsLocation} ...>
    # </div>
    # Let's insert error_html after that div.
    # We can match `          </button>\n        </div>` inside LocationPicker.
    # Actually, let's just do a string replace in `LocationPicker`.
    
    lp_replacement = """          </button>
        </div>
        {gpsError && (
          <div style={{ marginTop: "8px", fontSize: "12px", color: ACCENT.red, background: ACCENT.redBg, padding: "8px 12px", borderRadius: "6px", border: `1px solid ${ACCENT.redBorder}` }}>
            ⚠️ {gpsError}
          </div>
        )}"""
    
    content = content.replace('          </button>\n        </div>\n      </div>\n    </Card>', lp_replacement + '\n      </div>\n    </Card>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx")
process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html")
print("Done")
