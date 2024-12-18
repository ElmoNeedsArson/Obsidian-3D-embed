import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, View, getLinkpath, TFile, MarkdownView } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

//import { replaceCodeBlock } from 'obsidian-dev-utils/dist/lib/obsidian/MarkdownCodeBlockProcessor';
//import { replaceCodeBlock } from 'obsidian-dev-utils';
type ValueProvider<T, Args extends any[]> = (...args: Args) => Promise<T> | T;

interface ThreeDEmbedSettings {
    standardColor: string;
    standardScale: number;
    standardEmbedHeight: number;
    autoRotate: boolean;
    orthographicCam: boolean;
    autoShowGUI: boolean;
}

const DEFAULT_SETTINGS: Partial<ThreeDEmbedSettings> = {
    standardColor: "#ADD8E6",
    standardScale: 0.5,
    standardEmbedHeight: 300,
    autoRotate: false,
    orthographicCam: false,
    autoShowGUI: false,
};

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
                    let scale = `,\n"scale": "` + this.settings.standardScale + `"`
                    let objectColor = `,\n"stlColorHexString": "606060"`
                    let backgroundColor = `,\n"backgroundColorHexString": "` + this.settings.standardColor.replace(/#/g, "") + `"`
                    let cameraType = `,\n"orthographic": ` + this.settings.orthographicCam
                    let cameraPos = `,\n"camPosXYZ": [0,5,10]`
                    let cameraLookat = `,\n"LookatXYZ": [0,0,0]`
                    let showAxisHelper = `,\n"showAxisHelper": false, "length": 5`
                    let showGridHelper = `,\n"showGridHelper": false, "gridSize": 10`
                    let codeBlockClosing = '\n}\n```\n'

                    let content = codeBlockType + name + GUI + rotation + autoRotate + position + scale + objectColor + backgroundColor + cameraType + cameraPos + cameraLookat + showAxisHelper + showGridHelper + codeBlockClosing
                    editor.replaceSelection(content);
                }
            },
        });

        this.registerMarkdownCodeBlockProcessor('3D', (source, el, ctx) => {
            try {
                const parsedData = JSON.parse(source);
                const modelPath = this.getModelPath(parsedData.name);
                if (!modelPath) throw new Error("Model path not found");
                const width = (ctx as any).el.clientWidth || 300
                this.initializeThreeJsScene(el, parsedData, modelPath, parsedData.name, width, ctx);
            } catch (error) {
                new Notice("Failed to render 3D model: " + error.message);
            }
        });
    }

    getModelPath(name: string): string | null {
        const path = this.app.metadataCache.getFirstLinkpathDest(getLinkpath(name), name);
        return path ? this.app.vault.getResourcePath(path) : null;
    }

    initializeThreeJsScene(el: HTMLElement, config: any, modelPath: string, name: string, width: number, ctx: any) {
        const scene = new THREE.Scene();

        scene.background = new THREE.Color(`#${config.backgroundColorHexString || config.colorHexString || this.settings.standardColor.replace(/#/g, "")}`);
        const axesHelper = new THREE.AxesHelper(config.length);
        const gridHelper = new THREE.GridHelper(config.gridSize, config.gridSize);

        this.gui(config.showGuiOverlay, el, scene, axesHelper, gridHelper)

        if (config.showAxisHelper) {
            scene.add(axesHelper);
        }
        if (config.showGridHelper) {
            scene.add(gridHelper);
        }

        let camera = this.setCameraMode(config.orthographic, width, this.settings.standardEmbedHeight);
        
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, this.settings.standardEmbedHeight);
        el.appendChild(renderer.domElement);

        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 10, 5);
        scene.add(light);

        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        this.applyCameraSettings(camera, config, controls);

        // Load the model based on the extension
        const modelExtension = name.slice(-3).toLowerCase();
        let ThreeDmodel: THREE.Object3D;
        this.loadModel(scene, modelPath, modelExtension, config, (model) => {
            ThreeDmodel = model;
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
            requestAnimationFrame(animate);

            controls.update();
            renderer.render(scene, camera);

            if (ThreeDmodel) {
                ThreeDmodel.rotation.y += config.AutorotateY;
                ThreeDmodel.rotation.x += config.AutorotateX;
                ThreeDmodel.rotation.z += config.AutorotateZ;
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

    gui(guiShow : boolean, el: HTMLElement, scene: THREE.Scene, axesHelper: THREE.AxesHelper, gridHelper: THREE.GridHelper){
        if (guiShow) {
            let colorInput = document.createElement('input');
            colorInput.addClass("colorInput")
            colorInput.type = 'color'
            el.appendChild(colorInput)

            let axisInput = document.createElement('input');
            axisInput.classList.add('axisInput');
            axisInput.type = 'checkbox'
            el.appendChild(axisInput)

            let gridInput = document.createElement('input');
            gridInput.classList.add('gridInput');
            gridInput.type = 'checkbox'
            el.appendChild(gridInput)

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

                /*//this could be triggered by a different thing then triggering the color picker, for example on page unload.
                //Then this should add to a queue of changes 
    
                // view contains the editor to change the markdown
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                // the context contains the begin and end of the block in the markdown file
                const sec = ctx.getSectionInfo(ctx.el);
                const lineno = sec?.lineStart;
                const lineNoColorSetting = lineno + 7
    
                // Make sure the user is editing a Markdown file.
                if (view) {
                    const colorValue = colorInput.value.replace('#', '');
                    const codeBlockProvider: ValueProvider<string, [string]> = async (oldCodeBlock: string) => {
                        // Parse the old code block or use it to update values.
                        // Example: Add or replace the "AutorotateY" field dynamically.
    
                        const autorotateY = this.settings.autoRotate ? 0.001 : 0;
                        // Build the new code block content
                        let codeBlockType = "```3D\n{";
                        let name = `"name": "updatedName"`;
                        let rotation = `"rotationX": 0, "rotationY": 0, "rotationZ": 0`;
                        let autoRotate = `"AutorotateX": 0, "AutorotateY": ${ThreeDmodel.rotation.y}, "AutorotateZ": 0`;
                        let position = `"positionX": 0, "positionY": 0, "positionZ": 0`;
                        let scale = `"scale": "1.0"`;
                        let color = `"colorHexString": "` + colorValue + `",`;
                        let showAxisHelper = `"showAxisHelper": false, "length": 5`;
                        let showGridHelper = `"showGridHelper": false, "gridSize": 10`;
    
                        let newCodeBlock = `${codeBlockType}
                      ${name},
                      ${rotation},
                      ${autoRotate},
                      ${position},
                      ${scale},
                      ${color},
                      ${showAxisHelper},
                      ${showGridHelper}
                      }
                      \`\`\``;
    
                        return newCodeBlock;
                    };
    
                    //replaceCodeBlock(this.app, ctx, el, codeBlockProvider)
                    view.editor.setLine(lineNoColorSetting, `"colorHexString": "` + colorValue + `",`)
                }*/
            })
        } else {
            const colorInput = el.querySelector('.colorInput');
            const axisInput = el.querySelector('.axisInput');
            const gridInput = el.querySelector('.gridInput');

            if (colorInput) el.removeChild(colorInput);
            if (axisInput) el.removeChild(axisInput);
            if (gridInput) el.removeChild(gridInput);
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
        if(config.camPosXYZ){
            cam.position.x = config.camPosXYZ[0];
            cam.position.y = config.camPosXYZ[1];
            cam.position.z = config.camPosXYZ[2];
        } else {
            cam.position.x = 0
            cam.position.y = 5
            cam.position.z = 10
        }
        if(config.LookatXYZ){
            controls.target = new THREE.Vector3(config.LookatXYZ[0],config.LookatXYZ[1],config.LookatXYZ[2])
        } else {
            controls.target = new THREE.Vector3(0,0,0)
        }
    }

    applyModelSettings(model: THREE.Object3D, config: any) {
        model.scale.set(config.scale || 1, config.scale || 1, config.scale || 1);
        model.rotation.x = THREE.MathUtils.degToRad(config.rotationX || 0);
        model.rotation.y = THREE.MathUtils.degToRad(config.rotationY || 0);
        model.rotation.z = THREE.MathUtils.degToRad(config.rotationZ || 0);
        model.position.set(config.positionX || 0, config.positionY || 0, config.positionZ || 0);
    }

    onunload() {
        console.log("ThreeJS plugin unloaded");
    }
}

class ThreeDSettingsTab extends PluginSettingTab {
    plugin: ThreeJSPlugin;

    constructor(app: App, plugin: ThreeJSPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Standard scene color')
            .setDesc('Default background color for 3D scenes')
            .addColorPicker(colorPicker =>
                colorPicker.setValue(this.plugin.settings.standardColor)
                    .onChange(async (value) => {
                        this.plugin.settings.standardColor = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Standard scale of 3Dmodel')
            .setDesc('Default size of 3D models in scene (non whole numbers should be seperated by dot, not comma)')
            .addText(text =>
                text
                    .setValue(this.plugin.settings.standardScale.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.standardScale = numValue;
                        await this.plugin.saveSettings();
                    })

            )

        new Setting(containerEl)
            .setName('Standard height')
            .setDesc('Default height of a 3D model embed in your note (in pixels)')
            .addText(text =>
                text
                    .setValue(this.plugin.settings.standardEmbedHeight.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.standardEmbedHeight = numValue;
                        await this.plugin.saveSettings();
                    })

            )

        new Setting(containerEl)
            .setName('Auto Rotate Models')
            .setDesc('If true, will always automatically rotate the models in your scene')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.autoRotate) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.autoRotate = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )

        new Setting(containerEl)
            .setName('Toggle Orthographic Camera')
            .setDesc('If true, will load all your scenes with a orthographic camera, if false, defaults to a perspective camera. You can also set this per scene, in the codeblock config')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.orthographicCam) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.orthographicCam = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )

            new Setting(containerEl)
            .setName('Toggle Automatically show GUI')
            .setDesc('If true, will show basic gui options for a scene (color selector, grid checkbox) upon model load. Can also be set in the codeblock config')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.autoShowGUI) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.autoShowGUI = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )
    }
}