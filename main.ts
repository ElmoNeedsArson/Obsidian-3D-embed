import { App, Editor, Notice, Plugin, PluginSettingTab, Setting, View, getLinkpath } from 'obsidian';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';


interface ThreeDEmbedSettings {
    standardColor: string;
}

const DEFAULT_SETTINGS: Partial<ThreeDEmbedSettings> = {
    standardColor: "#ADD8E6"
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

        this.addCommand({
            id: "3DModel",
            name: "3DModel",
            //hotkeys: [{ modifiers: [this.settings.keyOne], key: this.settings.keyTwo }],
            editorCallback: (editor: Editor) => {
                let selection = editor.getSelection();
                if (selection == "") {
                    const lineNumber = editor.getCursor().line
                    const searchQuery = editor.getLine(lineNumber).trim()
                    //console.log("Sq: " + searchQuery)

                    function mySubString(str: string) {
                        let newStr;
                        newStr = str.substring(str.indexOf("[") + 1, str.lastIndexOf("]"));
                        return newStr;
                    }
                    let newStr1 = mySubString(searchQuery)
                    let newStr2 = mySubString(newStr1)
                    selection = newStr2;
                    //console.log("Newstring: " + newStr2)
                }

                //const searchQuery = doc.getLine(curLineNum).trim()
                let firstLine = "\n```3D\n"
                let contents = `{\n"name": "` + selection + `",\n"rotationX": 0, "rotationY": 0, "rotationZ": 0, \n"scale": 0.5, \n"autoRotate": true, \n"colorHexString": "` + this.settings.standardColor.replace(/#/g, "") + `", \n"positionX": 0, "positionY": 0, "positionZ": 0\n}\n`
                let lastLine = '\n```\n'
                let content = firstLine + contents + lastLine
                editor.replaceSelection(content);
            },
        });

        this.registerMarkdownCodeBlockProcessor('3D', (source, el, ctx) => {
            //console.log((ctx as any).containerEl);
            try {
                console.log(el)
                const parsedData = JSON.parse(source);
                const modelPath = this.getModelPath(parsedData.name);
                if (!modelPath) throw new Error("Model path not found");
                const containerEl = (ctx as any).containerEl;
                //console.log(containerEl.firstChild.clientWidth);
                const width = containerEl.firstChild.clientWidth
                this.initializeThreeJsScene(el, parsedData, modelPath, parsedData.name, width, containerEl);
            } catch (error) {
                new Notice("Failed to render 3D model: " + error.message);
            }
        });
    }

    getModelPath(name: string): string | null {
        const path = this.app.metadataCache.getFirstLinkpathDest(getLinkpath(name), name);
        return path ? this.app.vault.getResourcePath(path) : null;
    }

    initializeThreeJsScene(el: HTMLElement, config: any, modelPath: string, name: string, width: number, containerEl: HTMLElement) {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(`#${config.colorHexString || this.settings.standardColor.replace(/#/g, "")}`);

        const camera = new THREE.PerspectiveCamera(75, width / 300, 0.1, 1000);
        camera.position.z = 10;

        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, 300);
        el.appendChild(renderer.domElement);
        console.log("Renderer added")

        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 10, 5);
        scene.add(light);

        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);

        const controls = new OrbitControls(camera, renderer.domElement);

        // Load the model based on the extension
        console.log(modelPath)
        const modelExtension = name.slice(-3).toLowerCase();
        console.log(modelExtension)
        let ThreeDmodel:THREE.Object3D;
        this.loadModel(scene, modelPath, modelExtension, config, (model) => {
            // Do something with the loaded model here
            console.log("Model loaded:", model);
            ThreeDmodel = model;
        });

        // Resize function to update camera and renderer on container width change
        const onResize = () => {
            const firstChild = containerEl.firstChild as HTMLElement; // Cast to HTMLElement
            if (firstChild) {
                const newWidth = firstChild.clientWidth; // Now TypeScript recognizes clientWidth
                renderer.setSize(newWidth, 300);
                camera.aspect = newWidth / 300;
                camera.updateProjectionMatrix();
            }
        };

        const resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(containerEl); // Observe the container element for resize events

        // Clean up on plugin unload
        this.register(() => {
            resizeObserver.disconnect(); // Stop observing
            renderer.dispose();
        });

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);

            if(config.autoRotate){
                if(ThreeDmodel){
                ThreeDmodel.rotation.y += 0.001;}
            }
            controls.update();
            renderer.render(scene, camera);
        };
        animate();
    }

    loadModel(scene: THREE.Scene, modelPath: string, extension: string, config: any, callback: (model: THREE.Object3D) => void) {
        console.log(extension)
        switch (extension) {
            case 'stl':
                const stlLoader = new STLLoader();
                stlLoader.load(modelPath, (geometry) => {
                    const material = new THREE.MeshPhongMaterial({ color: 0x606060, shininess: 100 });
                    const model = new THREE.Mesh(geometry, material);
                    this.applyModelSettings(model, config);
                    scene.add(model);
                    callback(model);
                });
                break;
            case 'glb':
                console.log("Running GLB")
                const gltfLoader = new GLTFLoader();
                gltfLoader.load(modelPath, (gltf) => {
                    const model = gltf.scene;
                    this.applyModelSettings(model, config);
                    scene.add(model);
                    callback(model);
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
            .setName('Standard Scene Color')
            .setDesc('Default background color for 3D scenes')
            .addColorPicker(colorPicker =>
                colorPicker.setValue(this.plugin.settings.standardColor)
                    .onChange(async (value) => {
                        this.plugin.settings.standardColor = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
