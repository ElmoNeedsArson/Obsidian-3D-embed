import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as THREE from 'three';

export default class ThreeJSPlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: 'insert-threejs-scene',
			name: 'Insert Three.js Scene',
			callback: () => this.insertThreeJSScene()
		});

		this.addCommand({
			id: "3DModel",
			name: "3DModel",
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				let firstLine = "```dataviewjs\n"
				let secondLine = 'await dv.view("threejsinobsidian",{\n'
				let thirdLine = 'el: dv,\n name: "' + selection + '",\n rotationX: 0,\n rotationY: 0,\n rotationZ: 0,\n scale: 0.5,\n'
				let lastLine = '});\n```\n'
				let content = firstLine + secondLine + thirdLine + lastLine
				editor.replaceSelection(content);
			},
		});
	}

	insertThreeJSScene() {
		console.log("1")
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			return;
		}
		console.log("2")

		const editor = activeView.editor;
		const sceneID = `threejs-scene-${Date.now()}`;
		console.log("3")

		// Insert a placeholder for the Three.js scene
		editor.replaceSelection(`<div id="${sceneID}" class="threejs-scene" style="width: 100%; height: 400px;"></div>\n`);
		console.log("4")
		// Refresh the preview to show the changes (re-render the view)
		// activeView.previewMode.rerender();

		console.log("5")

		// Listen for the markdown render event to inject the Three.js scene into preview
		//this.registerMarkdownPostProcessor((element, context) => {
		// Find the div with the specific class (that we inserted in the markdown)
		const container = document.querySelector('.threejs-scene') as HTMLElement;
		if (container) {
			this.loadThreeJSScene(container);
		}
		//});

	}

	loadThreeJSScene(container: HTMLElement) {
		console.log("Loading threejs scene")
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / 400, 0.1, 1000);
		const renderer = new THREE.WebGLRenderer();

		renderer.setSize(container.offsetWidth, 400);
		container.appendChild(renderer.domElement);

		const geometry = new THREE.BoxGeometry();
		const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
		const cube = new THREE.Mesh(geometry, material);
		scene.add(cube);

		camera.position.z = 5;

		function animate() {
			requestAnimationFrame(animate);
			cube.rotation.x += 0.01;
			cube.rotation.y += 0.01;
			renderer.render(scene, camera);
		}

		animate();
	}

	onunload() {
		console.log('ThreeJS plugin unloaded');
	}
}
