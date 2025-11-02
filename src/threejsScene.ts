import { Notice, getLinkpath } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import ThreeJSPlugin from './main';

import { gui2 } from './gui'
import { applyCameraSettings } from './applyConfig'
import { loadModels } from './loadModelType'
import { loadLights } from './loadLightType'

export async function initializeThreeJsScene(plugin: ThreeJSPlugin, el: HTMLElement, config: any, setting_width: number, setting_width_percentage: number, setting_height: number, setting_alignment: string, ctx: any, renderer: THREE.WebGLRenderer, grid: boolean, scissor: boolean, jic_gridSettings?: any) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (scissor) {
        renderer.setScissorTest(true);

        // Determine grid dimensions
        const cells = Object.entries(config).filter(([key]) => key.startsWith("cell")) as [string, any][];
        const numScenes: number = cells.length;
        const columns: number = config.gridSettings?.columns || plugin.settings.columnsAmount || 3;
        const rows: number = Math.ceil(numScenes / columns);

        interface SceneView {
            name: string;
            scene: THREE.Scene;
            camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
            controls: OrbitControls;
            group: THREE.Group;
            viewport?: { left: number; bottom: number; cellWidth: number; cellHeight: number };
        }

        let height_gl: number | string;
        if (config.gridSettings) {
            if (config.gridSettings.rowHeight) {
                height_gl = config.gridSettings.rowHeight;
            } else {
                height_gl = this.settings.rowHeight;
            }
        } else {
            height_gl = this.settings.rowHeight;
        }
        let cellHeight: number;

        const views: SceneView[] = [];

        // --- Create each scene ---
        for (let i = 0; i < numScenes; i++) {
            const [cellName, cellData] = cells[i];

            let { scene, axesHelper, gridHelper } = setupBaseScene(cellData, plugin)

            // Camera setup
            const cellWidth = setting_width;
            const cellHeight = setting_height;

            const camera = setCameraMode(!!cellData.camera?.orthographic, cellWidth, cellHeight, scene);
            setupHDRIBackground(cellData, plugin, scene, renderer)
            const lightsArray = setupLightsArray(cellData, plugin, scene, camera);
            const modelArray = await setupModelsArray(cellData, plugin, scene);
            setupGroundShadows(cellData, scene)
            const orbit = setupOrbitControls(cellData, camera, renderer, plugin, scissor);
            applyCameraSettings(camera, cellData, orbit);
            const parentGroup = setupParentGroup(scene, modelArray, lightsArray);

            if (cellData.scene?.showGuiOverlay == true) {
                new Notice(`GUI cannot be shown for 3D grid cells\nOne of your grid cells has the scene -> showGuiOverlay set to true`, 8000);
            }

            views.push({ name: cellName, scene, camera, controls: orbit, group: parentGroup });
        }

        function setupInteractionHandlers() {
            let activeControls: OrbitControls | null = null;

            renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
                const rect = renderer.domElement.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const yTop = event.clientY - rect.top;
                const yBottom = rect.height - yTop;

                let foundControls: OrbitControls | null = null;
                for (const v of views) {
                    const vp = v.viewport;
                    if (!vp) continue;
                    const { left, bottom, cellWidth, cellHeight } = vp;
                    if (
                        x >= left &&
                        x <= left + cellWidth &&
                        yBottom >= bottom &&
                        yBottom <= bottom + cellHeight
                    ) {
                        foundControls = v.controls;
                        break;
                    }
                }

                if (foundControls === activeControls) return;

                if (activeControls) activeControls.enabled = false;
                activeControls = foundControls;
                if (activeControls) activeControls.enabled = true;
            });

            (["pointerdown", "pointerup", "pointermove", "wheel"] as const).forEach((evName) => {
                renderer.domElement.addEventListener(
                    evName,
                    (e: PointerEvent | WheelEvent) => {
                        if (!activeControls) return;
                        activeControls.update();
                        activeControls.dispatchEvent({ type: "change" });
                    },
                    { passive: false }
                );
            });
        }

        waitForCanvasReady(renderer).then(() => {
            updateViewLayout();
            setupInteractionHandlers();
        });

        let gapX = config.gridSettings?.gapX || plugin.settings.gapX || 10
        let gapY = config.gridSettings?.gapY || plugin.settings.gapY || 10

        function updateViewLayout() {
            const container = findContainerElement(el);
            if (!container) return;

            const containerWidth = container.clientWidth
            const rect = renderer.domElement.getBoundingClientRect();
            if (containerWidth <= 0 || Number(height_gl) <= 0) {
                console.warn("Renderer not ready yet, skipping layout", rect);
                return;
            }

            // Update if needed, probably never triggers
            gapX = config.gridSettings?.gapX || plugin.settings.gapX || 10
            gapY = config.gridSettings?.gapY || plugin.settings.gapY || 10

            //cell widths resize based on total width, for height they remain static
            let newTotalWidth = containerWidth - (gapX * (columns - 1))
            let cellWidth = newTotalWidth / columns

            if (typeof height_gl === "string") {
                cellHeight = cellWidth
                height_gl = cellHeight
            } else {
                cellHeight = height_gl
            }


            for (let i = 0; i < views.length; i++) {
                const v = views[i];
                const col = i % columns;
                const row = Math.floor(i / columns);

                v.controls.update();

                let bottom = ((rows - 1) - row) * (cellHeight + gapY)
                let left = col * (cellWidth + gapX)

                v.viewport = { left, bottom, cellWidth, cellHeight };

                if (v.camera instanceof THREE.PerspectiveCamera) {
                    v.camera.aspect = cellWidth / cellHeight;
                } else if (v.camera instanceof THREE.OrthographicCamera) {
                    const aspect = cellWidth / cellHeight;
                    const frustumHeight = v.camera.top - v.camera.bottom;
                    const frustumWidth = frustumHeight * aspect;
                    v.camera.left = -frustumWidth / 2;
                    v.camera.right = frustumWidth / 2;
                }

                v.camera.updateProjectionMatrix();
                adjustControlSpeed(v)
            }
        }

        function adjustControlSpeed(v: SceneView) {
            if (!v.viewport) return;
            const fullW = renderer.domElement.clientWidth;
            const fullH = renderer.domElement.clientHeight;
            const scale = Math.max(fullW / v.viewport.cellWidth, fullH / v.viewport.cellHeight);

            v.controls.rotateSpeed = 1.0 * scale;
            v.controls.panSpeed = 1.0 * scale;
            v.controls.zoomSpeed = 1.0 * Math.sqrt(scale);
        }

        const animate = (): void => {
            if (renderer.getContext().isContextLost()) return;
            requestAnimationFrame(animate);

            for (let i = 0; i < views.length; i++) {
                const v = views[i];
                const [cellName, cellData] = cells[i];

                // Optional model rotation
                if (cellData.scene?.autoRotation) {
                    const [rx, ry, rz] = cellData.scene.autoRotation;
                    v.group.rotation.x += rx;
                    v.group.rotation.y += ry;
                    v.group.rotation.z += rz;
                }

                v.controls.update();

                if (!v.viewport) continue; // skip views not yet sized
                const { left, bottom, cellWidth, cellHeight } = v.viewport;

                renderer.setViewport(left, bottom, cellWidth, cellHeight);
                renderer.setScissor(left, bottom, cellWidth, cellHeight);

                renderer.render(v.scene, v.camera);
            }
        };
        animate();

        // --- Resize handling ---
        const onResize = (): void => {
            updateViewLayout();
            setupInteractionHandlers();
            for (const v of views) {
                if (!v.viewport) continue;
                if (v.camera instanceof THREE.PerspectiveCamera) {
                    v.camera.aspect = v.viewport.cellWidth / v.viewport.cellHeight;
                    v.camera.updateProjectionMatrix();
                } else if (v.camera instanceof THREE.OrthographicCamera) {
                    // Adjust orthographic camera frustum to match aspect ratio
                    const aspect = v.viewport.cellWidth / v.viewport.cellHeight;
                    const frustumHeight = v.camera.top - v.camera.bottom;
                    const frustumWidth = frustumHeight * aspect;
                    v.camera.left = -frustumWidth / 2;
                    v.camera.right = frustumWidth / 2;
                    v.camera.updateProjectionMatrix();
                }

                v.camera.updateProjectionMatrix();
            }
            const container = findContainerElement(el);
            if (!container) return;

            const containerWidth = container.clientWidth;
            const newWidth = containerWidth;
            renderer.setSize(newWidth, (Number(height_gl) * rows) + (gapY * (rows - 1)));
            el.style.width = `${newWidth}px`;
            el.style.height = `${(Number(height_gl) * rows) + (gapY * (rows - 1))}px`;
        };

        const resizeObserver = new ResizeObserver(onResize);
        const container = findContainerElement(el);
        if (container) resizeObserver.observe(container);

        setupPluginUnload(plugin, resizeObserver, renderer, views);
    } else {
        let { scene, axesHelper, gridHelper } = setupBaseScene(config, plugin)

        let width = setting_width;
        let height: number;
        let widthPercentage;
        let alignment;

        if (config.renderBlock) {
            if (config.renderBlock.alignment) {
                alignment = config.renderBlock.alignment;
            } else {
                alignment = setting_alignment;
            }

            if (config.renderBlock.widthPercentage) {
                widthPercentage = config.renderBlock.widthPercentage / 100;
            } else {
                widthPercentage = setting_width_percentage;
            };

            if (config.renderBlock.height) {
                height = config.renderBlock.height;
            } else {
                height = setting_height;
            }
        } else {
            alignment = setting_alignment;
            widthPercentage = setting_width_percentage;
            if (typeof setting_height === "string" && setting_height === "auto") {
                height = width
            } else {
                height = setting_height;
            }
        }

        let camera = setCameraMode(config.camera.orthographic, width, height, scene);
        renderer.setSize(width, height);
        const lightsArray = setupLightsArray(config, plugin, scene, camera);
        setupHDRIBackground(config, plugin, scene, renderer)
        const orbit = setupOrbitControls(config, camera, renderer, plugin, scissor);
        applyCameraSettings(camera, config, orbit);
        const modelArray = await setupModelsArray(config, plugin, scene);
        setupGroundShadows(config, scene)
        const parentGroup = setupParentGroup(scene, modelArray, lightsArray);

        if (config.scene && config.scene.showGuiOverlay && !grid) {
            axesHelper ??= new THREE.AxesHelper(10);
            gridHelper ??= new THREE.GridHelper(10, 10);
            gui2(plugin, el, scene, axesHelper, gridHelper, orbit, camera, renderer, ctx, modelArray, config)
        } else if (grid && config.scene.showGuiOverlay) {
            new Notice(`GUI cannot be shown for 3D grid cells\nOne of your grid cells has the scene -> showGuiOverlay set to true`, 8000);
        }

        const onResize = () => {
            const container = findContainerElement(el);
            if (!container) return;

            const containerWidth = container.clientWidth;
            let newWidth;
            if (jic_gridSettings) {
                newWidth = (containerWidth - ((jic_gridSettings.columns - 1) * jic_gridSettings.gapX)) * widthPercentage
            } else {
                newWidth = containerWidth * widthPercentage;
            }
            if (typeof setting_height === "string" && setting_height === "auto") {
                height = newWidth;
            }
            const align = alignment || "center";

            // Apply style directly to your block container
            const parent = el.parentElement;
            if (parent && !grid) {
                parent.style.display = "flex";
                if (widthPercentage == 1) {
                    parent.style.justifyContent = "center";
                } else {
                    parent.style.justifyContent = align;
                }
                parent.style.width = "100%";
            }

            el.style.width = `${newWidth}px`;

            renderer.setSize(newWidth, height);
            //renderer.shadowMap.enabled = true;
            camera.aspect = newWidth / height;
            camera.updateProjectionMatrix();
        };

        const resizeObserver = new ResizeObserver(onResize);
        const container = findContainerElement(el);
        if (container) resizeObserver.observe(container);

        // Animation loop
        const animate = () => {
            if (renderer.getContext().isContextLost()) { return }
            requestAnimationFrame(animate);

            if (scene && config.scene && config.scene.autoRotation != undefined) {
                parentGroup.rotation.x += config.scene.autoRotation[0];
                parentGroup.rotation.y += config.scene.autoRotation[1];
                parentGroup.rotation.z += config.scene.autoRotation[2];
            }

            orbit.update()
            if (renderer && renderer.getContext().isContextLost()) {
                console.warn('Skipping rendering due to lost context');
            } else {
                renderer.render(scene, camera);
            }

            //Makes sure the attachToCam light updates properly --- is this done for grid view?
            for (let i = 0; i < lightsArray.length; i++) {
                if (lightsArray[i].name === 'attachToCam') {
                    const light = lightsArray[i].obj;

                    if (light instanceof THREE.DirectionalLight) {
                        light.target.position.copy(camera.position);
                        light.target.updateMatrixWorld();
                    }
                }
            }
        };
        animate();

        setupPluginUnload(plugin, resizeObserver, renderer);
    }
}

