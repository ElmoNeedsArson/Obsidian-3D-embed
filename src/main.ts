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
import { loadModel } from './loadModelType'
import { initializeThreeJsScene } from './threejsScene';

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
                initializeThreeJsScene(this, el, parsedData, modelPath, parsedData.name, width, ctx, renderer);

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


