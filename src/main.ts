import { Editor, Notice, Plugin, getLinkpath, Modal, App } from 'obsidian';
import * as THREE from 'three';

import { DEFAULT_SETTINGS, ThreeDEmbedSettings, ThreeDSettingsTab } from './settings';
import { ThreeJSRendererChild, getUniqueId, getRenderer } from './rendermanager'
import { initializeThreeJsScene } from './threejsScene';
import { ThreeD_Embed_Command } from './commands/embedCodeblock'

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
        ThreeD_Embed_Command(this)

        const storedData = await this.loadData();
        let hasSeenModal = storedData?.hasSeenUpdateModal || false;
        //hasSeenModal = false //enable it to see the message

        if (!hasSeenModal) {
            new UpdateModal(this.app, async () => {
                await this.saveData({ hasSeenUpdateModal: true });
            }).open();
        }

        this.registerMarkdownCodeBlockProcessor('3D', (source, el, ctx) => {
            // Combine file path, content, and linestart to create a unique ID
            const blockId = getUniqueId(ctx, el); // Block-level unique ID
            const instanceId = `${blockId}:${Date.now()}:${Math.random()}`; // Instance-level unique ID

            const renderer = getRenderer(blockId, instanceId, el);
            // const renderer = new THREE.WebGLRenderer

            const child = new ThreeJSRendererChild(el, blockId, instanceId, this);
            ctx.addChild(child);

            try {
                const parsedData = JSON.parse("{" + source + "}");
                //const modelPath = this.getModelPath(parsedData.name);
                //console.log(parsedData)
                const modelPath = this.getModelPath(parsedData.models[0].name)

                const requiredFields = {
                    // positionX: { name: "x position", example: `"positionX": 0, "positionY": 0, "positionZ": 0,` },
                    // positionY: { name: "y position", example: `"positionX": 0, "positionY": 0, "positionZ": 0,` },
                    // positionZ: { name: "z position", example: `"positionX": 0, "positionY": 0, "positionZ": 0,` },
                    // rotationX: { name: "x rotation", example: `"rotationX": 0, "rotationY": 0, "rotationZ": 0,` },
                    // rotationY: { name: "y rotation", example: `"rotationX": 0, "rotationY": 0, "rotationZ": 0,` },
                    // rotationZ: { name: "z rotation", example: `"rotationX": 0, "rotationY": 0, "rotationZ": 0,` },
                    models: { name: "models", example: `"models": [{"name": "Castle.glb","scale":0.5}]`},
                    //camPosXYZ: { name: "camera Position", example: `"camPosXYZ": [0,5.000000000000002,10],` },
                    //LookatXYZ: { name: "camera lookAt", example: `"LookatXYZ": [0,0,0],` },
                    //backgroundColorHexString: { name: "background color", example: `"backgroundColorHexString": "80bcd6",` },
                    // showGuiOverlay: { name: "gui show", example: `"showGuiOverlay": true,` }
                } as const;

                // Checks if required fields are there
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

                //console.log(modelPath)

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

    onunload() {
        console.log("3D Embed Plugin Unloaded")
    }
}

class UpdateModal extends Modal {
    private onAcknowledge: () => void;

    constructor(app: App, onAcknowledge: () => void) {
        super(app);
        this.onAcknowledge = onAcknowledge;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.style.padding = "10px"
        contentEl.createEl("h2", { text: "3D embed Update" });

        const messagepart1 = contentEl.createEl("p");
        messagepart1.appendText("This is a one-time notification.")

        const messagepart2 = contentEl.createEl("p");
        messagepart2.appendText("You just updated the 3D embed plugin. In this update the syntax of the codeblock with your 3D models has been slightly changed. This causes the old embeds to stop working sadly.")
        
        const messagepart3 = contentEl.createEl("p");
        messagepart3.appendText("This was done to improve your control and streamline the configuration. You can simply fix this by simply executing the embed command again, or (if you want to keep a specific setup) look at the syntax as shown in the")
        const link = messagepart3.createEl("a", { text: " ReadMe", href: "https://github.com/ElmoNeedsArson/Obsidian-3D-embed#readme" });
        link.setAttribute("target", "_blank"); // Opens in a new tab
        messagepart3.appendText(", to change it manually.")

        const messagepart4 = contentEl.createEl("p");
        messagepart4.appendText("Apologies for the inconvenience. But I hope you can keep enjoying the plugin.")

        const closeButton = contentEl.createEl("button", { text: "Okay" });
        closeButton.addEventListener("click", async () => {
            await this.onAcknowledge();
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}