function setupPluginUnload(plugin: ThreeJSPlugin, resizeObserver: ResizeObserver, renderer: THREE.WebGLRenderer, views?: any[]) {
    plugin.register(() => {
        resizeObserver.disconnect();
        renderer.dispose();
        if (views) { //if in scissor mode
            for (const v of views) {
                try { v.controls.dispose(); } catch (e) { /* ignore */ }
            }
        }
    });
}

function setupParentGroup(scene: THREE.Scene, modelArray: THREE.Object3D[], lightsArray: { name: string; obj: THREE.Light }[]) {
    const parentGroup = new THREE.Group();
    modelArray.forEach((child) => {
        parentGroup.add(child);
    });
    lightsArray.forEach((child) => {
        if (child.obj && child.name != "attachToCam") {
            parentGroup.add(child.obj);
        }
    });
    scene.add(parentGroup);
    return parentGroup;
}

function setupBaseScene(data: any, plugin: ThreeJSPlugin) {
    const scene = new THREE.Scene();
    let axesHelper: THREE.AxesHelper | null = null;
    let gridHelper: THREE.GridHelper | null = null;

    if (data.scene?.backgroundColor === "transparent") {
        scene.background = null;
    } else {
        const bg = data.scene?.backgroundColor || plugin.settings.standardColor;
        scene.background = new THREE.Color(`#${bg.replace(/#/g, "")}`);
    }

    axesHelper = new THREE.AxesHelper(data.scene.length);
    gridHelper = new THREE.GridHelper(data.scene.gridSize, data.scene.gridSize);

    if (data.scene.showAxisHelper && axesHelper) {
        scene.add(axesHelper);
    }
    if (data.scene.showGridHelper && gridHelper) {
        scene.add(gridHelper);
    }

    return { scene, axesHelper, gridHelper };
}

