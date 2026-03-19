import * as THREE from 'three';

export interface RendererConfig {
  container: HTMLElement;
  width?: number;
  height?: number;
  antialias?: boolean;
  shadows?: boolean;
}

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private animationId: number | null = null;
  private resizeHandler: () => void;
  
  // Visual objects tracking
  private meshes: Map<string, THREE.Object3D> = new Map();
  private lights: Map<string, THREE.Light> = new Map();
  private particles: Map<string, THREE.Points> = new Map();

  constructor(config: RendererConfig) {
    const { container, width = window.innerWidth, height = window.innerHeight, antialias = true, shadows = true } = config;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 2000);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
    this.camera.position.set(0, 10, 20);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias, 
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Add to container
    container.appendChild(this.renderer.domElement);

    // Create clock
    this.clock = new THREE.Clock();

    // Setup resize handler
    this.resizeHandler = () => {
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || window.innerHeight;
      this.camera.aspect = newWidth / newHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', this.resizeHandler);

    // Setup default lighting
    this.setupLighting();
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
    this.lights.set('ambient', ambientLight);

    // Directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(100, 200, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -200;
    sunLight.shadow.camera.right = 200;
    sunLight.shadow.camera.top = 200;
    sunLight.shadow.camera.bottom = -200;
    this.scene.add(sunLight);
    this.lights.set('sun', sunLight);

    // Hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x362d1d, 0.4);
    this.scene.add(hemiLight);
    this.lights.set('hemi', hemiLight);
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getClock(): THREE.Clock {
    return this.clock;
  }

  public setCameraTarget(position: THREE.Vector3, lookAt?: THREE.Vector3): void {
    this.camera.position.copy(position);
    if (lookAt) {
      this.camera.lookAt(lookAt);
    }
  }

  public followObject(objectId: string, offset: THREE.Vector3 = new THREE.Vector3(0, 10, -15)): void {
    const object = this.meshes.get(objectId);
    if (object) {
      const targetPos = object.position.clone().add(offset);
      this.camera.position.lerp(targetPos, 0.1);
      this.camera.lookAt(object.position);
    }
  }

  public createMesh(
    id: string, 
    geometry: THREE.BufferGeometry, 
    material: THREE.Material,
    castShadow = true,
    receiveShadow = true
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    this.scene.add(mesh);
    this.meshes.set(id, mesh);
    return mesh;
  }

  public createBox(
    id: string,
    width: number,
    height: number,
    depth: number,
    color: number,
    position?: THREE.Vector3
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ 
      color,
      roughness: 0.7,
      metalness: 0.1
    });
    const mesh = this.createMesh(id, geometry, material);
    if (position) {
      mesh.position.copy(position);
    }
    return mesh;
  }

  public createSphere(
    id: string,
    radius: number,
    color: number,
    position?: THREE.Vector3
  ): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, 32, 16);
    const material = new THREE.MeshStandardMaterial({ 
      color,
      roughness: 0.5,
      metalness: 0.3
    });
    const mesh = this.createMesh(id, geometry, material);
    if (position) {
      mesh.position.copy(position);
    }
    return mesh;
  }

  public createCylinder(
    id: string,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    color: number,
    position?: THREE.Vector3
  ): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32);
    const material = new THREE.MeshStandardMaterial({ 
      color,
      roughness: 0.6,
      metalness: 0.2
    });
    const mesh = this.createMesh(id, geometry, material);
    if (position) {
      mesh.position.copy(position);
    }
    return mesh;
  }

  public createGround(size: number, color: number = 0x3d5c3d): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({ 
      color,
      roughness: 0.9,
      metalness: 0.0
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.set('ground', mesh);
    return mesh;
  }

  public createGridHelper(size: number, divisions: number): THREE.GridHelper {
    const grid = new THREE.GridHelper(size, divisions, 0x444444, 0x888888);
    this.scene.add(grid);
    return grid;
  }

  public createExplosion(position: THREE.Vector3, size: number = 1): void {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 20 * size,
        (Math.random() - 0.5) * 20 * size + 10 * size,
        (Math.random() - 0.5) * 20 * size
      ));
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 0.5 * size,
      transparent: true,
      opacity: 1
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    const explosionId = `explosion_${Date.now()}_${Math.random()}`;
    this.particles.set(explosionId, particles);

    // Animate explosion
    let frame = 0;
    const animateExplosion = () => {
      frame++;
      const positions = geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += velocities[i].x * 0.016;
        positions[i * 3 + 1] += velocities[i].y * 0.016;
        positions[i * 3 + 2] += velocities[i].z * 0.016;
        velocities[i].y -= 9.8 * 0.016; // Gravity
      }
      
      geometry.attributes.position.needsUpdate = true;
      material.opacity = 1 - (frame / 60);

      if (frame < 60) {
        requestAnimationFrame(animateExplosion);
      } else {
        this.scene.remove(particles);
        this.particles.delete(explosionId);
        geometry.dispose();
        material.dispose();
      }
    };
    
    animateExplosion();
  }

  public createMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3): void {
    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffff00,
      transparent: true,
      opacity: 0.8
    });
    const flash = new THREE.Mesh(geometry, material);
    flash.position.copy(position).add(direction.multiplyScalar(0.5));
    this.scene.add(flash);

    // Animate flash
    let frame = 0;
    const animateFlash = () => {
      frame++;
      flash.scale.multiplyScalar(1.1);
      material.opacity = 0.8 * (1 - frame / 10);
      
      if (frame < 10) {
        requestAnimationFrame(animateFlash);
      } else {
        this.scene.remove(flash);
        geometry.dispose();
        material.dispose();
      }
    };
    
    animateFlash();
  }

  public getMesh(id: string): THREE.Object3D | undefined {
    return this.meshes.get(id);
  }

  public updateMeshPosition(id: string, position: { x: number; y: number; z: number }): void {
    const mesh = this.meshes.get(id);
    if (mesh) {
      mesh.position.set(position.x, position.y, position.z);
    }
  }

  public updateMeshRotation(id: string, rotation: { x: number; y: number; z: number; w?: number }): void {
    const mesh = this.meshes.get(id);
    if (mesh) {
      if (rotation.w !== undefined) {
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      } else {
        mesh.rotation.set(rotation.x, rotation.y, rotation.z);
      }
    }
  }

  public removeMesh(id: string): void {
    const mesh = this.meshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.meshes.delete(id);
      
      // Dispose geometry and materials
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }

  public render(callback?: (deltaTime: number) => void): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      const deltaTime = this.clock.getDelta();
      
      if (callback) {
        callback(deltaTime);
      }
      
      this.renderer.render(this.scene, this.camera);
    };
    
    animate();
  }

  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.resizeHandler);
    
    // Clean up all meshes
    this.meshes.forEach((mesh, id) => {
      this.removeMesh(id);
    });
    
    // Clean up lights
    this.lights.forEach((light) => {
      this.scene.remove(light);
    });
    this.lights.clear();
    
    // Clean up particles
    this.particles.forEach((particles) => {
      this.scene.remove(particles);
    });
    this.particles.clear();
    
    // Dispose renderer
    this.renderer.dispose();
    
    // Remove canvas from DOM
    const canvas = this.renderer.domElement;
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
  }
}
