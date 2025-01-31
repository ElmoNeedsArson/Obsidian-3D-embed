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
import { applyCameraSettings, applyModelSettings } from './applyConfig'
import { loadModel } from './loadModelType'

export function initializeThreeJsScene(plugin: ThreeJSPlugin, el: HTMLElement, config: any, modelPath: string, name: string, width: number, ctx: any, renderer: THREE.WebGLRenderer) {
    const scene = new THREE.Scene();

    scene.background = new THREE.Color(`#${config.backgroundColorHexString || config.colorHexString || plugin.settings.standardColor.replace(/#/g, "")}`);
    const axesHelper = new THREE.AxesHelper(config.length);
    const gridHelper = new THREE.GridHelper(config.gridSize, config.gridSize);

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
    let lightColor;
    let lightStrength;

    if (config.lightColor) {
        lightColor = "#" + config.lightColor
    } else {
        lightColor = plugin.settings.standardLightColor || 0xFFFFFF
    }

    const lightIndicator_Geometry = new THREE.SphereGeometry(1)
    const lightIndicator_material = new THREE.MeshBasicMaterial({ color: lightColor });
    const lightIndicator = new THREE.Mesh(lightIndicator_Geometry, lightIndicator_material);

    if (config.showLight) {
        lightIndicator.position.set(5, 10, 5);
        scene.add(lightIndicator);
    } else {
        if (plugin.settings.standardshowLight) {
            lightIndicator.position.set(5, 10, 5);
            scene.add(lightIndicator);
        }
    }

    if (config.lightStrength) {
        lightStrength = config.lightStrength
    } else {
        lightStrength = plugin.settings.standardlightStrength || 1
    }

    const light = new THREE.DirectionalLight(lightColor, lightStrength);

    if (config.lightPosXYZ) {
        light.position.set(config.lightPosXYZ[0],config.lightPosXYZ[1],config.lightPosXYZ[2])
        if (config.showLight) {
            lightIndicator.position.set(config.lightPosXYZ[0],config.lightPosXYZ[1],config.lightPosXYZ[2]);
        }
    } else {
        light.position.set(plugin.settings.standardlightPosX,plugin.settings.standardlightPosY,plugin.settings.standardlightPosZ)
        if (!config.showLight && plugin.settings.standardshowLight) {
            lightIndicator.position.set(plugin.settings.standardlightPosX,plugin.settings.standardlightPosY,plugin.settings.standardlightPosZ);
        }
    }

    let lightColor_AttachedCam;
    let lightStrength_AttachedCam;

    if (config.lightStrength_AttachedCam) {
        lightStrength_AttachedCam = config.lightStrength_AttachedCam
    } else {
        lightStrength_AttachedCam = plugin.settings.standardlightStrength_AttachedCam || 1
    }

    if (config.lightColor_AttachedCam) {
        lightColor_AttachedCam = "#" + config.lightColor_AttachedCam
    } else {
        lightColor_AttachedCam = plugin.settings.standardLightColor_AttachedCam || 0xFFFFFF
    }

    const dirLight = new THREE.DirectionalLight( lightColor_AttachedCam, lightStrength_AttachedCam );
	dirLight.position.set(0, 10, 45);
	dirLight.castShadow = true;

    if (config.attachLightToCam) {
        camera.add( dirLight );
        // scene.remove(lightIndicator)
    } else {
        
    }

    scene.add(light);

    scene.add(camera)
    //LIGHTING SETUP ----------------------------------------------------------------------

    const orbit = new OrbitControls(camera, renderer.domElement);
    const controls = new TransformControls(camera, renderer.domElement)
    const gizmo = controls.getHelper();

    // const geometry = new THREE.BoxGeometry(1, 1, 1);
    // const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    // const cube = new THREE.Mesh(geometry, material);
    // cube.position.x = 5
    // scene.add(cube);

    // const cube2 = new THREE.Mesh(geometry, material);
    // cube2.position.x = -5
    // scene.add(cube2);

    // orbit.target.set(cube2.position.x, cube2.position.y, cube2.position.z)

    // if (config.showTransformControls) {

    //     controls.addEventListener('change', render);
    //     controls.addEventListener('dragging-changed', function (event) {
    //         orbit.enabled = !event.value;
    //     });

    //     scene.add(gizmo);

    //     function render() {
    //         renderer.render(scene, camera);
    //     }
    // }
    applyCameraSettings(camera, config, orbit);

    // Load the model based on the extension
    const modelExtension = name.slice(-3).toLowerCase();
    let ThreeDmodel: THREE.Object3D | undefined;
    loadModel(plugin, scene, modelPath, modelExtension, config, (model) => {
        ThreeDmodel = model;
        // gui(plugin, config.showGuiOverlay, el, scene, axesHelper, gridHelper, controls, orbit, gizmo, camera, renderer, ctx, ThreeDmodel)
    });

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

    // Animation loop
    const animate = () => {
        if(renderer.getContext().isContextLost()){
            return
        }
        if (ThreeDmodel) {
            controls.attach(ThreeDmodel);
        }
        requestAnimationFrame(animate);

        orbit.update()
        if (renderer && renderer.getContext().isContextLost()) {
            console.warn('Skipping rendering due to lost context');
        } else {
            renderer.render(scene, camera);
        }
        // renderer.render(scene, camera);

        if (ThreeDmodel) {
            ThreeDmodel.rotation.y += config.AutorotateY || 0;
            ThreeDmodel.rotation.x += config.AutorotateX || 0;
            ThreeDmodel.rotation.z += config.AutorotateZ || 0;
        }

        dirLight.target.position.copy(camera.position);
	    dirLight.target.position.y=0;
	    dirLight.target.updateMatrixWorld();
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