async function setupModelsArray(data: any, plugin: ThreeJSPlugin, scene: THREE.Scene) {
    const modelArray: THREE.Object3D[] = [];
    if (Array.isArray(data.models)) {
        for (const model of data.models) {
            const pathToModel = (() => {
                const path = plugin.app.metadataCache.getFirstLinkpathDest(
                    getLinkpath(model.name),
                    model.name
                );
                return path ? plugin.app.vault.getResourcePath(path) : null;
            })();

            if (!pathToModel) {
                new Notice(`Model path for ${model.name} not found`, 8000);
                continue;
            }

            let pathToMaterial;

            if (model.name.endsWith(".obj")) {
                let mtlname = model.name.replace(/\.obj$/, ".mtl");

                pathToMaterial = (() => {
                    const path = plugin.app.metadataCache.getFirstLinkpathDest(
                        getLinkpath(mtlname),
                        mtlname
                    );
                    return path ? plugin.app.vault.getResourcePath(path) : null;
                })();

                if (!pathToMaterial) {
                    new Notice(`Material path for ${mtlname} not found`, 8000);
                    pathToMaterial = "unknown"
                }
            } else {
                pathToMaterial = "unknown"
            }

            try {
                const ext = model.name.slice(-3).toLowerCase();
                const loaded = await loadModels(plugin, scene, pathToModel, ext, model, data.stl, pathToMaterial);
                loaded.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        (child as THREE.Mesh).castShadow = true;
                        (child as THREE.Mesh).receiveShadow = true;
                    }
                });
                modelArray.push(loaded);
            } catch (err) {
                console.error(err);
            }
        }
    }
    return modelArray;
}

