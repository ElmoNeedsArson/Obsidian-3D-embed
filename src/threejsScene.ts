import { Notice, getLinkpath } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import ThreeJSPlugin from './main';

import { gui2 } from './gui'
import { applyCameraSettings } from './applyConfig'
import { loadModels } from './loadModelType'
import { loadLights } from './loadLightType'

export async function initializeThreeJsScene(plugin: ThreeJSPlugin, el: HTMLElement, config: any, modelPath: string, name: string, width: number, ctx: any, renderer: THREE.WebGLRenderer) {
    const scene = new THREE.Scene();

    let axesHelper: THREE.AxesHelper | null = null;
    let gridHelper: THREE.GridHelper | null = null;

    //If the config specifies scene settings, adress them here
    if (config.scene) {
        scene.background = new THREE.Color(`#${config.scene.backgroundColor || plugin.settings.standardColor.replace(/#/g, "")}`);

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

    let camera = setCameraMode(config.camera.orthographic, width, plugin.settings.standardEmbedHeight);

    //const renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, plugin.settings.standardEmbedHeight);
    el.appendChild(renderer.domElement);

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
        gui2(plugin, el, scene, axesHelper, gridHelper, orbit, camera, renderer, ctx, modelArray, config)
    }

    // Resize function to update camera and renderer on container width change
    const onResize = () => {
        let newWidth = 0;
        //ensures that the browser has completed its rendering and layout process before you attempt to access ctx.el.clientWidth
        requestAnimationFrame(() => {
            newWidth = (ctx as any).el.clientWidth || 300

            renderer.setSize(newWidth, plugin.settings.standardEmbedHeight);
            camera.aspect = newWidth / plugin.settings.standardEmbedHeight;
            camera.updateProjectionMatrix();
        });
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(el); // Observe the container element for resize events

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
    console.log(lightsArray)
    lightsArray.forEach((child) => {
        if (child.obj && child.name != "attachToCam") {
            parentGroup.add(child.obj);
        }
    });
    scene.add(parentGroup);
    console.log(parentGroup)

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