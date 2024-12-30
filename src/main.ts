import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, View, getLinkpath, TFile, MarkdownView } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

import { v4 as uuidv4 } from 'uuid';

import { DEFAULT_SETTINGS, ThreeDEmbedSettings, ThreeDSettingsTab } from './settings';
import { prototype } from 'events';



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
        let rendererArray: any;
        rendererArray = [];
        this.addSettingTab(new ThreeDSettingsTab(this.app, this));
        const rendererManager = new RendererManager(16); // Allow up to 16 renderers

        function hashCode(content: string): string {
            let hash = 0;
            for (let i = 0; i < content.length; i++) {
                const char = content.charCodeAt(i);
                hash = (hash << 5) - hash + char;
                hash |= 0; // Convert to 32-bit integer
            }
            return hash.toString();
        }

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
            // Combine file path, content, and linestart to create a unique ID
            const sectionInfo = ctx.getSectionInfo(el)?.lineStart
            const codeblockId = `${ctx.sourcePath}-${sectionInfo}-${hashCode(source)}`;
            //console.log("Codeblock ID:", codeblockId);

            // CURRENT ISSUE DESCRIPTION
            // the current codeblockID is not unique enough, it is based on the contents of a codeblock. Therefor an identical codeblock cannot be rendered
            // similataniously. A solution for this would be to add a unique identifier in the codeblock itself, but this has issues for 2 reasons, 
            // one if the file is open twice it wont work, two if the user manually copies a scene, it wont work because it will keep the same ID
            // other solution was using lines from the section info, but moving the codeblocks around would generate a new id, since its a 'different'
            // codeblock. 

            // I cant just disable all renderers, because then only the last registered codeblock will show

            //if there is a renderer for this id, remove it
            rendererManager.releaseRenderer(codeblockId);

            //add a renderer for this codeblock
            //const renderer = rendererManager.getRenderer(codeblockId);
            //or the old code:
            const renderer = new THREE.WebGLRenderer

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
        this.applyCameraSettings(camera, config, orbit);

        // Load the model based on the extension
        const modelExtension = name.slice(-3).toLowerCase();
        let ThreeDmodel: THREE.Object3D | undefined;
        this.loadModel(scene, modelPath, modelExtension, config, (model) => {
            ThreeDmodel = model;
        });

        this.gui(config.showGuiOverlay, el, scene, axesHelper, gridHelper, controls, orbit, gizmo, camera, renderer, ctx, ThreeDmodel)

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
            //console.log(orbit.target)
            //if (config.showTransformControls) {
            if (ThreeDmodel) {
                controls.attach(ThreeDmodel);
            }
            //}
            requestAnimationFrame(animate);

            //controls.update();
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
                    this.applyModelSettings(model, config);
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
                    this.applyModelSettings(model, config);
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
                    this.applyModelSettings(obj, config);
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

                    this.applyModelSettings(fbx, config);
                    scene.add(fbx)
                    callback(fbx);
                }, undefined, (error) => {
                    new Notice("Failed to load fbx model: " + error);
                });
                break;
            case '3mf':
                const ThreeMFloader = new ThreeMFLoader();

                ThreeMFloader.load(modelPath, (ThreeMF) => {
                    this.applyModelSettings(ThreeMF, config);
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

    gui(guiShow: boolean, el: HTMLElement, scene: THREE.Scene, axesHelper: THREE.AxesHelper, gridHelper: THREE.GridHelper, controls: TransformControls, orbit: OrbitControls, gizmo: any, camera: any, renderer: any, ctx: any, model: any) {
        if (guiShow) {
            let applyReload = document.createElement('button');
            applyReload.addClass("buttonInput_Reload")
            applyReload.innerText = "Apply & Reload"
            el.appendChild(applyReload)

            let reset = document.createElement('button');
            reset.addClass("buttonInput_Reset")
            reset.innerText = "Reset Rotation/Position"
            el.appendChild(reset)

            let colorInput = document.createElement('input');
            colorInput.addClass("colorInput")
            colorInput.type = 'color'
            colorInput.value = this.settings.standardColor
            colorInput.title = "Set the Scene Color"
            el.appendChild(colorInput)

            let axisInput = document.createElement('input');
            axisInput.classList.add('axisInput');
            axisInput.type = 'checkbox'
            axisInput.title = "Show the basic axis in the scene"
            el.appendChild(axisInput)

            let gridInput = document.createElement('input');
            gridInput.classList.add('gridInput');
            gridInput.type = 'checkbox'
            gridInput.title = "Show a grid in the scene"
            el.appendChild(gridInput)

            let TransformControlsInput = document.createElement('input');
            TransformControlsInput.classList.add('TransformControlsInput');
            TransformControlsInput.type = 'checkbox'
            TransformControlsInput.title = "Show transform controls on the objects"
            el.appendChild(TransformControlsInput)

            function defineModel() {
                let mdl: any;

                scene.traverse(function (object) {
                    if (object.name === "Scene") {
                        //console.log("Found the imported model:", object);
                        mdl = object
                    }
                });

                return mdl;
            }

            reset.addEventListener('click', () => {
                console.log(camera.rotation)

                let mdl = defineModel()
                mdl.position.x = 0;
                mdl.position.y = 0;
                mdl.position.z = 0;

                mdl.rotation.x = 0;
                mdl.rotation.y = 0;
                mdl.rotation.z = 0;

                camera.position.x = 0;
                camera.position.y = 5;
                camera.position.z = 10;

                orbit.target.x = 0;
                orbit.target.y = 0;
                orbit.target.z = 0;

                scene.background = new THREE.Color(this.settings.standardColor);
                colorInput.value = this.settings.standardColor
            })

            applyReload.addEventListener('click', () => {
                //saveOrbitState(orbit, camera)
                let mdl = defineModel()

                const view = this.app.workspace.getActiveViewOfType(MarkdownView);

                //gets line number of the codeblock that is being triggered with the button
                const sec = ctx.getSectionInfo(ctx.el);
                const lineno = sec?.lineStart;

                const colorValue = colorInput.value.replace('#', '');

                if (view) {
                    let startblock = 0;
                    let endblock = 0;
                    for (let i = 0; i < 20; i++) { //20 is the max length of a codeblock
                        if (view.editor.getLine(lineno + i).contains("```3D")) {
                            console.log("trigger")
                            startblock = lineno + i
                            console.log("start: " + startblock)
                        } else if (view.editor.getLine(lineno + i).contains("```")) {
                            console.log("trigger2")
                            endblock = lineno + i
                            console.log("end: " + endblock)
                            break;
                        }
                    }

                    function cameraLookDir(camera: any) {
                        var vector = new THREE.Vector3(0, 0, -1);
                        vector.applyEuler(camera.rotation);
                        return vector;
                    }

                    console.log("camlookat " + JSON.stringify(cameraLookDir(camera).x))

                    for (let i = 0; i < endblock; i++) {
                        //save position settings
                        if (view.editor.getLine(lineno + i).contains(`"positionX"`)) {
                            console.log("found position replacing it")
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"positionX": ${mdl.position.x.toFixed(3)}, "positionY": ${mdl.position.y.toFixed(3)}, "positionZ": ${mdl.position.z.toFixed(3)}`)
                            } else {
                                view.editor.setLine(lineno + i, `"positionX": ${mdl.position.x.toFixed(3)}, "positionY": ${mdl.position.y.toFixed(3)}, "positionZ": ${mdl.position.z.toFixed(3)},`)
                            }
                        }

                        //save guioverlay setting
                        if (view.editor.getLine(lineno + i).contains(`"showGuiOverlay"`)) {
                            console.log("found gui replacing it")
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"showGuiOverlay": false`)
                            } else {
                                view.editor.setLine(lineno + i, `"showGuiOverlay": false,`)
                            }
                        }

                        //save background color setting
                        if (view.editor.getLine(lineno + i).contains(`"backgroundColorHexString"`)) {
                            console.log("found color replacing it")
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"backgroundColorHexString": "${colorValue}"`)
                            } else {
                                view.editor.setLine(lineno + i, `"backgroundColorHexString": "${colorValue}",`)
                            }
                        }

                        //save rotation settings
                        if (view.editor.getLine(lineno + i).contains(`"rotationX"`)) {
                            console.log("found rotation replacing it")
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"rotationX": ${mdl.rotation.x * (180 / Math.PI)}, "rotationY": ${mdl.rotation.y * (180 / Math.PI)}, "rotationZ": ${mdl.rotation.z * (180 / Math.PI)}`)
                            } else {
                                view.editor.setLine(lineno + i, `"rotationX": ${mdl.rotation.x * (180 / Math.PI)}, "rotationY": ${mdl.rotation.y * (180 / Math.PI)}, "rotationZ": ${mdl.rotation.z * (180 / Math.PI)},`)
                            }
                        }

                        //save camera position
                        if (view.editor.getLine(lineno + i).contains(`"camPosXYZ"`)) {
                            console.log("found camXYZ replacing it")
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"camPosXYZ": [${camera.position.x},${camera.position.y},${camera.position.z}]`)
                            } else {
                                view.editor.setLine(lineno + i, `"camPosXYZ": [${camera.position.x},${camera.position.y},${camera.position.z}],`)
                            }
                        }

                        if (view.editor.getLine(lineno + i).contains(`"LookatXYZ"`)) {
                            console.log("found camLookat replacing it")
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"LookatXYZ": [${orbit.target.x},${orbit.target.y},${orbit.target.z}]`)
                            } else {
                                view.editor.setLine(lineno + i, `"LookatXYZ": [${orbit.target.x},${orbit.target.y},${orbit.target.z}],`)
                            }
                        }
                    }
                    /*
                    //Paste the missing information in the codeblock for saving settings
                    let GUI = `"showGuiOverlay": ` + this.settings.autoShowGUI + ","
                    let rotation = `"rotationX": 0, "rotationY": 0, "rotationZ": 0,`
                    let position = `"positionX": 0, "positionY": 0, "positionZ": 0,`
                    let cameraPos = '"camPosXYZ": [0,5,10]'

                    let end = '}\n```\n\n'
                
                    //let content = ""

                    if(!GuiSetting){
                        view.editor.setLine(endblock-1, GUI)
                        endblock += 1
                    }
                    if(!rotationSetting){
                        view.editor.setLine(endblock-1, rotation)
                        endblock += 1
                    }
                    if(!positionSetting){
                        view.editor.setLine(endblock-1, position)
                        endblock += 1
                    }
                    if(!camSetting){
                        view.editor.setLine(endblock-1, cameraPos)
                        endblock += 1
                    }

                    view.editor.setLine(endblock-1, end)


                    //view.editor.setLine(startblock + 4, content)

                    for (let i = 0; i < 20; i++) { //20 is the max length of a codeblock
                        if (view.editor.getLine(lineno + i).contains("```3D")) {
                            console.log("trigger")
                            startblock = lineno + i
                            console.log("start: " + startblock)
                        } else if (view.editor.getLine(lineno + i).contains("```")) {
                            console.log("trigger2")
                            endblock = lineno + i
                            console.log("end: " + endblock)
                            break;
                        }
                    }

                    for (let i = 0; i < endblock; i++) {
                        //save position settings
                        if (view.editor.getLine(lineno + i).contains(`"positionX"`)) {
                            positionSetting = true
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"positionX": ${mdl.position.x.toFixed(3)}, "positionY": ${mdl.position.y.toFixed(3)}, "positionZ": ${mdl.position.z.toFixed(3)}`)
                            } else {
                                view.editor.setLine(lineno + i, `"positionX": ${mdl.position.x.toFixed(3)}, "positionY": ${mdl.position.y.toFixed(3)}, "positionZ": ${mdl.position.z.toFixed(3)},`)
                            }
                        }

                        //save guioverlay setting
                        if (view.editor.getLine(lineno + i).contains(`"showGuiOverlay"`)) {
                            GuiSetting = true;
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"showGuiOverlay": false`)
                            } else {
                                view.editor.setLine(lineno + i, `"showGuiOverlay": false,`)
                            }
                        }

                        //save background color setting
                        if (view.editor.getLine(lineno + i).contains(`"backgroundColorHexString"`)) {
                            colorSetting = true
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"backgroundColorHexString": "${colorValue}"`)
                            } else {
                                view.editor.setLine(lineno + i, `"backgroundColorHexString": "${colorValue}",`)
                            }
                        }

                        //save rotation settings
                        if (view.editor.getLine(lineno + i).contains(`"rotationX"`)) {
                            rotationSetting = true
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"rotationX": ${mdl.rotation.x * (180 / Math.PI)}, "rotationY": ${mdl.rotation.y * (180 / Math.PI)}, "rotationZ": ${mdl.rotation.z * (180 / Math.PI)}`)
                            } else {
                                view.editor.setLine(lineno + i, `"rotationX": ${mdl.rotation.x * (180 / Math.PI)}, "rotationY": ${mdl.rotation.y * (180 / Math.PI)}, "rotationZ": ${mdl.rotation.z * (180 / Math.PI)},`)
                            }
                        }

                        //save camera position
                        if (view.editor.getLine(lineno + i).contains(`"camPosXYZ"`)) {
                            camSetting = true;
                            if (view.editor.getLine(lineno + i + 1).contains(`}`)) {
                                view.editor.setLine(lineno + i, `"camPosXYZ": [${camera.position.x},${camera.position.y},${camera.position.z}]`)
                            } else {
                                view.editor.setLine(lineno + i, `"camPosXYZ": [${camera.position.x},${camera.position.y},${camera.position.z}],`)
                            }
                        }
                    }*/
                }
            })

            TransformControlsInput.addEventListener('input', () => {
                console.log("trigger")
                controls.addEventListener('change', render);
                controls.addEventListener('dragging-changed', function (event) {
                    orbit.enabled = !event.value;
                });

                //scene.add(gizmo);
                if (TransformControlsInput.checked) {
                    scene.add(gizmo);
                    transformOptions()
                } else {
                    scene.remove(gizmo); // or some other action for false
                    const radioParent = el.querySelector('.radioParent')
                    if (radioParent) el.removeChild(radioParent);
                }

                function render() {
                    renderer.render(scene, camera);
                }

                function transformOptions() {
                    let radioParent = document.createElement('div');
                    radioParent.classList.add('radioParent');
                    el.appendChild(radioParent)

                    const radioData = [
                        { label: 'Transform', value: '1' },
                        { label: 'Rotate', value: '2' },
                        //{ label: 'Scale', value: '3' },
                    ];

                    // Create a radio button group
                    radioData.forEach((data, index) => {
                        // Create the radio input element
                        const radio = document.createElement('input');
                        radio.type = 'radio';
                        radio.name = 'exampleRadio'; // Group name for the radio buttons
                        radio.id = `radio${index}`;
                        radio.value = data.value;

                        if (index == 0) {
                            radio.checked = true;
                        }

                        // Create the label element
                        const label = document.createElement('label');
                        label.htmlFor = `radio${index}`;
                        label.textContent = data.label;

                        // Append the radio and label to the container
                        radioParent.appendChild(radio);
                        radioParent.appendChild(label);

                        radio.addEventListener('change', (event) => {
                            const target = event.target as HTMLInputElement;

                            switch (target.value) {
                                case '1':
                                    controls.setMode('translate');
                                    break;

                                case '2':
                                    controls.setMode('rotate');
                                    break;

                                // case '3':
                                //     controls.setMode('scale');
                                //     break;
                            }
                        })
                    });
                }
            })

            gridInput.addEventListener('input', () => {
                if (gridInput.checked) {
                    scene.add(gridHelper);
                } else {
                    scene.remove(gridHelper); // or some other action for false
                }
            })

            axisInput.addEventListener('input', () => {
                if (axisInput.checked) {
                    scene.add(axesHelper);
                } else {
                    scene.remove(axesHelper); // or some other action for false
                }
            })

            colorInput.addEventListener('input', () => {
                scene.background = new THREE.Color(colorInput.value);
            })
        } else {
            const colorInput = el.querySelector('.colorInput');
            const axisInput = el.querySelector('.axisInput');
            const gridInput = el.querySelector('.gridInput');
            const TransformControlsInput = el.querySelector('.TransformControlsInput')

            if (colorInput) el.removeChild(colorInput);
            if (axisInput) el.removeChild(axisInput);
            if (gridInput) el.removeChild(gridInput);
            if (TransformControlsInput) el.removeChild(TransformControlsInput);
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

    applyCameraSettings(cam: any, config: any, controls: OrbitControls) {
        if (config.camPosXYZ) {
            cam.position.x = config.camPosXYZ[0];
            cam.position.y = config.camPosXYZ[1];
            cam.position.z = config.camPosXYZ[2];
        } else {
            cam.position.x = 0
            cam.position.y = 5
            cam.position.z = 10
        }
        if (config.LookatXYZ) {
            controls.target.set(config.LookatXYZ[0], config.LookatXYZ[1], config.LookatXYZ[2])
        } else {
            controls.target.set(0, 0, 0)
        }
    }

    applyModelSettings(model: THREE.Object3D, config: any) {
        model.scale.set(config.scale || this.settings.standardScale || 1, config.scale || this.settings.standardScale || 1, config.scale || this.settings.standardScale || 1);
        model.rotation.x = THREE.MathUtils.degToRad(config.rotationX || 0);
        model.rotation.y = THREE.MathUtils.degToRad(config.rotationY || 0);
        model.rotation.z = THREE.MathUtils.degToRad(config.rotationZ || 0);
        model.position.set(config.positionX || 0, config.positionY || 0, config.positionZ || 0);
    }

    onunload() {
        //RendererManager.disposeAll();

        console.log("ThreeJS plugin unloaded");
    }
}

