function InspectorDashboard() { return <div style={{ padding: '40px', color: 'white' }}><h1>Inspector Dashboard</h1><p>Under Construction</p><button onClick={() => { localStorage.clear(); window.location.reload(); }}>Logout</button></div>; }
window.InspectorDashboard = InspectorDashboard;
