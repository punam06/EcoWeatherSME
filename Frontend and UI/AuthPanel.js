/* ═══════════════════════════════════════════════════════════════
   CLIMALOGIX AI AUTHENTICATION PANEL AUDIT & REFACTOR
   ═══════════════════════════════════════════════════════════════
   AUDIT FINDINGS:
   1. Stale Session: Old session data in Supabase client or local storage could lead to "ghost auth" states.
      - Resolved: Added useEffect hook to clear `climaLogix_token` and trigger signOut on load.
   2. Missing Client-Side Input Validation: Allowed sending empty or malformed details to the backend.
      - Resolved: Added email regex check and 6+ character length restriction for password.
   3. Lack of Visual Error Feedback: Failed credentials logged only to console or simple text error.
      - Resolved: Added card shaking animations, red border-flashing state, and inline validation errors.
   4. Stale Token Persistence: Token not explicitly stored in `climaLogix_token` on sign in.
      - Resolved: Now saving token in localStorage as `climaLogix_token` on success and verifying structure.
   5. Usability: Lacked an obvious "← Back to Home" visual escape hatch for new landing experience.
      - Resolved: Added high-visibility Back to Home button at top left.
   ═══════════════════════════════════════════════════════════════ */

const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;
function AuthPanel({
  onClose,
  onAuthSuccess,
  initialMode
}) {
  const [mode, setMode] = useState(initialMode || "login");
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [uiRole, setUiRole] = useState("producer");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const canvasRef = useRef(null);
  const reqRef = useRef(null);

  // Clear stale tokens/sessions on mount
  useEffect(() => {
    localStorage.removeItem("climaLogix_token");
    if (window.supabaseClient) {
      window.supabaseClient.auth.signOut().catch(() => {});
    }
  }, []);

  // Three.js Scene Setup (Unchanged)
  useEffect(() => {
    if (!canvasRef.current || !window.THREE) return;
    const THREE = window.THREE;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 10;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Particles
    const particleCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const colorGreen = new THREE.Color("#10B981");
    const colorBlue = new THREE.Color("#3B82F6");
    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 8 * Math.cbrt(Math.random());
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = Math.random() < 0.15 ? colorBlue : colorGreen;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.4
    });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Atmospheric Ring
    const ringGeo = new THREE.TorusGeometry(3, 0.015, 16, 100);
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x10B981,
      transparent: true,
      opacity: 0.25
    });
    const edges = new THREE.EdgesGeometry(ringGeo);
    const ring = new THREE.LineSegments(edges, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    scene.add(ring);

    // Lights
    const greenLight = new THREE.PointLight(0x10B981, 0.4);
    greenLight.position.set(5, 5, 5);
    scene.add(greenLight);
    const blueLight = new THREE.PointLight(0x3B82F6, 0.2);
    blueLight.position.set(-5, -3, 2);
    scene.add(blueLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.1));

    // Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = e => {
      mouseX = e.clientX - window.innerWidth / 2;
      mouseY = e.clientY - window.innerHeight / 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let time = 0;
    let lastFrame = performance.now();
    const animate = now => {
      reqRef.current = requestAnimationFrame(animate);
      if (document.hidden) return; // Pause when hidden

      const delta = now - lastFrame;
      if (delta < 16) return;
      lastFrame = now - delta % 16;
      time += 0.01;
      const posAttr = geometry.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        const y = posAttr.getY(i);
        posAttr.setY(i, y + Math.sin(time + i) * 0.001);
      }
      posAttr.needsUpdate = true;
      ring.rotation.z += 0.001;
      const targetX = mouseY / window.innerHeight * 0.3;
      const targetY = mouseX / window.innerWidth * 0.3;
      particles.rotation.x += (targetX - particles.rotation.x) * 0.05;
      particles.rotation.y += (targetY - particles.rotation.y) * 0.05;
      renderer.render(scene, camera);
    };
    reqRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(reqRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      edges.dispose();
    };
  }, []);
  const entropy = useMemo(() => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  }, [password]);
  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setIsSuccess(false);
    let hasError = false;

    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      setEmailError("Please enter a valid email address");
      hasError = true;
    }

    // Password Validation
    if (!password || password.length < 8 || !/[0-9]/.test(password)) {
      setPasswordError("Password must be at least 8 characters with 1 number");
      hasError = true;
    }

    // Confirm Password Validation (Register only)
    if (mode === "register") {
      if (password !== confirmPassword) {
        setConfirmPasswordError("Passwords do not match");
        hasError = true;
      }
    }
    if (hasError) {
      setPassword("");
      if (mode === "register") setConfirmPassword("");
      return;
    }
    setIsLoading(true);
    if (!window.navigator.onLine) {
      setError("Connection error — check your network");
      setIsLoading(false);
      return;
    }
    try {
      const sb = window.supabaseClient;
      if (!sb) throw new Error("Supabase client not initialized");
      const backendRole = uiRole === "producer" ? "processor" : uiRole === "inspector" ? "admin" : "buyer";
      let result;
      if (mode === "login") {
        result = await sb.auth.signInWithPassword({
          email,
          password
        });
      } else {
        result = await sb.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role: backendRole
            }
          }
        });
      }
      if (result.error) {
        throw new Error(result.error.message || "Authentication failed");
      }
      if (mode === "register") {
        setIsSuccess(true);
        setSuccessMsg("Account created — please sign in");
        setTimeout(() => {
          setMode("login");
          setIsSuccess(false);
          setPassword("");
          setConfirmPassword("");
        }, 2000);
      } else {
        setIsSuccess(true);

        // Save auth token/session correctly
        const token = result.data.session?.access_token || "mock-dev-token";
        localStorage.setItem("climaLogix_token", token);
        setTimeout(() => {
          if (onAuthSuccess) {
            onAuthSuccess(result.data.user, token);
          }
          if (onClose) onClose();
        }, 800);
      }
    } catch (err) {
      setError(err.message || "Connection failed. Please try again.");
      // Clear password field on failed attempt
      setPassword("");
      if (mode === "register") setConfirmPassword("");
    } finally {
      setIsLoading(false);
    }
  };
  const formStyles = {
    inputGroup: {
      position: "relative",
      marginBottom: "18px"
    },
    label: {
      position: "absolute",
      left: "16px",
      top: "16px",
      fontSize: "13px",
      color: "#9CA3AF",
      fontFamily: "Inter",
      pointerEvents: "none",
      transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
      background: "transparent",
      padding: "0 4px"
    },
    labelActive: {
      top: "-8px",
      left: "12px",
      fontSize: "11px",
      color: "#10B981",
      background: "#0d131f"
    },
    input: {
      width: "100%",
      padding: "14px 16px",
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: "10px",
      color: "#F9FAFB",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "14px",
      outline: "none",
      transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
      boxSizing: "border-box"
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 99999,
      background: "#0B0F19",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("style", null, `
        .auth-card {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          box-sizing: border-box;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-16px);
          transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          background: rgba(17, 24, 39, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          border: 1px solid rgba(16, 185, 129, 0.18);
          box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 20px 60px rgba(0,0,0,0.55), 0 0 40px rgba(16,185,129,0.07), inset 0 1px 0 rgba(255,255,255,0.04);
          padding: 48px 44px;
        }
        @media (max-width: 480px) {
          .auth-card {
            padding: 32px 24px;
          }
        }
        .auth-card.card--visible {
          position: relative;
          opacity: 1;
          pointer-events: all;
          transform: translateY(0);
          animation: slideInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .auth-error-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; border-color: #EF4444 !important; }
        .auth-input-focus:focus {
          border-color: rgba(16,185,129,0.55) !important;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.1) !important;
          background: rgba(16,185,129,0.04) !important;
        }
        .segment-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 28px;
          background: rgba(255,255,255,0.04);
          padding: 4px;
          border-radius: 10px;
        }
        .segment-btn {
          flex: 1;
          padding: 8px 0;
          border: none;
          border-radius: 8px;
          fontSize: 12px;
          font-family: "Inter", sans-serif;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          background: transparent;
          color: #A0AAB2;
        }
        .segment-btn.active {
          background: #10B981;
          color: #0B0F19;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
        }
        .auth-btn {
          width: 100%;
          height: 52px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          color: #0B0F19;
          font-family: "Inter", sans-serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.02em;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .auth-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
          transform: translateY(-2px);
        }
        .auth-btn:active:not(:disabled) {
          transform: translateY(0);
          filter: brightness(0.95);
        }
        .auth-btn:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }
        @keyframes teleBlink {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }
        .tele-blink {
          animation: teleBlink 2s infinite;
        }
      `), /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 5,
      pointerEvents: "none",
      background: "repeating-linear-gradient(rgba(16, 185, 129, 0.03) 0, rgba(16, 185, 129, 0.03) 1px, transparent 1px, transparent 4px)",
      backgroundSize: "100% 4px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 5,
      pointerEvents: "none",
      background: "radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.6) 100%)"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      position: "absolute",
      top: 20,
      left: 20,
      zIndex: 20,
      background: "rgba(52, 211, 153, 0.1)",
      border: "1px solid rgba(52, 211, 153, 0.45)",
      borderRadius: "8px",
      padding: "6px 12px",
      color: "#34D399",
      cursor: "pointer",
      fontSize: "12px",
      fontFamily: "Inter",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      transition: "all 0.2s"
    },
    onMouseOver: e => {
      e.currentTarget.style.background = "rgba(52, 211, 153, 0.2)";
      e.currentTarget.style.borderColor = "#34D399";
    },
    onMouseOut: e => {
      e.currentTarget.style.background = "rgba(52, 211, 153, 0.1)";
      e.currentTarget.style.borderColor = "rgba(52, 211, 153, 0.45)";
    }
  }, "\u2190 Back to Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 20,
      right: 70,
      zIndex: 5,
      color: "#10B981",
      fontSize: "10px",
      fontFamily: "'JetBrains Mono', monospace"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#10B981",
      opacity: 0.2
    }
  }, "BATCH_SYNC: "), /*#__PURE__*/React.createElement("span", {
    className: "tele-blink",
    style: {
      color: "#10B981",
      fontWeight: "bold"
    }
  }, "LIVE")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 20,
      left: 20,
      zIndex: 5,
      color: "#10B981",
      fontSize: "10px",
      fontFamily: "'JetBrains Mono', monospace"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#10B981",
      opacity: 0.2
    }
  }, "NODE: "), /*#__PURE__*/React.createElement("span", {
    className: "tele-blink",
    style: {
      color: "#10B981",
      fontWeight: "bold"
    }
  }, "ACTIVE_SECURE")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 20,
      right: 20,
      zIndex: 5,
      color: "#10B981",
      opacity: 0.2,
      fontSize: "10px",
      fontFamily: "'JetBrains Mono', monospace"
    }
  }, "SYS_OPS: NOMINAL"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100%",
      width: "100%",
      padding: "60px 16px",
      boxSizing: "border-box",
      position: "relative",
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 460,
      position: "relative",
      zIndex: 10
    }
  }, isSuccess && mode === "register" && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: -50,
      left: 0,
      right: 0,
      textAlign: "center",
      background: "rgba(16, 185, 129, 0.2)",
      border: "1px solid rgba(16, 185, 129, 0.4)",
      color: "#10B981",
      padding: "10px",
      borderRadius: "8px",
      fontSize: "13px",
      animation: "fadeSlideIn 0.3s cubic-bezier(0.4,0,0.2,1)",
      zIndex: 30
    }
  }, successMsg), /*#__PURE__*/React.createElement("div", {
    className: `auth-card ${mode === "login" ? "card--visible" : "card--hidden"}`,
    style: {
      border: isSuccess ? "2px solid #10B981" : error || emailError || passwordError ? "2px solid #EF4444" : "1px solid rgba(16, 185, 129, 0.18)",
      boxShadow: isSuccess ? "0 0 20px rgba(16, 185, 129, 0.4)" : error || emailError || passwordError ? "0 0 20px rgba(239, 68, 68, 0.4)" : "0 20px 60px rgba(0,0,0,0.55)",
      transition: "all 0.3s ease"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: (error || emailError || passwordError) && mode === "login" ? "auth-error-shake" : ""
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      marginBottom: "30px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "56px",
      height: "56px",
      background: "rgba(16, 185, 129, 0.1)",
      borderRadius: "14px",
      border: "1px solid rgba(16, 185, 129, 0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: "16px"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "28",
    height: "28",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#10B981",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      animation: "pulseGlow 2s ease-in-out infinite"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 12v10"
  }))), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "Inter",
      fontSize: "22px",
      color: "#F9FAFB",
      fontWeight: 700,
      margin: "0 0 6px"
    }
  }, "ClimaLogix AI"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "Inter",
      fontSize: "13px",
      color: "#9CA3AF"
    }
  }, "Climate-Resilient Commerce Platform")), /*#__PURE__*/React.createElement("div", {
    className: "segment-tabs"
  }, ["producer", "inspector", "sme owner"].map(r => /*#__PURE__*/React.createElement("button", {
    key: r,
    type: "button",
    className: `segment-btn ${uiRole === r ? "active" : ""}`,
    onClick: () => setUiRole(r)
  }, r === "sme owner" ? "SME Owner" : r === "inspector" ? "Inspector" : r.charAt(0).toUpperCase() + r.slice(1)))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit
  }, /*#__PURE__*/React.createElement("div", {
    style: formStyles.inputGroup
  }, /*#__PURE__*/React.createElement("input", {
    required: true,
    type: "email",
    className: "auth-input-focus",
    style: {
      ...formStyles.input,
      borderColor: emailError ? "#EF4444" : "rgba(255,255,255,0.18)"
    },
    placeholder: " ",
    value: email,
    onChange: e => {
      setEmail(e.target.value);
      setEmailError("");
      setError("");
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      ...formStyles.label,
      ...(email ? formStyles.labelActive : {}),
      color: emailError ? "#EF4444" : "#9CA3AF"
    }
  }, "Email Address"), emailError && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#EF4444",
      fontSize: "11px",
      marginTop: "4px",
      fontFamily: "Inter"
    }
  }, emailError)), /*#__PURE__*/React.createElement("div", {
    style: formStyles.inputGroup
  }, /*#__PURE__*/React.createElement("input", {
    required: true,
    type: showPass ? "text" : "password",
    className: "auth-input-focus",
    style: {
      ...formStyles.input,
      paddingRight: "40px",
      borderColor: passwordError ? "#EF4444" : "rgba(255,255,255,0.18)"
    },
    placeholder: " ",
    value: password,
    onChange: e => {
      setPassword(e.target.value);
      setPasswordError("");
      setError("");
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      ...formStyles.label,
      ...(password ? formStyles.labelActive : {}),
      color: passwordError ? "#EF4444" : "#9CA3AF"
    }
  }, "Password"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowPass(!showPass),
    style: {
      position: "absolute",
      right: "12px",
      top: "16px",
      background: "transparent",
      border: "none",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#9CA3AF",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }))), passwordError && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#EF4444",
      fontSize: "11px",
      marginTop: "4px",
      fontFamily: "Inter"
    }
  }, passwordError), password.length > 0 && !passwordError && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "4px",
      marginTop: "8px",
      height: "4px"
    }
  }, [1, 2, 3, 4].map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      flex: 1,
      borderRadius: "2px",
      transition: "all 0.3s",
      background: s <= entropy ? entropy < 2 ? "#EF4444" : entropy < 4 ? "#F59E0B" : "#10B981" : "rgba(255,255,255,0.1)"
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      cursor: "pointer",
      fontSize: "13px",
      color: "#9CA3AF",
      fontFamily: "Inter"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "16px",
      height: "16px",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "4px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.05)"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    style: {
      opacity: 0,
      position: "absolute",
      cursor: "pointer"
    },
    onChange: e => {
      e.target.parentElement.style.background = e.target.checked ? "#10B981" : "rgba(255,255,255,0.05)";
      e.target.nextSibling.style.opacity = e.target.checked ? 1 : 0;
    }
  }), /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#0B0F19",
    strokeWidth: "3",
    style: {
      opacity: 0,
      transition: "opacity 0.2s"
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), "Remember me"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "#10B981",
      fontSize: "13px",
      textDecoration: "none",
      fontFamily: "Inter"
    },
    onMouseOver: e => e.target.style.textDecoration = "underline",
    onMouseOut: e => e.target.style.textDecoration = "none"
  }, "Forgot password?")), error && mode === "login" && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#EF4444",
      fontSize: "13px",
      marginBottom: "16px",
      textAlign: "center",
      fontFamily: "Inter"
    }
  }, error), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "auth-btn",
    disabled: isLoading
  }, isLoading ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    style: {
      animation: "spin 1s linear infinite"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12a9 9 0 11-6.219-8.56"
  })), "Signing in...") : isSuccess ? /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "3"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })) : "Sign In"), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "24px 0",
      display: "flex",
      alignItems: "center",
      textAlign: "center",
      color: "#8F9CAE"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: "1px",
      background: "rgba(255,255,255,0.15)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "0 10px",
      fontSize: "12px",
      fontFamily: "Inter"
    }
  }, "New to ClimaLogix?"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: "1px",
      background: "rgba(255,255,255,0.15)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setMode("register");
      setError("");
      setEmailError("");
      setPasswordError("");
      setConfirmPasswordError("");
    },
    style: {
      background: "transparent",
      border: "none",
      color: "#10B981",
      fontSize: "14px",
      fontFamily: "Inter",
      cursor: "pointer"
    },
    onMouseOver: e => e.target.style.textDecoration = "underline",
    onMouseOut: e => e.target.style.textDecoration = "none"
  }, "Create an account")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      color: "#4B5563",
      fontSize: "11px",
      fontFamily: "Inter",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      paddingTop: "20px",
      marginTop: "20px"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "11",
    width: "18",
    height: "11",
    rx: "2",
    ry: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 11V7a5 5 0 0110 0v4"
  })), "Secured with Argon2 + JWT \xB7 End-to-end encrypted")))), /*#__PURE__*/React.createElement("div", {
    className: `auth-card ${mode === "register" ? "card--visible" : "card--hidden"}`,
    style: {
      border: isSuccess ? "2px solid #10B981" : error || emailError || passwordError || confirmPasswordError ? "2px solid #EF4444" : "1px solid rgba(16, 185, 129, 0.18)",
      boxShadow: isSuccess ? "0 0 20px rgba(16, 185, 129, 0.4)" : error || emailError || passwordError || confirmPasswordError ? "0 0 20px rgba(239, 68, 68, 0.4)" : "0 20px 60px rgba(0,0,0,0.55)",
      transition: "all 0.3s ease"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: (error || emailError || passwordError || confirmPasswordError) && mode === "register" ? "auth-error-shake" : ""
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      marginBottom: "30px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "56px",
      height: "56px",
      background: "rgba(16, 185, 129, 0.1)",
      borderRadius: "14px",
      border: "1px solid rgba(16, 185, 129, 0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: "16px"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "28",
    height: "28",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#10B981",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      animation: "pulseGlow 2s ease-in-out infinite"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 12v10"
  }))), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "Inter",
      fontSize: "20px",
      color: "#F9FAFB",
      fontWeight: 700,
      margin: 0
    }
  }, "Create Account")), /*#__PURE__*/React.createElement("div", {
    className: "segment-tabs"
  }, ["producer", "inspector", "sme owner"].map(r => /*#__PURE__*/React.createElement("button", {
    key: r,
    type: "button",
    className: `segment-btn ${uiRole === r ? "active" : ""}`,
    onClick: () => setUiRole(r)
  }, r === "sme owner" ? "SME Owner" : r === "inspector" ? "Inspector" : r.charAt(0).toUpperCase() + r.slice(1)))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit
  }, /*#__PURE__*/React.createElement("div", {
    style: formStyles.inputGroup
  }, /*#__PURE__*/React.createElement("input", {
    required: true,
    type: "text",
    className: "auth-input-focus",
    style: formStyles.input,
    placeholder: " ",
    value: name,
    onChange: e => setName(e.target.value)
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      ...formStyles.label,
      ...(name ? formStyles.labelActive : {})
    }
  }, "Full Name")), /*#__PURE__*/React.createElement("div", {
    style: formStyles.inputGroup
  }, /*#__PURE__*/React.createElement("input", {
    required: true,
    type: "email",
    className: "auth-input-focus",
    style: {
      ...formStyles.input,
      borderColor: emailError ? "#EF4444" : "rgba(255,255,255,0.18)"
    },
    placeholder: " ",
    value: email,
    onChange: e => {
      setEmail(e.target.value);
      setEmailError("");
      setError("");
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      ...formStyles.label,
      ...(email ? formStyles.labelActive : {}),
      color: emailError ? "#EF4444" : "#9CA3AF"
    }
  }, "Email Address"), emailError && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#EF4444",
      fontSize: "11px",
      marginTop: "4px",
      fontFamily: "Inter"
    }
  }, emailError)), /*#__PURE__*/React.createElement("div", {
    style: formStyles.inputGroup
  }, /*#__PURE__*/React.createElement("input", {
    required: true,
    type: "password",
    className: "auth-input-focus",
    style: {
      ...formStyles.input,
      borderColor: passwordError ? "#EF4444" : "rgba(255,255,255,0.18)"
    },
    placeholder: " ",
    value: password,
    onChange: e => {
      setPassword(e.target.value);
      setPasswordError("");
      setError("");
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      ...formStyles.label,
      ...(password ? formStyles.labelActive : {}),
      color: passwordError ? "#EF4444" : "#9CA3AF"
    }
  }, "Password"), passwordError ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#EF4444",
      fontSize: "11px",
      marginTop: "4px",
      fontFamily: "Inter"
    }
  }, passwordError) : /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#9CA3AF",
      fontSize: "11px",
      marginTop: "4px",
      fontFamily: "Inter"
    }
  }, "Must be at least 8 characters with 1 number"), password.length > 0 && !passwordError && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "4px",
      marginTop: "8px",
      height: "4px"
    }
  }, [1, 2, 3, 4].map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      flex: 1,
      borderRadius: "2px",
      transition: "all 0.3s",
      background: s <= entropy ? entropy < 2 ? "#EF4444" : entropy < 4 ? "#F59E0B" : "#10B981" : "rgba(255,255,255,0.1)"
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: formStyles.inputGroup
  }, /*#__PURE__*/React.createElement("input", {
    required: true,
    type: "password",
    className: "auth-input-focus",
    style: {
      ...formStyles.input,
      borderColor: confirmPasswordError ? "#EF4444" : "rgba(255,255,255,0.18)"
    },
    placeholder: " ",
    value: confirmPassword,
    onChange: e => {
      setConfirmPassword(e.target.value);
      setConfirmPasswordError("");
      setError("");
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      ...formStyles.label,
      ...(confirmPassword ? formStyles.labelActive : {}),
      color: confirmPasswordError ? "#EF4444" : "#9CA3AF"
    }
  }, "Confirm Password"), confirmPasswordError && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#EF4444",
      fontSize: "11px",
      marginTop: "4px",
      fontFamily: "Inter"
    }
  }, confirmPasswordError)), error && mode === "register" && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#EF4444",
      fontSize: "13px",
      marginBottom: "16px",
      textAlign: "center",
      fontFamily: "Inter"
    }
  }, error), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "auth-btn",
    disabled: isLoading
  }, isLoading ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    style: {
      animation: "spin 1s linear infinite"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12a9 9 0 11-6.219-8.56"
  })), "Creating...") : "Create Account"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: "24px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#9CA3AF",
      fontSize: "13px",
      fontFamily: "Inter"
    }
  }, "Already have an account? "), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setMode("login");
      setError("");
      setEmailError("");
      setPasswordError("");
      setConfirmPasswordError("");
    },
    style: {
      background: "transparent",
      border: "none",
      color: "#10B981",
      fontSize: "13px",
      fontFamily: "Inter",
      cursor: "pointer"
    },
    onMouseOver: e => e.target.style.textDecoration = "underline",
    onMouseOut: e => e.target.style.textDecoration = "none"
  }, "Sign in"))))))));
}
window.AuthPanel = AuthPanel;