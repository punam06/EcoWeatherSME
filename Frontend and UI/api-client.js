const IS_LOCAL_DEV = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
window.BACKEND_URL = IS_LOCAL_DEV ? "http://localhost:5001" : "https://backsme.onrender.com";


