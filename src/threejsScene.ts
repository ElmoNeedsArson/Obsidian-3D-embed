import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, View, getLinkpath, TFile, MarkdownView, MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

import ThreeJSPlugin from './main';

import { gui } from './gui'
import { applyCameraSettings, applyModelConfig } from './applyConfig'
import { /*loadModel,*/ loadModels } from './loadModelType'
import { loadLights } from './loadLightType'

export async function initializeThreeJsScene(plugin: ThreeJSPlugin, el: HTMLElement, config: any, modelPath: string, name: string, width: number, ctx: any, renderer: THREE.WebGLRenderer) {
    const scene = new THREE.Scene();

    scene.background = new THREE.Color(`#${config.backgroundColorHexString || config.colorHexString || plugin.settings.standardColor.replace(/#/g, "")}`);
    const axesHelper = new THREE.AxesHelper(config.length);
    const gridHelper = new THREE.GridHelper(config.gridSize, config.gridSize);

    //console.log(config)

    if (config.showAxisHelper) {
        scene.add(axesHelper);
    }
    if (config.showGridHelper) {
        scene.add(gridHelper);
    }

    let camera = setCameraMode(config.orthographic, width, plugin.settings.standardEmbedHeight);

    //const renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, plugin.settings.standardEmbedHeight);
    el.appendChild(renderer.domElement);

    //LIGHTING SETUP ----------------------------------------------------------------------

    let lightsArray = []
    if (config.lights) {
        let lights = config.lights
        for (let i = 0; i < lights.length; i++) {
            let light = loadLights(plugin, scene, lights[i].type, lights[i].show, lights[i].color, lights[i].pos, lights[i].strength, camera)
            lightsArray.push({ name: lights[i].type, obj: light })
        }
    }

    scene.add(camera)
    //LIGHTING SETUP ----------------------------------------------------------------------

    const orbit = new OrbitControls(camera, renderer.domElement);
    const controls = new TransformControls(camera, renderer.domElement)
    const gizmo = controls.getHelper();

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
                let model = await loadModels(plugin, scene, pathToModel, modelExtensionType, models[i]);
                modelArray.push(model);
            } catch (error) {
                console.error(error);
            }
        }
    }

    // Load the model based on the extension
    // const modelExtension = name.slice(-3).toLowerCase();
    // let ThreeDmodel: THREE.Object3D | undefined;
    // loadModel(plugin, scene, modelPath, modelExtension, config, (model) => {
    //     ThreeDmodel = model;
    //     gui(plugin, config.showGuiOverlay, el, scene, axesHelper, gridHelper, controls, orbit, gizmo, camera, renderer, ctx, ThreeDmodel)
    // });

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
    scene.add(parentGroup);

    // Animation loop
    const animate = () => {
        if (renderer.getContext().isContextLost()) {
            return
        }
        requestAnimationFrame(animate);

        if (scene && config.autoRotation) {
            parentGroup.rotation.x += config.autoRotation[0];
            parentGroup.rotation.y += config.autoRotation[1];
            parentGroup.rotation.z += config.autoRotation[2];
        }

        orbit.update()
        if (renderer && renderer.getContext().isContextLost()) {
            console.warn('Skipping rendering due to lost context');
        } else {
            renderer.render(scene, camera);
        }



        // if (ThreeDmodel) {
        //     ThreeDmodel.rotation.y += config.AutorotateY || 0;
        //     ThreeDmodel.rotation.x += config.AutorotateX || 0;
        //     ThreeDmodel.rotation.z += config.AutorotateZ || 0;
        // }

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