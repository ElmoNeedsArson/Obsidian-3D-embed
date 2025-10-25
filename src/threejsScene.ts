import { Notice, getLinkpath } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import ThreeJSPlugin from './main';

import { gui2 } from './gui'
import { applyCameraSettings } from './applyConfig'
import { loadModels } from './loadModelType'
import { loadLights } from './loadLightType'

export async function initializeThreeJsScene(plugin: ThreeJSPlugin, el: HTMLElement, config: any, setting_width: number, setting_width_percentage: number, setting_height: number, setting_alignment: string, ctx: any, renderer: THREE.WebGLRenderer, grid: boolean, scissor: boolean) {

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
            viewport?: { left: number; bottom: number; width: number; height: number };
        }

        let height_gl: number;
        if (config.gridSettings) {
            if (config.gridSettings.rowHeight) {
                height_gl = config.gridSettings.rowHeight;
            } else {
                height_gl = this.settings.rowHeight;
            }
        } else {
            height_gl = this.settings.rowHeight;
        }

        const views: SceneView[] = [];

        let axesHelper: THREE.AxesHelper | null = null;
        let gridHelper: THREE.GridHelper | null = null;

        // --- Create each scene ---
        for (let i = 0; i < numScenes; i++) {
            const [cellName, cellData] = cells[i];
            const scene = new THREE.Scene();

            // Scene background
            if (cellData.scene?.backgroundColor === "transparent") {
                scene.background = null;
            } else {
                const bg = cellData.scene?.backgroundColor || plugin.settings.standardColor;
                scene.background = new THREE.Color(`#${bg.replace(/#/g, "")}`);
            }

            axesHelper = new THREE.AxesHelper(cellData.scene.length);
            gridHelper = new THREE.GridHelper(cellData.scene.gridSize, cellData.scene.gridSize);

            if (cellData.scene.showAxisHelper && axesHelper) {
                scene.add(axesHelper);
            }
            if (cellData.scene.showGridHelper && gridHelper) {
                scene.add(gridHelper);
            }

            if (cellData.scene?.showGuiOverlay == true) {
                new Notice(`GUI cannot be shown for grid cells\nOne of your grid cells has the scene -> showGuiOverlay set to true`, 8000);
            }

            // Camera setup
            const cellWidth = setting_width;
            const cellHeight = setting_height;
            const camera = setCameraMode(!!cellData.camera?.orthographic, cellWidth, cellHeight);

            scene.add(camera);

            // Lighting setup
            const lightsArray: { name: string; obj: THREE.Light }[] = [];
            if (Array.isArray(cellData.lights)) {
                for (const l of cellData.lights) {
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

            // Model loading
            const modelArray: THREE.Object3D[] = [];
            if (Array.isArray(cellData.models)) {
                for (const model of cellData.models) {
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

                    try {
                        const ext = model.name.slice(-3).toLowerCase();
                        const loaded = await loadModels(plugin, scene, pathToModel, ext, model, cellData.stl);
                        modelArray.push(loaded);
                    } catch (err) {
                        console.error(err);
                    }
                }
            }

            // Group models & lights
            const parentGroup = new THREE.Group();
            modelArray.forEach((m) => parentGroup.add(m));
            lightsArray.forEach((l) => {
                if (l && l.name !== "attachToCam") scene.add(l.obj);
            });
            scene.add(parentGroup);

            // Orbit controls
            const orbit = new OrbitControls(camera, renderer.domElement);
            orbit.enableDamping = true;
            orbit.enabled = false;
            applyCameraSettings(camera, cellData, orbit);

            views.push({ name: cellName, scene, camera, controls: orbit, group: parentGroup });
        }

        // --- Interaction routing (mouse events to active controls) ---
        let activeControls: OrbitControls | null = null;

        renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
            const rect = renderer.domElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;                // <- use top, not bottom

            const cellW = rect.width / columns;
            const cellH = rect.height / rows;
            const col = Math.floor(x / cellW);
            const row = Math.floor(y / cellH);
            const index = row * columns + col;

            // disable previous if pointer is outside valid cell
            if (index < 0 || index >= views.length || col < 0 || col >= columns || row < 0 || row >= rows) {
                if (activeControls) {
                    activeControls.enabled = false;
                    activeControls = null;
                }
                return;
            }

            // if the active control is unchanged, nothing to do
            if (activeControls === views[index].controls) return;

            // switch enabled control
            if (activeControls) activeControls.enabled = false;
            activeControls = views[index].controls;
            activeControls.enabled = true;
        });

        (["pointerdown", "pointerup", "pointermove", "wheel"] as const).forEach((evName) => {
            renderer.domElement.addEventListener(evName, (e: PointerEvent | WheelEvent) => {
                if (!activeControls) {
                    // If no active control, prevent the default handling by the disabled controls
                    // (OrbitControls check .enabled before acting, so this is just a guard)
                    return;
                }
                // Let the active controls update themselves
                // (they already listen to DOM events, but we keep explicit update/dispatch to ensure smoothness)
                activeControls.update();
                activeControls.dispatchEvent({ type: "change" });
            }, { passive: false });
        });

        function updateViewLayout() {
            const container = findContainerElement(el);
            if (!container) return;

            const containerWidth = container.clientWidth
            const rect = renderer.domElement.getBoundingClientRect();
            if (containerWidth <= 0 || height_gl <= 0) {
                console.warn("⚠️ RendererOpt2 not ready yet, skipping layout", rect);
                return;
            }
            const cellW = containerWidth / columns
            const cellH = height_gl;

            //const gapPx = 10; // 2 pixels gap between cells
            const gapX = config.gridSettings?.gapX || plugin.settings.gapX || 10
            const gapY = config.gridSettings?.gapY || plugin.settings.gapY || 10

            for (let i = 0; i < views.length; i++) {
                const v = views[i];
                const col = i % columns;
                const row = Math.floor(i / columns);

                v.controls.update();

                let left = col * cellW;
                //let bottom = rect.height - (row + 1) * cellH;
                let bottom = (cellH * rows - (row + 1) * cellH);
                let width = cellW;
                let height = cellH - gapY/2;

                // Apply horizontal gap only between cells (not on edges)
                if (col > 0) {
                    left += gapX / 2;
                    width -= gapX / 2;
                }
                if (col < columns - 1) {
                    width -= gapX / 2;
                }

                // Apply vertical gap only between cells (not on edges)
                if (row < rows - 1) {
                    bottom += gapY / 2
                    //height -= gapY / 2;
                }
                if (row >= rows - 1){
                    //height -= gapY/2
                } 

                v.viewport = { left, bottom, width, height };

                if (v.camera instanceof THREE.PerspectiveCamera) {
                    v.camera.aspect = width / height;
                    //v.camera.updateProjectionMatrix();
                } else if (v.camera instanceof THREE.OrthographicCamera) {
                    const aspect = width / height;
                    const frustumHeight = v.camera.top - v.camera.bottom;
                    const frustumWidth = frustumHeight * aspect;
                    v.camera.left = -frustumWidth / 2;
                    v.camera.right = frustumWidth / 2;
                    //v.camera.updateProjectionMatrix();
                }

                v.camera.updateProjectionMatrix();

                adjustControlSpeed(v)



                //renderer.render(v.scene, v.camera);
            }
        }

        function adjustControlSpeed(v: SceneView) {
            if (!v.viewport) return;
            const fullW = renderer.domElement.clientWidth;
            const fullH = renderer.domElement.clientHeight;
            const scale = Math.max(fullW / v.viewport.width, fullH / v.viewport.height);

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
                //console.log(cellData.scene.autoRotation)

                // Optional model rotation
                if (cellData.scene?.autoRotation) {
                    const [rx, ry, rz] = cellData.scene.autoRotation;
                    v.group.rotation.x += rx;
                    v.group.rotation.y += ry;
                    v.group.rotation.z += rz;
                }

                v.controls.update();

                if (!v.viewport) continue; // skip views not yet sized
                const { left, bottom, width, height } = v.viewport;

                renderer.setViewport(left, bottom, width, height);
                renderer.setScissor(left, bottom, width, height);

                renderer.render(v.scene, v.camera);
            }
        };
        animate();

        // --- Resize handling ---
        const onResize = (): void => {
            // renderer.setSize(el.clientWidth, el.clientHeight);
            updateViewLayout();
            for (const v of views) {
                if (!v.viewport) continue;
                if (v.camera instanceof THREE.PerspectiveCamera) {
                    v.camera.aspect = v.viewport.width / v.viewport.height;
                    v.camera.updateProjectionMatrix();
                } else if (v.camera instanceof THREE.OrthographicCamera) {
                    // Adjust orthographic camera frustum to match aspect ratio
                    const aspect = v.viewport.width / v.viewport.height;
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
            renderer.setSize(newWidth, height_gl * rows);
            el.style.width = `${newWidth}px`;
            el.style.height = `${height_gl * rows}px`;
        };

        const resizeObserver = new ResizeObserver(onResize);
        //cases: triggers upon note resize, pane resize, but not in reading mode 
        const container = findContainerElement(el);
        if (container) resizeObserver.observe(container);

        // Clean up on plugin unload
        plugin.register(() => {
            resizeObserver.disconnect(); // Stop observing
            renderer.dispose();
            for (const v of views) {
                try { v.controls.dispose(); } catch (e) { /* ignore */ }
            }
        });
    } else {

        const scene = new THREE.Scene();

        let axesHelper: THREE.AxesHelper | null = null;
        let gridHelper: THREE.GridHelper | null = null;

        //If the config specifies scene settings, adress them here
        if (config.scene) {
            if (config.scene.backgroundColor == "transparent") {
                scene.background = null;
            } else {
                scene.background = new THREE.Color(`#${config.scene.backgroundColor || plugin.settings.standardColor.replace(/#/g, "")}`);
            }
            //scene.background = null;
            axesHelper = new THREE.AxesHelper(config.scene.length);
            gridHelper = new THREE.GridHelper(config.scene.gridSize, config.scene.gridSize);

            if (config.scene.showAxisHelper && axesHelper) {
                scene.add(axesHelper);
            }
            if (config.scene.showGridHelper && gridHelper) {
                scene.add(gridHelper);
            }
        } else {
            scene.background = new THREE.Color(`#${plugin.settings.standardColor.replace(/#/g, "")}`);
        }

        let width = setting_width;
        let height;
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

            // if (config.renderBlock.width) {
            //     width = config.renderBlock.width;
            // } else {
            //     width = setting_width;
            // }

            if (config.renderBlock.height) {
                height = config.renderBlock.height;
            } else {
                height = setting_height;
            }
        } else {
            alignment = setting_alignment;
            widthPercentage = setting_width_percentage;
            height = setting_height;
        }

        let camera = setCameraMode(config.camera.orthographic, width, height);

        renderer.setSize(width, height);

        //If the config contains lighting settings, adress them here
        let lightsArray = []
        if (config.lights) {
            let lights = config.lights
            for (let i = 0; i < lights.length; i++) {
                let light = loadLights(plugin, scene, lights[i].type, lights[i].show, lights[i].color, lights[i].pos, lights[i].strength, camera, lights[i])
                lightsArray.push({ name: lights[i].type, obj: light })
            }
        }

        scene.add(camera)

        const orbit = new OrbitControls(camera, renderer.domElement);

        applyCameraSettings(camera, config, orbit);

        let modelArray = []
        // For each model, add it to the scene with the neccesary information
        if (config.models) {
            let models = config.models
            for (let i = 0; i < models.length; i++) {
                const pathToModel = getModelPath(models[i].name);

                if (!pathToModel) {
                    new Notice("Model path for " + models[i].name + " not found", 10000);
                    return;
                }

                function getModelPath(name: string): string | null {
                    const path = this.app.metadataCache.getFirstLinkpathDest(getLinkpath(name), name);
                    return path ? this.app.vault.getResourcePath(path) : null;
                }

                const modelExtensionType = models[i].name.slice(-3).toLowerCase();

                try {
                    let model = await loadModels(plugin, scene, pathToModel, modelExtensionType, models[i], config.stl);
                    modelArray.push(model);
                } catch (error) {
                    console.error(error);
                }
            }
        }

        if (config.scene && config.scene.showGuiOverlay) {
            axesHelper ??= new THREE.AxesHelper(10);
            gridHelper ??= new THREE.GridHelper(10, 10);
            gui2(plugin, el, scene, axesHelper, gridHelper, orbit, camera, renderer, ctx, modelArray, config, lightsArray)
        }

        const onResize = () => {
            const container = findContainerElement(el);
            if (!container) return;

            const containerWidth = container.clientWidth;
            const newWidth = containerWidth * widthPercentage;
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
            camera.aspect = newWidth / height;
            camera.updateProjectionMatrix();
        };

        const resizeObserver = new ResizeObserver(onResize);
        //cases: triggers upon note resize, pane resize, but not in reading mode 
        const container = findContainerElement(el);
        if (container) resizeObserver.observe(container);

        // Clean up on plugin unload
        plugin.register(() => {
            resizeObserver.disconnect(); // Stop observing
            renderer.dispose();
        });

        //Create a parent group with all models and add it to the scene
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

        // Animation loop
        const animate = () => {
            if (renderer.getContext().isContextLost()) {
                return
            }
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

            //Makes sure the attachToCam light rotates properly
            for (let i = 0; i < lightsArray.length; i++) {
                if (lightsArray[i].name === 'attachToCam') {
                    const light = lightsArray[i].obj;

                    if (light instanceof THREE.DirectionalLight) {
                        light.target.position.copy(camera.position);
                        light.target.position.y = 0;
                        light.target.updateMatrixWorld();
                    }
                }
            }
        };
        animate();
    }
}

function setCameraMode(orthographic: boolean, width: number, height: number) {
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
    return camera;
}

function findContainerElement(el: HTMLElement): HTMLElement | null {
    // For embedded or preview notes, look for these parent classes:
    return el.closest('.cm-content, markdown-preview-section, .markdown-preview-section');
}