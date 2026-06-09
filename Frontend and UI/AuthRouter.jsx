function AuthRouter() {
  const [currentUser, setCurrentUser] = React.useState(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    const userStr = localStorage.getItem("climaLogix_user") || localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const handleAuthSuccess = (user, token) => {
    setCurrentUser(user);
  };

  if (!isLoaded) return <div style={{color: "white"}}>Loading...</div>;

  if (!currentUser) {
    return window.AuthPanel ? <window.AuthPanel onAuthSuccess={handleAuthSuccess} /> : <div style={{color: "white"}}>AuthPanel not found</div>;
  }

  const role = currentUser.user_metadata?.role || currentUser.role || "buyer";

  if (["sme", "sme_owner", "buyer"].includes(role)) {
    return window.SMEOwnerDashboard ? <window.SMEOwnerDashboard /> : <div style={{color: "white"}}>SMEOwnerDashboard missing</div>;
  }
  if (["processor", "manufacturer"].includes(role)) {
    return window.ProducerDashboard ? <window.ProducerDashboard /> : <div style={{color: "white"}}>ProducerDashboard missing</div>;
  }
  if (["inspector", "admin"].includes(role)) {
    return window.InspectorDashboard ? <window.InspectorDashboard /> : <div style={{color: "white"}}>InspectorDashboard missing</div>;
  }

  return window.AuthPanel ? <window.AuthPanel onAuthSuccess={handleAuthSuccess} /> : <div style={{color: "white"}}>AuthPanel not found</div>;
}
window.AuthRouter = AuthRouter;