function setupLightsArray(data: any, plugin: ThreeJSPlugin, scene: THREE.Scene, camera: THREE.Camera) {
    const lightsArray: { name: string; obj: THREE.Light }[] = [];
    if (Array.isArray(data.lights)) {
        for (const l of data.lights) {
            const light = loadLights(
                plugin,
                scene,
                l.type,
                l.show,
                l.color,
                l.pos,
                l.strength,
                camera,
                l
            );
            if (light) {
                lightsArray.push({ name: l.type, obj: light });
            }
        }
    }
    return lightsArray;
}

function setupGroundShadows(data: any, scene: THREE.Scene) {
    if (data.scene?.showGroundShadows) {
        const shadowMat = new THREE.ShadowMaterial({ opacity: 0.5 });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), shadowMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -5;
        ground.receiveShadow = true;
        scene.add(ground);
    }
}

function setupHDRIBackground(data: any, plugin: ThreeJSPlugin, scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    if (data.scene?.hdriBackground?.texturePath) {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        const hdriLoader = new RGBELoader()
        console.log(data.scene.hdriBackground.texturePath)
        const pth = plugin.getModelPath(data.scene.hdriBackground.texturePath)
        let envMap;
        if (pth) {
            console.log("Loading HDRI from: " + pth)
            hdriLoader.load(pth, function (texture) {
                envMap = pmremGenerator.fromEquirectangular(texture).texture;
                texture.dispose();
                scene.environment = envMap

                if (data.scene.hdriBackground.sceneBackground) {
                    scene.background = envMap;
                }

                if (data.scene.hdriBackground.baseGeometry) {
                    const geometry2 = new THREE.TorusKnotGeometry(1.5, 0.50, 220, 20);

                    const material2 = new THREE.MeshStandardMaterial({
                        color: 0xaaaaaa,
                        metalness: 1.0,
                        roughness: 0.02,
                        envMapIntensity: 1.0
                    });

                    const torus = new THREE.Mesh(geometry2, material2);
                    scene.add(torus);
                }
            });
        }

        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.8;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
}

function setupOrbitControls(data: any, camera: THREE.Camera, renderer: THREE.WebGLRenderer, plugin: ThreeJSPlugin, scissor: boolean) {
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = data.scene?.orbitControlDamping ?? plugin.settings.dampedOrbit ?? true
    if (scissor) orbit.enabled = false;

    return orbit
}

function setCameraMode(orthographic: boolean, width: number, height: number, scene: THREE.Scene) {
    let camera: any;
    if (!orthographic) {
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    } else if (orthographic) {
        const aspect = width / height;
        const distance = 10; // distance at which you want the orthographic camera to mimic the perspective camera

        // Perspective camera's FOV in radians
        const fov = THREE.MathUtils.degToRad(75);

        // Frustum height at the given distance
        const frustumHeight = 2 * distance * Math.tan(fov / 2);
        const frustumWidth = frustumHeight * aspect;
        camera = new THREE.OrthographicCamera(-frustumWidth / 2, frustumWidth / 2, frustumHeight / 2, -frustumHeight / 2, 1, 1000);
    } else {
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    }
    scene.add(camera);
    return camera;
}

function findContainerElement(el: HTMLElement): HTMLElement | null {
    // For embedded or preview notes, look for these parent classes:
    return el.closest('.cm-content, markdown-preview-section, .markdown-preview-section');
}

function waitForCanvasReady(renderer: THREE.WebGLRenderer): Promise<void> {
    return new Promise((resolve) => {
        const check = () => {
            const rect = renderer.domElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                resolve();
            } else {
                requestAnimationFrame(check);
            }
        };
        check();
    });
}