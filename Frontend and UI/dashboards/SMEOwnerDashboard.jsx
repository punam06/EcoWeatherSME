function SMEOwnerDashboard() { return <div style={{ padding: '40px', color: 'white' }}><h1>SME Owner Dashboard</h1><p>Under Construction</p><button onClick={() => { localStorage.clear(); window.location.reload(); }}>Logout</button></div>; }
window.SMEOwnerDashboard = SMEOwnerDashboard;
