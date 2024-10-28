import { App, Editor, MarkdownView, Modal, Modifier, Notice, Plugin, PluginSettingTab, Setting, getLinkpath } from 'obsidian';
declare const THREE: any;

interface ThreeDEmbedSetting {
    standardColor: string,
}

const DEFAULT_SETTINGS: Partial<ThreeDEmbedSetting> = {
    standardColor: "#ADD8E6"
};

export default class ThreeJSPlugin extends Plugin {
    settings: ThreeDEmbedSetting;

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new ThreeDSettingsTab(this.app, this));

        console.log("Embed3D Plugin loaded")

        //Quickadd for syntax of rendering 3D model with plugin
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
                let contents = `{\n"name": "` + selection + `",\n"rotationX": 0, "rotationY": 0, "rotationZ": 0, \n"scale": 0.5, \n"colorHexString": "` + this.settings.standardColor.replace(/#/g, "") + `", \n"positionX": 0, "positionY": 0, "positionZ": 0\n}\n`
                let lastLine = '\n```\n'
                let content = firstLine + contents + lastLine
                editor.replaceSelection(content);
            },
        });

        //Registers codeblock for 3D
        this.registerMarkdownCodeBlockProcessor('3D', (source, el, ctx) => {
            //console.log("codeblock detected")
            //console.log(el)

            interface Source3D {
                name: any;
                rotationX: number;
                rotationY: number;
                rotationZ: number;
                scale: number;
                colorHexString: string;
                positionX: number;
                positionY: number;
                positionZ: number;
            }

            //const div = el
            const div = document.createElement('div');
            el.appendChild(div)

            try {
                // Convert the JSON string to an object
                const parsedData: Source3D = JSON.parse(source);

                const path = this.app.metadataCache.getFirstLinkpathDest(getLinkpath(parsedData.name), parsedData.name)
                const modelPath = path ? this.app.vault.getResourcePath(path) : null;

                const modelType = parsedData.name.substr(parsedData.name.length - 3);
                const inputRotationX = parsedData.rotationX;
                const inputRotationY = parsedData.rotationY;
                const inputRotationZ = parsedData.rotationZ;
                const input_positionX = parsedData.positionX;
                const input_positionY = parsedData.positionY;
                const input_positionZ = parsedData.positionZ;
                const scale = parsedData.scale;
                const color = parsedData.colorHexString;

                runThreeJs()

                function loadScript(url: string, callback: () => void): void {
                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = callback;
                    script.onerror = () => console.error('Failed to load script');
                    document.head.appendChild(script);
                }

                function runThreeJs(): void {
                    // Load Three.js, GLTFLoader, and OrbitControls from the correct CDN
                    loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', () => {
                        console.log('Three.js loaded');

                        loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', () => {
                            console.log('OrbitControls loaded');
                            threeJS(modelType);
                        });
                    });
                }

                function threeJS(modelExtension: string): void {
                    // Set up scene
                    const scene = new THREE.Scene();

                    let bckgrndCol = "#" + color;
                    console.log(bckgrndCol);
                    scene.background = new THREE.Color(bckgrndCol).convertSRGBToLinear();

                    // Camera setup
                    const camera = new THREE.PerspectiveCamera(75, div.clientWidth / 300, 0.1, 1000);
                    camera.position.z = 10;

                    // Create a renderer
                    const renderer = new THREE.WebGLRenderer();
                    renderer.setSize(div.clientWidth, 300);
                    div.appendChild(renderer.domElement);

                    // Add light sources
                    const light = new THREE.DirectionalLight(0xffffff, 1);
                    light.position.set(5, 10, 5);
                    scene.add(light);

                    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
                    scene.add(ambientLight);

                    const controls = new THREE.OrbitControls(camera, renderer.domElement);

                    if (modelExtension === "stl") {
                        loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js', () => {
                            console.log('STLLoader loaded');
                            const loader = new THREE.STLLoader();
                            loader.load(modelPath, (geometry: any) => {  // Remove `: THREE.BufferGeometry` type here
                                const material = new THREE.MeshPhongMaterial({ color: 0x606060, shininess: 100 });
                                const model = new THREE.Mesh(geometry, material);

                                model.scale.set(scale, scale, scale);
                                model.rotation.x = THREE.Math.degToRad(inputRotationX);
                                model.rotation.y = THREE.Math.degToRad(inputRotationY);
                                model.rotation.z = THREE.Math.degToRad(inputRotationZ);
                                model.position.set(input_positionX, input_positionY, input_positionZ);
                                scene.add(model);

                                function animate() {
                                    requestAnimationFrame(animate);
                                    renderer.render(scene, camera);
                                }

                                animate();
                            });
                        });
                    } else if (modelExtension === "glb") {
                        loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js', () => {
                            console.log('GLTFLoader loaded');
                            const loader = new THREE.GLTFLoader();
                            loader.load(modelPath, (gltf: any) => {
                                console.log('Model loaded');
                                const model = gltf.scene;
                                model.scale.set(scale, scale, scale);
                                model.rotation.x = THREE.Math.degToRad(inputRotationX);
                                model.rotation.y = THREE.Math.degToRad(inputRotationY);
                                model.rotation.z = THREE.Math.degToRad(inputRotationZ);
                                model.position.set(input_positionX, input_positionY, input_positionZ);

                                scene.add(model);

                                function animate() {
                                    requestAnimationFrame(animate);
                                    renderer.render(scene, camera);
                                }

                                animate();
                            });
                        });
                    }

                    renderer.render(scene, camera);
                }
            } catch (error) {
                console.error('Failed to parse JSON:', error);
            }
        })
    }

    onunload() {
        console.log('ThreeJS plugin unloaded');
    }
}

export class ThreeDSettingsTab extends PluginSettingTab {
    plugin: ThreeJSPlugin;

    constructor(app: App, plugin: ThreeJSPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Standard Scene Color')
            .setDesc('When embedding a model a standard scene color needs to be provided')
            .addColorPicker((colorPicker) =>
                colorPicker
                    //.setValue(this.plugin.settings.highlightColor) // Set the initial color
                    .setValue(this.plugin.settings.standardColor)
                    .onChange(async (value) => {
                        console.log(value)
                        this.plugin.settings.standardColor = value;
                        await this.plugin.saveSettings();
                    })
            )
    }
}