class RendererManager {
    private maxRenderers: number;
    private rendererPool: THREE.WebGLRenderer[] = [];
    private activeRenderers: Map<string, THREE.WebGLRenderer> = new Map();

    constructor(maxRenderers: number = 10) {
        this.maxRenderers = maxRenderers;
    }

    /**
     * Get a WebGLRenderer for a given codeblock.
     * If one exists for the codeblock, it is reused. Otherwise, a new one is created or pulled from the pool.
     * @param codeblockId - The unique identifier for the codeblock.
     * @returns {THREE.WebGLRenderer} The renderer assigned to the codeblock.
     */
    getRenderer(codeblockId: string): THREE.WebGLRenderer {
        // Check if a renderer is already assigned to this codeblock
        if (this.activeRenderers.has(codeblockId)) {
            return this.activeRenderers.get(codeblockId)!;
        }

        let renderer: THREE.WebGLRenderer;

        // Reuse a renderer from the pool if available
        if (this.rendererPool.length > 0) {
            renderer = this.rendererPool.pop()!;
        } else if (this.activeRenderers.size < this.maxRenderers) {
            // Create a new renderer if the pool is empty and we're under the max limit
            renderer = new THREE.WebGLRenderer();
        } else {
            throw new Notice("Too many active renderers. Please free some renderers.")
            //throw new Error("Too many active renderers. Please free some renderers.");
        }

        // Associate the renderer with this codeblock
        this.activeRenderers.set(codeblockId, renderer);
        console.log("Active Renderers:", this.activeRenderers.size, Array.from(this.activeRenderers.keys()));

        return renderer;
    }

    /**
     * Release the WebGLRenderer associated with a specific codeblock, returning it to the pool.
     * @param codeblockId - The unique identifier for the codeblock.
     */
    releaseRenderer(codeblockId: string): void {
        const renderer = this.activeRenderers.get(codeblockId);
        if (renderer) {
            this.activeRenderers.delete(codeblockId);
            this.rendererPool.push(renderer); // Return to the pool
        }
    }

    /**
     * Dispose of all renderers and clear the pool and active renderers.
     */
    disposeAll(): void {
        for (const renderer of this.activeRenderers.values()) {
            renderer.dispose();
        }
        for (const renderer of this.rendererPool) {
            renderer.dispose();
        }
        this.activeRenderers.clear();
        this.rendererPool = [];
    }
}

