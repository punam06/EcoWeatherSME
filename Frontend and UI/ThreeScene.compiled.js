/* ═══════════════════════════════════════════════════════════════
   CLIMALOGIX AI — 3D SCENE MODULE (ThreeScene.js)
   ═══════════════════════════════════════════════════════════════
   TECH STACK DECISION DOCUMENTATION:
   - Framework Pattern: Standalone React 18 component loaded via CDN in index.html (no build step).
   - 3D Rendering Choice: Vanilla Three.js via CDN. This choice avoids npm/bundler dependency overhead
     while allowing complete programmatic control to build procedural low-poly assets (trees, produce,
     animals) and responsive shader/particle systems directly in the client browser.
   ═══════════════════════════════════════════════════════════════ */

function ThreeScene() {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current || !window.THREE) return;
    const THREE = window.THREE;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene & Renderer Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 1, 0);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // 2. Hardware / Performance Level Check
    const isLowPower = typeof navigator !== 'undefined' && navigator.hardwareConcurrency != null && navigator.hardwareConcurrency < 4;

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x10B981, 0.85);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 4. Ground Plane
    const groundGeo = new THREE.PlaneGeometry(16, 16, 4, 4);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x091410,
      roughness: 0.8,
      flatShading: true
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Helper: Create a low-poly tree
    const createTree = (x, z, scale = 1) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, -1.5, z);
      treeGroup.scale.set(scale, scale, scale);

      // Trunk (Cylinder)
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 5);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x5c4033,
        flatShading: true
      });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Canopy (Cones stacked)
      const canopyColors = [0x059669, 0x10B981, 0x34D399];
      for (let i = 0; i < 3; i++) {
        const coneGeo = new THREE.ConeGeometry(0.9 - i * 0.2, 1.2, 5);
        const coneMat = new THREE.MeshStandardMaterial({
          color: canopyColors[i],
          flatShading: true
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.y = 2 + i * 0.8;
        cone.castShadow = true;
        treeGroup.add(cone);
      }
      scene.add(treeGroup);
      return treeGroup;
    };

    // 5. Trees (2-3)
    const trees = [createTree(-2.5, -2, 1.1), createTree(3, -1.5, 0.95), createTree(-1.8, 1, 0.85)];

    // Helper: Create low-poly vegetables
    const createVegetable = (type, colorVal) => {
      const vegGroup = new THREE.Group();
      const vegMat = new THREE.MeshStandardMaterial({
        color: colorVal,
        flatShading: true
      });
      if (type === 'carrot') {
        // Carrot body (Cone)
        const coneGeo = new THREE.ConeGeometry(0.25, 0.9, 5);
        const cone = new THREE.Mesh(coneGeo, vegMat);
        cone.rotation.x = Math.PI; // Point down
        vegGroup.add(cone);

        // Leaf greens
        const leafGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08);
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x059669,
          flatShading: true
        });
        const leaf1 = new THREE.Mesh(leafGeo, leafMat);
        leaf1.position.set(0, 0.55, 0);
        vegGroup.add(leaf1);
      } else if (type === 'pepper') {
        // Pepper body (Box-ish shape)
        const bodyGeo = new THREE.BoxGeometry(0.35, 0.45, 0.35);
        const body = new THREE.Mesh(bodyGeo, vegMat);
        vegGroup.add(body);

        // Stem
        const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.15, 4);
        const stemMat = new THREE.MeshStandardMaterial({
          color: 0x047857,
          flatShading: true
        });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.3;
        vegGroup.add(stem);
      } else {
        // Corn (Cylinder-like)
        const bodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.7, 5);
        const body = new THREE.Mesh(bodyGeo, vegMat);
        vegGroup.add(body);

        // Husk base
        const huskGeo = new THREE.ConeGeometry(0.22, 0.4, 4);
        const huskMat = new THREE.MeshStandardMaterial({
          color: 0x84cc16,
          flatShading: true
        });
        const husk = new THREE.Mesh(huskGeo, huskMat);
        husk.position.y = -0.2;
        vegGroup.add(husk);
      }
      scene.add(vegGroup);
      return vegGroup;
    };

    // 6. Vegetables
    const veggies = [{
      mesh: createVegetable('carrot', 0xeab308),
      baseX: -1.2,
      baseZ: 2,
      offset: 0
    }, {
      mesh: createVegetable('pepper', 0x10B981),
      baseX: 1.5,
      baseZ: 3,
      offset: Math.PI / 3
    }, {
      mesh: createVegetable('corn', 0xf59e0b),
      baseX: 0.8,
      baseZ: 0.5,
      offset: Math.PI / 1.5
    }];

    // Position vegetables
    veggies.forEach(v => {
      v.mesh.position.set(v.baseX, 0.5, v.baseZ);
      v.mesh.castShadow = true;
    });

    // 7. Animal (Silhouette/Low-poly cow or bird)
    // We will build an abstract low-poly sheep/cow using blocks
    const animalGroup = new THREE.Group();
    animalGroup.position.set(-0.5, -1.0, -1);

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.5, 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      flatShading: true
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    animalGroup.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0.45, 0.25, 0);
    head.castShadow = true;
    animalGroup.add(head);

    // Snout
    const snoutGeo = new THREE.BoxGeometry(0.15, 0.15, 0.2);
    const snoutMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      flatShading: true
    });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0.6, 0.2, 0);
    animalGroup.add(snout);

    // Legs (4)
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 4);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      flatShading: true
    });
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(i < 2 ? -0.25 : 0.25, -0.4, i % 2 === 0 ? -0.18 : 0.18);
      leg.castShadow = true;
      animalGroup.add(leg);
    }
    scene.add(animalGroup);

    // 8. Particle Field
    const particleCount = isLowPower ? 80 : 300;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const pSpeeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10; // X
      positions[i * 3 + 1] = Math.random() * 8 - 1.5; // Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8; // Z
      pSpeeds[i] = 0.01 + Math.random() * 0.015;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMaterial = new THREE.PointsMaterial({
      size: 0.12,
      transparent: true,
      opacity: 0.65,
      color: 0x3B82F6 // Initial color (Tech Blue)
    });
    const particles = new THREE.Points(particleGeo, pMaterial);
    scene.add(particles);

    // 9. Protective Torus Ring
    let ring;
    if (!isLowPower) {
      const ringGeo = new THREE.TorusGeometry(3.5, 0.04, 8, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x10B981,
        wireframe: true,
        transparent: true,
        opacity: 0.35
      });
      ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 1, 0);
      ring.rotation.x = Math.PI / 3;
      scene.add(ring);
    }

    // 10. Mouse & Animation Variables
    let mouseX = 0;
    let mouseY = 0;
    let targetRotY = 0;
    let targetRotX = 0;
    const handleMouseMove = e => {
      mouseX = e.clientX / window.innerWidth - 0.5;
      mouseY = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let time = 0;
    let reqId;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      time += 0.01;

      // Sway trees
      trees.forEach((t, idx) => {
        t.rotation.z = Math.sin(time + idx) * 0.03;
        t.rotation.y = Math.cos(time * 0.5 + idx) * 0.015;
      });

      // Float veggies
      veggies.forEach((v, idx) => {
        v.mesh.position.y = 0.5 + Math.sin(time * 1.5 + v.offset) * 0.12;
        v.mesh.rotation.y += 0.01;
        v.mesh.rotation.x = Math.sin(time * 0.8) * 0.05;
      });

      // Animal bobbing
      animalGroup.position.y = -1.0 + Math.abs(Math.sin(time * 2)) * 0.08;

      // Animate particles (drift upwards)
      const posArr = particleGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] += pSpeeds[i]; // Increment Y
        if (posArr[i * 3 + 1] > 6.5) {
          posArr[i * 3 + 1] = -1.5; // Reset to ground
          posArr[i * 3] = (Math.random() - 0.5) * 10;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Color oscillation for particles (Tech Blue <-> Ambient Emerald/Amber)
      const oscVal = (Math.sin(time * 0.3) + 1) / 2; // 0 to 1
      pMaterial.color.lerpColors(new THREE.Color(0x3B82F6), new THREE.Color(0xF59E0B), oscVal);

      // Rotate protective ring
      if (ring) {
        ring.rotation.z += 0.003;
      }

      // Parallax mouse lerping
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        // Auto-rotation fallback on mobile
        scene.rotation.y += 0.003;
      } else {
        targetRotY += (mouseX * 0.4 - targetRotY) * 0.05;
        targetRotX += (mouseY * 0.25 - targetRotX) * 0.05;
        scene.rotation.y = targetRotY;
        scene.rotation.x = targetRotX;
      }
      renderer.render(scene, camera);
    };
    animate();

    // 11. Responsive Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      particleGeo.dispose();
      pMaterial.dispose();
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    ref: containerRef,
    style: {
      width: "100%",
      height: "100%",
      minHeight: "350px",
      position: "relative",
      zIndex: 2
    }
  });
}
window.ThreeScene = ThreeScene;