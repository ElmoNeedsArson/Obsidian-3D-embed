import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, View, getLinkpath, TFile, MarkdownView, MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

import { DEFAULT_SETTINGS, ThreeDEmbedSettings, ThreeDSettingsTab } from './settings';
import { ThreeJSRendererChild, getUniqueId, getRenderer } from './rendermanager'
import { gui } from './gui'
import { applyCameraSettings, applyModelSettings } from './applyConfig'

export default class ThreeJSPlugin extends Plugin {
    settings: ThreeDEmbedSettings;

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ThreeDSettingsTab(this.app, this));

        //adds a code block that instantly adds the 3D scene to your note
        this.addCommand({
            id: "Add a 3D embed at the cursorposition",
            name: "Add a 3D embed at the cursorposition",
            editorCallback: (editor: Editor) => {
                let selection = editor.getSelection();

                //gets the embed on the line to get the 3D model name in the vault
                if (selection == "") {
                    const lineNumber = editor.getCursor().line
                    const searchQuery = editor.getLine(lineNumber).trim()

                    function mySubString(str: string) {
                        let newStr;
                        newStr = str.substring(str.indexOf("[") + 1, str.lastIndexOf("]"));
                        return newStr;
                    }
                    let newStr1 = mySubString(searchQuery)
                    let newStr2 = mySubString(newStr1)
                    selection = newStr2;
                }

                //If a path to the selection can be found the model can be displayed, otherwise display a warning
                const modelPath = this.getModelPath(selection)
                if (!modelPath) { new Notice("This model cannot be found", 5000); }
                else if (modelPath) {

                    let autorotateY = this.settings.autoRotate ? 0.001 : 0
                    let codeBlockType = "\n```3D\n{"
                    let name = `\n"name": "` + selection + `"`
                    let GUI = `,\n"showGuiOverlay": ` + this.settings.autoShowGUI
                    let rotation = `,\n"rotationX": 0, "rotationY": 0, "rotationZ": 0`
                    let autoRotate = `,\n"AutorotateX": 0, "AutorotateY":` + autorotateY + `, "AutorotateZ": 0`
                    let position = `,\n"positionX": 0, "positionY": 0, "positionZ": 0`
                    let showTransformControls = `,\n"showTransformControls": false`
                    let scale = `,\n"scale": "` + this.settings.standardScale + `"`
                    let objectColor = `,\n"stlColorHexString": "` + this.settings.stlColor.replace(/#/g, "") + `"`
                    let wireFrame = `,\n"stlWireframe":` + this.settings.stlWireframe
                    let backgroundColor = `,\n"backgroundColorHexString": "` + this.settings.standardColor.replace(/#/g, "") + `"`

                    let cameraType = ""
                    if (this.settings.cameraType == "Orthographic") {
                        cameraType = `,\n"orthographic": true`
                    } else {
                        cameraType = `,\n"orthographic": false`
                    }

                    let cameraPos = `,\n"camPosXYZ": [0,5,10]`
                    //let cameraRot = `,\n"camRotXYZ": [0,0,0]`
                    let cameraLookat = `,\n"LookatXYZ": [0,0,0]`
                    let showAxisHelper = `,\n"showAxisHelper": false, "length": 5`
                    let showGridHelper = `,\n"showGridHelper": false, "gridSize": 10`
                    let codeBlockClosing = '\n}\n```\n'
                    let content = ""
                    if (this.settings.showConfig) {
                        content = codeBlockType + name + GUI + rotation + autoRotate + position + showTransformControls + scale + objectColor + wireFrame + backgroundColor + cameraType + cameraPos + cameraLookat + showAxisHelper + showGridHelper + codeBlockClosing
                    } else if (!this.settings.showConfig) {
                        content = codeBlockType + name + GUI + rotation + position + backgroundColor + cameraPos + cameraLookat + codeBlockClosing
                    }
                    editor.replaceSelection(content);
                }
            },
        });

        this.registerMarkdownCodeBlockProcessor('3D', (source, el, ctx) => {
            console.log(el)
            // Combine file path, content, and linestart to create a unique ID
            const blockId = getUniqueId(ctx, el); // Block-level unique ID
            const instanceId = `${blockId}:${Date.now()}:${Math.random()}`; // Instance-level unique ID

            //const renderer = getRenderer(blockId, instanceId, el);
            const renderer = new THREE.WebGLRenderer

            const child = new ThreeJSRendererChild(el, blockId, instanceId, this);
            ctx.addChild(child);

            try {
                const parsedData = JSON.parse(source);
                const modelPath = this.getModelPath(parsedData.name);

                const requiredFields = {
                    positionX: { name: "x position", example: `"positionX": 0, "positionY": 0, "positionZ": 0,` },
                    positionY: { name: "y position", example: `"positionX": 0, "positionY": 0, "positionZ": 0,` },
                    positionZ: { name: "z position", example: `"positionX": 0, "positionY": 0, "positionZ": 0,` },
                    rotationX: { name: "x rotation", example: `"rotationX": 0, "rotationY": 0, "rotationZ": 0,` },
                    rotationY: { name: "y rotation", example: `"rotationX": 0, "rotationY": 0, "rotationZ": 0,` },
                    rotationZ: { name: "z rotation", example: `"rotationX": 0, "rotationY": 0, "rotationZ": 0,` },
                    camPosXYZ: { name: "camera Position", example: `"camPosXYZ": [0,5.000000000000002,10],` },
                    LookatXYZ: { name: "camera lookAt", example: `"LookatXYZ": [0,0,0],` },
                    backgroundColorHexString: { name: "background color", example: `"backgroundColorHexString": "80bcd6",` },
                    showGuiOverlay: { name: "gui show", example: `"showGuiOverlay": true,` }
                } as const;

                // Validation errors
                const errors: string[] = [];
                for (const [field, { name, example }] of Object.entries(requiredFields)) {
                    if (parsedData[field as keyof typeof parsedData] === undefined) {
                        errors.push(`Please include the ${name} in the config. For example ${example}`);
                    }
                }
                if (errors.length > 0) {
                    new Notice(errors.join('\n'), 10000);
                    return;
                }

                if (!modelPath) {
                    new Notice("Model path not found", 10000);
                    return;
                }

                // Rest of your code
                const width = (ctx as any).el.clientWidth || 300;
                this.initializeThreeJsScene(el, parsedData, modelPath, parsedData.name, width, ctx, renderer);

            } catch (error) {
                let message = error.toString().includes("Expected ',' or '}'")
                    ? "Please make sure that every line BUT the last one ends with a comma ','"
                    : error.toString().includes("Expected double")
                        ? "The last line should not end with a comma"
                        : error.message;

                new Notice("Failed to render 3D model: " + message, 10000);
            }
        });
    }

    getModelPath(name: string): string | null {
        const path = this.app.metadataCache.getFirstLinkpathDest(getLinkpath(name), name);
        return path ? this.app.vault.getResourcePath(path) : null;
    }

    initializeThreeJsScene(el: HTMLElement, config: any, modelPath: string, name: string, width: number, ctx: any, renderer: THREE.WebGLRenderer) {
        const scene = new THREE.Scene();

        scene.background = new THREE.Color(`#${config.backgroundColorHexString || config.colorHexString || this.settings.standardColor.replace(/#/g, "")}`);
        const axesHelper = new THREE.AxesHelper(config.length);
        const gridHelper = new THREE.GridHelper(config.gridSize, config.gridSize);

        if (config.showAxisHelper) {
            scene.add(axesHelper);
        }
        if (config.showGridHelper) {
            scene.add(gridHelper);
        }

        let camera = this.setCameraMode(config.orthographic, width, this.settings.standardEmbedHeight);

        //const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, this.settings.standardEmbedHeight);
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
        this.loadModel(scene, modelPath, modelExtension, config, (model) => {
            ThreeDmodel = model;
            gui(this, config.showGuiOverlay, el, scene, axesHelper, gridHelper, controls, orbit, gizmo, camera, renderer, ctx, ThreeDmodel)
        });

        // Resize function to update camera and renderer on container width change
        const onResize = () => {
            let newWidth = 0;
            //ensures that the browser has completed its rendering and layout process before you attempt to access ctx.el.clientWidth
            requestAnimationFrame(() => {
                newWidth = (ctx as any).el.clientWidth || 300

                renderer.setSize(newWidth, this.settings.standardEmbedHeight);
                camera.aspect = newWidth / this.settings.standardEmbedHeight;
                camera.updateProjectionMatrix();
            });
        };

        const resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(el); // Observe the container element for resize events

        // Clean up on plugin unload
        this.register(() => {
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

    loadModel(scene: THREE.Scene, modelPath: string, extension: string, config: any, callback: (model: THREE.Object3D) => void) {
        switch (extension) {
            case 'stl':
                const stlLoader = new STLLoader();
                stlLoader.load(modelPath, (geometry) => {
                    let material: any;
                    if (config.stlColorHexString) {
                        let col2: string;
                        col2 = "#" + config.stlColorHexString
                        material = new THREE.MeshStandardMaterial({ color: col2 });
                        if (config.stlWireframe) {
                            material.wireframe = true;
                        }
                    } else {
                        material = new THREE.MeshPhongMaterial({ color: 0x606060, shininess: 100 });
                    }
                    const model = new THREE.Mesh(geometry, material);
                    applyModelSettings(this, model, config);
                    scene.add(model);
                    callback(model);
                }, undefined, (error) => {
                    new Notice("Failed to load stl model: " + error);
                });
                break;
            case 'glb':
                const gltfLoader = new GLTFLoader();
                gltfLoader.load(modelPath, (gltf) => {
                    const model = gltf.scene;
                    applyModelSettings(this, model, config);
                    scene.add(model);
                    callback(model);
                }, undefined, (error) => {
                    new Notice("Failed to load glb (GLTF) model: " + error);
                });
                break;
            case 'obj':
                const objLoader = new OBJLoader();
                objLoader.load(modelPath, (obj) => {
                    obj.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            if (!child.material) {
                                child.material = new THREE.MeshStandardMaterial({ color: 0x606060 });
                            }
                        }
                    });
                    applyModelSettings(this, obj, config);
                    scene.add(obj);
                    callback(obj);
                }, undefined, (error) => {
                    new Notice("Failed to load obj model: " + error);
                });
                break;
            case 'fbx':
                const fbxLoader = new FBXLoader();
                fbxLoader.load(modelPath, (fbx) => {

                    fbx.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            //For some reason, fbx files have weird scaling, so specifically scaling the mesh, makes it work-ish
                            child.scale.set(config.scale, config.scale, config.scale);
                        }
                    });

                    applyModelSettings(this, fbx, config);
                    scene.add(fbx)
                    callback(fbx);
                }, undefined, (error) => {
                    new Notice("Failed to load fbx model: " + error);
                });
                break;
            case '3mf':
                const ThreeMFloader = new ThreeMFLoader();

                ThreeMFloader.load(modelPath, (ThreeMF) => {
                    applyModelSettings(this, ThreeMF, config);
                    scene.add(ThreeMF);
                    callback(ThreeMF);
                }, undefined, (error) => {
                    new Notice("Failed to load 3mf model: " + error);
                });
                break;
            default:
                throw new Error("Unsupported model format");
        }
    }

    setCameraMode(orthographic: boolean, width: number, height: number) {
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

    onunload() {
        console.log("3D Embed Plugin Unloaded")
    }
}


