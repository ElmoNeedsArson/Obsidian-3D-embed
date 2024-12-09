import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, View, getLinkpath, TFile, MarkdownView } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

interface ThreeDEmbedSettings {
    standardColor: string;
    standardScale: number;
    standardEmbedHeight: number;
    autoRotate: boolean;
}

const DEFAULT_SETTINGS: Partial<ThreeDEmbedSettings> = {
    standardColor: "#ADD8E6",
    standardScale: 0.5,
    standardEmbedHeight: 300,
    autoRotate: false,
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
                    let rotation = `,\n"rotationX": 0, "rotationY": 0, "rotationZ": 0`
                    let autoRotate = `,\n"AutorotateX": 0, "AutorotateY":` + autorotateY + `, "AutorotateZ": 0`
                    let position = `,\n"positionX": 0, "positionY": 0, "positionZ": 0`
                    let scale = `,\n"scale": "` + this.settings.standardScale + `"`
                    let color = `,\n"colorHexString": "` + this.settings.standardColor.replace(/#/g, "") + `"`
                    let showAxisHelper = `,\n"showAxisHelper": false, "length": 5`
                    let showGridHelper = `,\n"showGridHelper": false, "gridSize": 10`
                    let codeBlockClosing = '\n}\n```\n'

                    let content = codeBlockType + name + rotation + autoRotate + position + scale + color + showAxisHelper + showGridHelper + codeBlockClosing
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
        scene.background = new THREE.Color(`#${config.colorHexString || this.settings.standardColor.replace(/#/g, "")}`);
        if (config.showAxisHelper) {
            const axesHelper = new THREE.AxesHelper(config.length);
            scene.add(axesHelper);
        }
        if (config.showGridHelper) {
            const gridHelper = new THREE.GridHelper(config.gridSize, config.gridSize);
            scene.add(gridHelper);
        }
        const camera = new THREE.PerspectiveCamera(75, width / this.settings.standardEmbedHeight, 0.1, 1000);
        camera.position.z = 10;

        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, this.settings.standardEmbedHeight);
        el.appendChild(renderer.domElement);

        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 10, 5);
        scene.add(light);

        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);

        const controls = new OrbitControls(camera, renderer.domElement);

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
                    const material = new THREE.MeshPhongMaterial({ color: 0x606060, shininess: 100 });
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
    }
}