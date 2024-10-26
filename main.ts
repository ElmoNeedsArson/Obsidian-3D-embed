import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
//import * as THREE from 'three';
//const fs = require('fs');

const dataScript = `
// You always receive an input object
console.log("Succesfully loaded script")
console.log("Inputs received: " + input);

// Sets a div to the container that is provided by dataviewjs
const div = input.el.container;

// Gets the correct path to your model file within the vault
const modelPath = app.vault.adapter.getResourcePath("Embed3D/Place Models Here/" + input.name);
const modelType = input.name.substr(input.name.length - 3);
const inputRotationX = input.rotationX;
const inputRotationY = input.rotationY;
const inputRotationZ = input.rotationZ;
const input_positionX = input.positionX;
const input_positionY = input.positionY;
const input_positionZ = input.positionZ;
const scale = input.scale;
const color = input.colorHexString;

runThreeJs()

// Function to load external scripts
function loadScript(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = callback;
    script.onerror = () => console.error('Failed to load script');
    document.head.appendChild(script);
}

function runThreeJs() {
    // Load Three.js, GLTFLoader and Orbitcontrols from the correct CDN
    loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', () => {
        console.log('Three.js loaded');

        loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', () => {
            console.log('OrbitControls loaded');

            threeJS(modelType);

        }, undefined, (error) => {
            console.error('An error happened while loading the OrbitControls', error);
        });
    }, undefined, (error) => {
        console.error('An error happened while loading the Three.js package', error);
    });
}

function threeJS(modelExtension) {
    // Set up scene
    const scene = new THREE.Scene();

    let bckgrndCol = "#" + color;
    console.log(bckgrndCol)
    scene.background = new THREE.Color( bckgrndCol).convertSRGBToLinear();

    // Camera setup (ensure it's properly looking at the scene)
    const camera = new THREE.PerspectiveCamera(75, div.clientWidth / 300, 0.1, 1000);
    camera.position.z = 10;

    // Create a renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(div.clientWidth, 300); // Set the renderer size to fit the div
    div.appendChild(renderer.domElement);

    // Add a basic light source (e.g., directional light)
    const light = new THREE.DirectionalLight(0xffffff, 1); // White light, full intensity
    light.position.set(5, 10, 5); // Position the light
    scene.add(light); // Add the light to the scene

    // Optionally, add ambient light for more balanced lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);  // Dim ambient light
    scene.add(ambientLight);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    if (modelExtension == "stl") {
        loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js', () => {
            console.log('STLLoader loaded');
            const loader = new THREE.STLLoader();
            loader.load(modelPath, (geometry) => {
                //const material = new THREE.MeshStandardMaterial({ color: 0x606060 });
                const material = new THREE.MeshPhongMaterial({ color: 0x606060, shininess: 100 });
                //const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); 
                const model = new THREE.Mesh(geometry, material);

                model.scale.set(scale, scale, scale);  // Adjust the scale if needed
                model.rotation.x = THREE.Math.degToRad(inputRotationX);
                model.rotation.y = THREE.Math.degToRad(inputRotationY);
                model.rotation.z = THREE.Math.degToRad(inputRotationZ);
				model.position.x = input_positionX
                model.position.y = input_positionY
                model.position.z = input_positionZ
                scene.add(model);

                function animate() {
                    requestAnimationFrame(animate);

                    renderer.render(scene, camera);  // Render the scene from the camera's perspective
                }

                animate();
            }, undefined, (error) => {
                console.error('An error happened while loading the model', error);
            });
        });
    } else if (modelExtension == "glb") {
        loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js', () => {
            console.log('GLTFLoader loaded');
            const loader = new THREE.GLTFLoader();
            loader.load(modelPath, (gltf) => {
                console.log('Model loaded');
                const model = gltf.scene;
                model.scale.set(scale, scale, scale);
                model.rotation.x = THREE.Math.degToRad(inputRotationX);
                model.rotation.y = THREE.Math.degToRad(inputRotationY);
                model.rotation.z = THREE.Math.degToRad(inputRotationZ);
				model.position.x = input_positionX
                model.position.y = input_positionY
                model.position.z = input_positionZ

                // Add the model to the scene
                scene.add(model);

                //const controls = new THREE.OrbitControls(camera, renderer.domElement);

                // Animate and render the scene
                function animate() {
                    requestAnimationFrame(animate);

                    renderer.render(scene, camera);  // Render the scene from the camera's perspective
                }

                animate();
            }, undefined, (error) => {
                console.error('An error happened while loading the model', error);
            });
        });
    }

    renderer.render(scene, camera);
}
`

export default class ThreeJSPlugin extends Plugin {
	async onload() {
		console.log("Embed 3D loaded")
		/*const pluginFolderName = "Embed3D"
		const FolderNameForModels = "Place Models Here"

		if (this.app.vault.getFolderByPath(pluginFolderName) == null) {
			console.log("Apparantly " + pluginFolderName + " does not exist yet, creating it...")
			this.app.vault.createFolder(pluginFolderName)
		}

		if (this.app.vault.getFileByPath(pluginFolderName + "/doNotTouch.js") == null) {
			console.log("Creating Script...")
			this.app.vault.create(pluginFolderName + "/doNotTouch.js", dataScript);
		}

		if (this.app.vault.getFolderByPath(pluginFolderName + '/' + FolderNameForModels) == null) {
			this.app.vault.createFolder(pluginFolderName + '/' + FolderNameForModels)
		}

		this.addCommand({
			id: "3DModel",
			name: "3DModel",
			hotkeys: [{ modifiers: ["Alt"], key: "3" }],
			editorCallback: (editor: Editor) => {
				let selection = editor.getSelection();
				if (selection == "") {
					const lineNumber = editor.getCursor().line
					const searchQuery = editor.getLine(lineNumber).trim()
					console.log("Sq: " + searchQuery)

					function mySubString(str: string) {
						let newStr;
						newStr = str.substring(str.indexOf("[") + 1, str.lastIndexOf("]"));
						return newStr;
					}
					let newStr1 = mySubString(searchQuery)
					let newStr2 = mySubString(newStr1)
					selection = newStr2;
					console.log("Newstring: " + newStr2)
				}

				//const searchQuery = doc.getLine(curLineNum).trim()
				let firstLine = "\n```dataviewjs\n"
				let secondLine = 'await dv.view("doNotTouch",{\n'
				let thirdLine = 'el: dv,\n name: "' + selection + '",\n rotationX: 0,\n rotationY: 0,\n rotationZ: 0,\n scale: 0.5,\n colorHexString: "ADD8E6",\n'
				let fourthLine = ' positionX: 0,\n positionY: 0,\n positionZ: 0,\n'
				let lastLine = '});\n```\n'
				let content = firstLine + secondLine + thirdLine + fourthLine + lastLine
				editor.replaceSelection(content);
			},
		});*/

		this.registerMarkdownCodeBlockProcessor('csv', (source, el, ctx) => {
			console.log("codeblock detected")
			const rows = source.split('\n').filter((row) => row.length > 0);

			const table = el.createEl('table');
			const body = table.createEl('tbody');

			for (let i = 0; i < rows.length; i++) {
				const cols = rows[i].split(',');

				const row = body.createEl('tr');

				for (let j = 0; j < cols.length; j++) {
					row.createEl('td', { text: cols[j] });
				}
			}
		})
	}

	onunload() {
		console.log('ThreeJS plugin unloaded');
	}
}
