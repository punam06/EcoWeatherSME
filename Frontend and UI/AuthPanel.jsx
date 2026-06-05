const { useState } = React;

function AuthPanel({ onClose, onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("buyer");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      let result;
      // Use global supabase client initialized in index.html
      const sb = window.supabaseClient; 
      
      if (mode === "login") {
        result = await sb.auth.signInWithPassword({ email, password });
      } else {
        result = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { name, role }
          }
        });
      }
      
      if (result.error) {
        setError(result.error.message || "Authentication failed");
        return;
      }
      
      if (onAuthSuccess && result.data.session) {
        onAuthSuccess(result.data.user, result.data.session.access_token);
      } else if (onAuthSuccess && result.data.user) {
        onAuthSuccess(result.data.user, null); // Signed up but maybe needs email confirmation
      }
      
      onClose();
    } catch (err) {
      setError("Connection failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)",backdropFilter:"blur(10px)" }}>
      <style>{`
        @keyframes authSlideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .auth-modal { animation: authSlideUp 0.3s cubic-bezier(0.4,0,0.2,1); }
        .auth-input:focus { border-color: #2d6a4f !important; box-shadow: 0 0 0 2px rgba(45,106,79,0.2) !important; }
      `}</style>
      <div className="auth-modal" style={{ width:"100%",maxWidth:440,background:"var(--bg-secondary)",borderRadius:20,border:"1px solid var(--border-primary)",boxShadow:"0 24px 64px rgba(0,0,0,0.5)",overflow:"hidden" }}>
        <div style={{ padding:"20px 24px 16px",borderBottom:"1px solid var(--border-primary)",background:"var(--bg-header)",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:800,fontSize:17,color:"var(--text-primary)",letterSpacing:"-0.01em" }}>
              {mode==="login"?"Welcome Back 🌱":"Create Account 🌱"}
            </div>
            <div style={{ fontSize:11.5,color:"var(--text-muted)",marginTop:2 }}>EcoSortha AI — ClimateShield Platform</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent",border:"none",color:"var(--text-muted)",fontSize:22,cursor:"pointer",lineHeight:1,padding:"0 4px" }}>×</button>
        </div>

        <div style={{ display:"flex",borderBottom:"1px solid var(--border-primary)" }}>
          {["login","register"].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError("");}} style={{ flex:1,padding:"13px",background:"transparent",border:"none",borderBottom:mode===m?"2px solid #2d6a4f":"2px solid transparent",color:mode===m?"#2d6a4f":"var(--text-muted)",fontWeight:mode===m?700:500,fontSize:13,cursor:"pointer",transition:"all 0.2s",textTransform:"capitalize" }}>
              {m==="login"?"Sign In":"Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ padding:"24px" }}>
          {error && (
            <div style={{ padding:"10px 14px",borderRadius:8,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#EF4444",fontSize:12.5,marginBottom:16 }}>
              ⚠️ {error}
            </div>
          )}

          {mode==="register" && (
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block",fontSize:11.5,fontWeight:600,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Full Name</label>
              <input className="auth-input" type="text" value={name} onChange={e=>setName(e.target.value)} required placeholder="Your full name" style={{ width:"100%",padding:"10px 13px",borderRadius:9,border:"1px solid var(--border-primary)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:13,outline:"none",boxSizing:"border-box",transition:"border-color 0.2s, box-shadow 0.2s" }} />
            </div>
          )}

          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:11.5,fontWeight:600,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Email Address</label>
            <input className="auth-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="your@email.com" style={{ width:"100%",padding:"10px 13px",borderRadius:9,border:"1px solid var(--border-primary)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:13,outline:"none",boxSizing:"border-box",transition:"border-color 0.2s, box-shadow 0.2s" }} />
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:11.5,fontWeight:600,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Password</label>
            <div style={{ position:"relative" }}>
              <input className="auth-input" type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} required placeholder={mode==="register"?"Min. 8 characters":"Your password"} style={{ width:"100%",padding:"10px 40px 10px 13px",borderRadius:9,border:"1px solid var(--border-primary)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:13,outline:"none",boxSizing:"border-box",transition:"border-color 0.2s, box-shadow 0.2s" }} />
              <button type="button" onClick={()=>setShowPass(s=>!s)} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:14 }}>{showPass?"Hide":"Show"}</button>
            </div>
          </div>
          
          {mode==="register" && (
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block",fontSize:11.5,fontWeight:600,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em" }}>Role</label>
              <select className="auth-input" value={role} onChange={e=>setRole(e.target.value)} style={{ width:"100%",padding:"10px 13px",borderRadius:9,border:"1px solid var(--border-primary)",background:"var(--bg-input)",color:"var(--text-primary)",fontSize:13,outline:"none",boxSizing:"border-box",transition:"border-color 0.2s, box-shadow 0.2s" }}>
                <option value="buyer">Consumer (Buyer)</option>
                <option value="processor">Producer (SME Processor)</option>
              </select>
            </div>
          )}

          <button type="submit" disabled={isLoading} style={{ width:"100%",padding:"12px",background:"#2d6a4f",color:"#fff",border:"none",borderRadius:9,fontWeight:600,fontSize:14,cursor:isLoading?"not-allowed":"pointer",opacity:isLoading?0.7:1,marginTop:10,transition:"background 0.2s" }}>
            {isLoading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}