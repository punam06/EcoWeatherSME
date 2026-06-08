import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract ReactRouterDOM primitives
    router_extract = """const { useState, useEffect, useRef, useMemo, useCallback } = React;
const { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } = window.ReactRouterDOM || {};"""
    
    content = content.replace('const { useState, useEffect, useRef, useMemo, useCallback } = React;', router_extract)

    # In CLimaLogixApp:
    # Remove const [activeTab, setActiveTab] = useState("dashboard");
    # Add const navigate = useNavigate();
    # Add const location = useLocation();
    # Add const activeTab = location.pathname.substring(1) || "dashboard";
    
    app_state_replace = """  const navigate = window.ReactRouterDOM ? useNavigate() : null;
  const location = window.ReactRouterDOM ? useLocation() : null;
  const activeTab = location ? (location.pathname.substring(1) || "dashboard") : "dashboard";
  const setActiveTab = (tab) => {
    if (navigate) navigate(`/${tab}`);
  };"""

    content = re.sub(r'  const \[activeTab, setActiveTab\] = useState\("dashboard"\);', app_state_replace, content)

    # In Sidebar component, it takes `activeTab` and `setTab`.
    # Wait, the Sidebar call: `<Sidebar activeTab={activeTab} setTab={setActiveTab} />` - this works perfectly fine if we redefine setActiveTab as above!

    # The rendering logic
    # {activeTab === "dashboard" && <DashboardView ... />}
    # We'll replace the block of {activeTab === ...} with <Routes> if ReactRouterDOM is available, else fallback
    
    routes_replacement = """        {window.ReactRouterDOM ? (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView trustScore={trustScore} dvs={dvs} setDvs={setDvs} activeZone={activeZone} setActiveZone={setActiveZone} liveWeather={liveWeather} detectGpsLocation={detectGpsLocation} gpsError={gpsError} />} />
            <Route path="/tracking" element={<TrackingView />} />
            <Route path="/delivery" element={<DeliveryView userRole={userRole} onUpdateTrustScore={setTrustScore} />} />
            <Route path="/notifications" element={<NotificationsView onSelectBatch={(id, zone) => { setVerificationBatchId(id); setVerificationDispatchZone(zone); setActiveTab("verification"); }} />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/marketplace" element={<MarketplaceView products={productsList} isLoading={isLoadingProducts} />} />
            <Route path="/chatbot" element={<ChatbotView setTab={setActiveTab} />} />
            <Route path="/verification" element={<VerificationView batchId={verificationBatchId} dispatchZone={verificationDispatchZone} onVerifySuccess={(s) => setTrustScore(Math.min(100, trustScore + s))} />} />
            <Route path="/docs" element={<SystemDocsView productsList={productsList} liveWeather={liveWeather} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <DashboardView
                trustScore={trustScore}
                dvs={dvs}
                setDvs={setDvs}
                activeZone={activeZone}
                setActiveZone={setActiveZone}
                liveWeather={liveWeather}
                detectGpsLocation={detectGpsLocation}
                gpsError={gpsError}
              />
            )}
            {activeTab === "tracking" && <TrackingView />}
            {activeTab === "delivery" && <DeliveryView userRole={userRole} onUpdateTrustScore={setTrustScore} />}
            {activeTab === "notifications" && (
              <NotificationsView onSelectBatch={(id, zone) => {
                setVerificationBatchId(id);
                setVerificationDispatchZone(zone);
                setActiveTab("verification");
              }} />
            )}
            {activeTab === "settings" && <SettingsView />}
            {activeTab === "marketplace" && <MarketplaceView products={productsList} isLoading={isLoadingProducts} />}
            {activeTab === "chatbot" && (
              <ChatbotView
                setTab={setActiveTab}
              />
            )}
            {activeTab === "verification" && (
              <VerificationView
                batchId={verificationBatchId}
                dispatchZone={verificationDispatchZone}
                onVerifySuccess={(scoreBonus) => {
                  setTrustScore(prev => Math.min(100, prev + scoreBonus));
                }}
              />
            )}
            {activeTab === "docs" && <SystemDocsView productsList={productsList} liveWeather={liveWeather} />}
          </>
        )}"""

    target_routes_regex = r'\{\s*activeTab === "dashboard" && \(\s*<DashboardView[\s\S]*?\{activeTab === "docs" && <SystemDocsView productsList=\{productsList\} liveWeather=\{liveWeather\} />\}'
    
    content = re.sub(target_routes_regex, routes_replacement, content)

    # We also need to wrap CLimaLogixApp inside a BrowserRouter in index.html and at the bottom of climalogix_dashboard.jsx if rendered there.
    # We will do this in the initialization section where ReactDOM.createRoot is used.
    # In climalogix_dashboard.jsx, it doesn't do ReactDOM.createRoot. It's just defining components.
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx")

# For index.html, it includes climalogix_dashboard.jsx and calls root.render
index_filepath = r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html"
with open(index_filepath, 'r', encoding='utf-8') as f:
    index_content = f.read()

index_content = index_content.replace(
    'root.render(<CLimaLogixApp />);',
    'const AppWithRouter = window.ReactRouterDOM ? <window.ReactRouterDOM.BrowserRouter><CLimaLogixApp /></window.ReactRouterDOM.BrowserRouter> : <CLimaLogixApp />;\n      root.render(AppWithRouter);'
)

with open(index_filepath, 'w', encoding='utf-8') as f:
    f.write(index_content)

print("Done")
