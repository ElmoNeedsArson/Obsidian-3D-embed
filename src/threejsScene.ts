import { Notice, getLinkpath, MarkdownPostProcessorContext } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import ThreeJSPlugin from './main';

import { gui2 } from './gui'
import { applyCameraSettings } from './applyConfig'
import { loadModels } from './loadModelType'
import { loadLights } from './loadLightType'
import { SceneData, GridConfig, GridSettings } from './types';

export async function initializeThreeJsScene(plugin: ThreeJSPlugin, el: HTMLElement, config: SceneData | GridConfig, setting_width: number, setting_width_percentage: number, setting_height: number | string, setting_alignment: string, ctx: MarkdownPostProcessorContext | null, renderer: THREE.WebGLRenderer, grid: boolean, scissor: boolean, jic_gridSettings?: GridSettings) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (scissor) {
        renderer.setScissorTest(true);
        const gridConfig = config as GridConfig;

        // Determine grid dimensions
        const cells = Object.entries(gridConfig)
            .filter((entry): entry is [string, SceneData] => entry[0].startsWith("cell") && entry[1] !== undefined);
        const numScenes: number = cells.length;
        const columns: number = gridConfig.gridSettings?.columns || plugin.settings.columnsAmount || 3;
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
        if (gridConfig.gridSettings) {
            if (gridConfig.gridSettings.rowHeight) {
                height_gl = gridConfig.gridSettings.rowHeight;
            } else {
                height_gl = plugin.settings.rowHeight;
            }
        } else {
            height_gl = plugin.settings.rowHeight;
        }
        let cellHeight: number;

        const views: SceneView[] = [];

        // --- Create each scene ---
        for (let i = 0; i < numScenes; i++) {
            const [cellName, cellData] = cells[i];

            let { scene } = setupBaseScene(cellData, plugin)

            const camera = setCameraMode(!!cellData.camera?.orthographic, setting_width, setting_height as number, scene, plugin);
            setupHDRIBackground(cellData, plugin, scene, renderer)
            const lightsArray = setupLightsArray(cellData, plugin, scene, camera);
            const modelArray = await setupModelsArray(cellData, plugin, scene);
            setupGroundShadows(cellData, scene, plugin)
            const orbit = setupOrbitControls(cellData, camera, renderer, plugin, scissor);
            applyCameraSettings(camera, cellData, orbit, plugin);
            const parentGroup = setupParentGroup(scene, modelArray, lightsArray);

            if (cellData.scene?.showGuiOverlay == true) {
                new Notice(`GUI cannot be shown for 3d grid cells\none of your grid cells has the scene -> showguioverlay set to true`, 8000);
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

        void waitForCanvasReady(renderer).then(() => {
            updateViewLayout();
            setupInteractionHandlers();
        });

        let gapX = gridConfig.gridSettings?.gapX || plugin.settings.gapX || 10
        let gapY = gridConfig.gridSettings?.gapY || plugin.settings.gapY || 10

        function updateViewLayout() {
            const container = findContainerElement(el);
            if (!container) return;

            const containerWidth = container.clientWidth
            const rect = renderer.domElement.getBoundingClientRect();
            if (containerWidth <= 0 || Number(height_gl) <= 0) {
                console.warn("Renderer not ready yet, skipping layout", rect);
                return;
            }

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
            window.requestAnimationFrame(animate);

            for (let i = 0; i < views.length; i++) {
                const v = views[i];
                const [, cellData] = cells[i];

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

        const onResize = (): void => {
            updateViewLayout();
            setupInteractionHandlers();
            for (const v of views) {
                if (!v.viewport) continue;
                if (v.camera instanceof THREE.PerspectiveCamera) {
                    v.camera.aspect = v.viewport.cellWidth / v.viewport.cellHeight;
                    v.camera.updateProjectionMatrix();
                } else if (v.camera instanceof THREE.OrthographicCamera) {
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
        const sceneData = config as SceneData;
        let { scene, axesHelper, gridHelper } = setupBaseScene(sceneData, plugin)

        let width = setting_width;
        let height: number;
        let widthPercentage: number;
        let alignment: string;

        if (sceneData.renderBlock) {
            if (sceneData.renderBlock.alignment) {
                alignment = sceneData.renderBlock.alignment;
            } else {
                alignment = setting_alignment;
            }

            if (sceneData.renderBlock.widthPercentage) {
                widthPercentage = sceneData.renderBlock.widthPercentage / 100;
            } else {
                widthPercentage = setting_width_percentage;
            };

            if (sceneData.renderBlock.height) {
                height = sceneData.renderBlock.height;
            } else {
                height = setting_height as number;
            }
        } else {
            alignment = setting_alignment;
            widthPercentage = setting_width_percentage;
            if (typeof setting_height === "string" && setting_height === "auto") {
                height = width;
            } else if (typeof setting_height === "string" && setting_height.startsWith("fill")) {
                const fillPct = setting_height.includes(":") ? parseFloat(setting_height.split(":")[1]) / 100 : 1;
                const cont = findContainerElement(el);
                height = cont ? cont.clientHeight * fillPct : width;
            } else {
                height = setting_height as number;
            }
        }

        let camera = setCameraMode(sceneData.camera?.orthographic, width, height, scene, plugin);
        renderer.setSize(width, height);
        const lightsArray = setupLightsArray(sceneData, plugin, scene, camera);
        setupHDRIBackground(sceneData, plugin, scene, renderer)
        const orbit = setupOrbitControls(sceneData, camera, renderer, plugin, scissor);
        applyCameraSettings(camera, sceneData, orbit, plugin);
        const modelArray = await setupModelsArray(sceneData, plugin, scene);
        setupGroundShadows(sceneData, scene, plugin)
        const parentGroup = setupParentGroup(scene, modelArray, lightsArray);

        if (sceneData.scene && sceneData.scene.showGuiOverlay && !grid && ctx) {
            axesHelper ??= new THREE.AxesHelper(10);
            gridHelper ??= new THREE.GridHelper(10, 10);
            gui2(plugin, el, scene, axesHelper, gridHelper, orbit, camera, renderer, ctx, modelArray, sceneData)
        } else if (grid && sceneData.scene?.showGuiOverlay) {
            new Notice(`GUI cannot be shown for 3d grid cells\none of your grid cells has the scene -> showguioverlay set to true`, 8000);
        }

        let lastContainerWidth = -1;
        let lastContainerHeight = -1;
        let resizeRafId: number | null = null;
        const onResize = () => {
            if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
            resizeRafId = window.requestAnimationFrame(() => {
                resizeRafId = null;
                const container = findContainerElement(el);
                if (!container) return;

                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;

                // Guard against ResizeObserver feedback loops (e.g. scrollbar appearing/disappearing)
                if (containerWidth === lastContainerWidth && containerHeight === lastContainerHeight) return;
                lastContainerWidth = containerWidth;
                lastContainerHeight = containerHeight;

                let newWidth;
                if (jic_gridSettings) {
                    newWidth = (containerWidth - (((jic_gridSettings.columns ?? 1) - 1) * (jic_gridSettings.gapX ?? 0))) * widthPercentage
                } else {
                    newWidth = containerWidth * widthPercentage;
                }
                if (typeof setting_height === "string" && setting_height === "auto") {
                    height = newWidth;
                } else if (typeof setting_height === "string" && setting_height.startsWith("fill")) {
                    const fillPct = setting_height.includes(":") ? parseFloat(setting_height.split(":")[1]) / 100 : 1;
                    height = containerHeight * fillPct;
                }
                const align = alignment || "center";

                // Only apply embed wrapper styling to codeblock parents, not to .view-content
                const parent = el.parentElement;
                if (parent && !grid && !parent.classList.contains('view-content')) {
                    parent.setCssProps({ '--3d-align': widthPercentage === 1 ? 'center' : align });
                    parent.addClass("ThreeDEmbed_embed_wrapper");
                }

                el.style.width = `${newWidth}px`;

                renderer.setSize(newWidth, height);
                if (camera instanceof THREE.PerspectiveCamera) {
                    camera.aspect = newWidth / height;
                }
                camera.updateProjectionMatrix();
            });
        };

        const resizeObserver = new ResizeObserver(onResize);
        const container = findContainerElement(el);
        if (container) resizeObserver.observe(container);

        const animate = () => {
            if (renderer.getContext().isContextLost()) { return }
            window.requestAnimationFrame(animate);

            if (scene && sceneData.scene && sceneData.scene.autoRotation != undefined) {
                parentGroup.rotation.x += sceneData.scene.autoRotation[0];
                parentGroup.rotation.y += sceneData.scene.autoRotation[1];
                parentGroup.rotation.z += sceneData.scene.autoRotation[2];
            } else if (plugin.settings.autoRotate && sceneData?.scene?.autoRotation == undefined) {
                parentGroup.rotation.y -= 0.005;
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

function setupPluginUnload(plugin: ThreeJSPlugin, resizeObserver: ResizeObserver, renderer: THREE.WebGLRenderer, views?: Array<{ controls: OrbitControls }>) {
    plugin.register(() => {
        resizeObserver.disconnect();
        renderer.dispose();
        if (views) { //if in scissor mode
            for (const v of views) {
                try { v.controls.dispose(); } catch { /* ignore */ }
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

function setupBaseScene(data: SceneData, plugin: ThreeJSPlugin) {
    const scene = new THREE.Scene();
    let axesHelper: THREE.AxesHelper | null = null;
    let gridHelper: THREE.GridHelper | null = null;

    if (data.scene?.backgroundColor === "transparent") {
        scene.background = null;
    } else if (plugin.settings.colorChoice == "transparent" && !data.scene?.backgroundColor) {
        scene.background = null;
    } else {
        const bg = data.scene?.backgroundColor || plugin.settings.standardColor;
        scene.background = new THREE.Color(`#${bg.replace(/#/g, "")}`);
    }

    axesHelper = new THREE.AxesHelper(data.scene?.length || 5);
    gridHelper = new THREE.GridHelper(data.scene?.gridSize || 10, data.scene?.gridSize || 10); //TODO: hardcoded

    if (data.scene?.showAxisHelper && axesHelper) {
        scene.add(axesHelper);
    }
    if (data.scene?.showGridHelper && gridHelper) {
        scene.add(gridHelper);
    }

    return { scene, axesHelper, gridHelper };
}

async function setupModelsArray(data: SceneData, plugin: ThreeJSPlugin, scene: THREE.Scene) {
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
                    console.warn(`Material path for ${mtlname} not found`, 8000);
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

function setupLightsArray(data: SceneData, plugin: ThreeJSPlugin, scene: THREE.Scene, camera: THREE.Camera) {
    const lightsArray: { name: string; obj: THREE.Light }[] = [];
    if (Array.isArray(data.lights)) {
        for (const l of data.lights) {
            const light = loadLights(
                plugin,
                scene,
                l.type,
                l.show ?? false,
                l.color ?? "",
                l.pos,
                l.strength ?? 1,
                camera,
                l
            );
            if (light) {
                lightsArray.push({ name: l.type, obj: light });
            }
        }
    } else {
        //adding lights from global settings
        for (const l of plugin.settings.lightSettings) {
            const light = loadLights(
                plugin,
                scene,
                l.dropdownValue,
                false,
                l.color,
                l.position,
                l.intensity,
                camera,
                l
            );
            if (light) {
                lightsArray.push({ name: l.dropdownValue, obj: light });
            }
        }
    }
    return lightsArray;
}

function setupGroundShadows(data: SceneData, scene: THREE.Scene, plugin: ThreeJSPlugin) {
    if (data.scene?.showGroundShadows) {
        const shadowMat = new THREE.ShadowMaterial({ opacity: 0.5 });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), shadowMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -5;
        ground.receiveShadow = true;
        scene.add(ground);
    } else if (plugin.settings.showGroundShadows && data.scene?.showGroundShadows == undefined) {
        const shadowMat = new THREE.ShadowMaterial({ opacity: 0.5 });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), shadowMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -5;
        ground.receiveShadow = true;
        scene.add(ground);
    }
}

function setupHDRIBackground(data: SceneData, plugin: ThreeJSPlugin, scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    if (data.scene?.hdriBackground?.texturePath) {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        const hdriLoader = new RGBELoader()
        const pth = plugin.getModelPath(data.scene.hdriBackground.texturePath)
        let envMap;
        if (pth) {
            hdriLoader.load(pth, function (texture) {
                envMap = pmremGenerator.fromEquirectangular(texture).texture;
                texture.dispose();
                scene.environment = envMap

                if (data.scene?.hdriBackground?.sceneBackground) {
                    scene.background = envMap;
                }

                if (data.scene?.hdriBackground?.baseGeometry) {
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

function setupOrbitControls(data: SceneData, camera: THREE.Camera, renderer: THREE.WebGLRenderer, plugin: ThreeJSPlugin, scissor: boolean) {
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = data.scene?.orbitControlDamping ?? plugin.settings.dampedOrbit ?? true
    if (scissor) orbit.enabled = false;

    return orbit
}

function setCameraMode(orthographic: boolean | undefined, width: number, height: number, scene: THREE.Scene, plugin: ThreeJSPlugin): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    if (orthographic == undefined && plugin.settings.cameraType == "Orthographic") {
        const aspect = width / height;
        const distance = 10; // distance at which you want the orthographic camera to mimic the perspective camera

        // Perspective camera's FOV in radians
        const fov = THREE.MathUtils.degToRad(75);

        // Frustum height at the given distance
        const frustumHeight = 2 * distance * Math.tan(fov / 2);
        const frustumWidth = frustumHeight * aspect;
        camera = new THREE.OrthographicCamera(-frustumWidth / 2, frustumWidth / 2, frustumHeight / 2, -frustumHeight / 2, 1, 1000);
    } else if (!orthographic) {
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
    // .callout-content is checked first so callout-embedded models use the callout's width
    // For embedded or preview notes, look for these parent classes:
    // Also handles .view-content for FileView-based tabs (e.g. Direct3DView)
    return el.closest('.callout-content, .cm-content, markdown-preview-section, .markdown-preview-section, .view-content');
}

function waitForCanvasReady(renderer: THREE.WebGLRenderer): Promise<void> {
    return new Promise((resolve) => {
        const check = () => {
            const rect = renderer.domElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                resolve();
            } else {
                window.requestAnimationFrame(check);
            }
        };
        check();
    });
}
