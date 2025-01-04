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

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const orbit = new OrbitControls(camera, renderer.domElement);
    const controls = new TransformControls(camera, renderer.domElement)
    const gizmo = controls.getHelper();

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.x = 5
    scene.add(cube);

    const cube2 = new THREE.Mesh(geometry, material);
    cube2.position.x = -5
    scene.add(cube2);

    // orbit.target.set(cube2.position.x, cube2.position.y, cube2.position.z)

    if (config.showTransformControls) {

        controls.addEventListener('change', render);
        controls.addEventListener('dragging-changed', function (event) {
            orbit.enabled = !event.value;
        });

        scene.add(gizmo);

        function render() {
            renderer.render(scene, camera);
        }
    }
    applyCameraSettings(camera, config, orbit);

    // Load the model based on the extension
    const modelExtension = name.slice(-3).toLowerCase();
    let ThreeDmodel: THREE.Object3D | undefined;
    loadModel(plugin, scene, modelPath, modelExtension, config, (model) => {
        ThreeDmodel = model;
        gui(plugin, config.showGuiOverlay, el, scene, axesHelper, gridHelper, controls, orbit, gizmo, camera, renderer, ctx, ThreeDmodel)
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
        if (ThreeDmodel) {
            controls.attach(ThreeDmodel);
        }
        requestAnimationFrame(animate);

        orbit.update()
        renderer.render(scene, camera);

        if (ThreeDmodel) {
            ThreeDmodel.rotation.y += config.AutorotateY || 0;
            ThreeDmodel.rotation.x += config.AutorotateX || 0;
            ThreeDmodel.rotation.z += config.AutorotateZ || 0;
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