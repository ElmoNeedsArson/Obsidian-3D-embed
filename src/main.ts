import { Editor, Notice, Plugin, getLinkpath, Modal, App } from 'obsidian';

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
        const existingData = await this.loadData() || {};
        const updatedData = { ...existingData, ...this.settings };
        await this.saveData(updatedData);

       // await this.saveData(this.settings);
    }

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ThreeDSettingsTab(this.app, this));

        //adds a code block that instantly adds the 3D scene to your note
        ThreeD_Embed_Command(this)

        // const storedData = await this.loadData();
        // let hasSeenModal = storedData?.hasSeenUpdateModal || false;
        // //hasSeenModal = false //enable it to see the message

        // if (!hasSeenModal) {
        //     new UpdateModal(this.app, async () => {
        //         await this.saveData({ hasSeenUpdateModal: true });
        //     }).open();
        // }

        const data = await this.loadData(); //delete version from data.json to trigger modal again
        if (data) {
            if (data.version) {
                console.log("Loaded version:", data.version);
                //Potential future option for showing an installation modal
            } else {
                console.log("No version found showing modal")

                new UpdateModal(this.app, async () => {
                    //await this.saveData({ hasSeenUpdateModal: true });
                }).open();

                const existingData = await this.loadData() || {};
                const updatedData = { ...existingData, version: "1.0.8" };
                await this.saveData(updatedData);
            }
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
                const modelPath = this.getModelPath(parsedData.models[0].name)

                const requiredSubfields = {
                    camera: {
                        LookatXYZ: `"LookatXYZ": [0,0,0]`,
                        camPosXYZ: `"camPosXYZ": [0,5,10]`
                    },
                    models: {
                        name: `"name": "model.stl"`,
                        scale: `"scale": 0.5`,
                        position: `"position": [0, 0, 0]`,
                        rotation: `"rotation": [0, 0, 0]`
                    }
                } as const;

                // Validate required subfields
                const errors: string[] = [];

                for (const [parentField, subfields] of Object.entries(requiredSubfields)) {
                    for (const [subfield, example] of Object.entries(subfields)) {
                        if (parentField === "models") {
                            // Models is an array, ensure we type 'model' properly
                            if (
                                !Array.isArray(parsedData.models) ||
                                parsedData.models.some((model: { [key: string]: any }) => model[subfield] === undefined)
                            ) {
                                errors.push(`Please include the "${subfield}" field inside each object in "models". Example: ${example}`);
                            }
                        } else {
                            // Regular object field check (e.g., camera.orthographic)
                            if (parsedData[parentField as keyof typeof parsedData]?.[subfield] === undefined) {
                                errors.push(`Please include the "${subfield}" field inside "${parentField}". Example: ${example}`);
                            }
                        }
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
                //console.log("width:" + this.settings.standardEmbedWidthPercentage)

                //Send through the width and height from settings, but in initializeThreeJsScene check if the json contains overrides for it
                let widthPercentage = this.settings.standardEmbedWidthPercentage / 100;
                const width = (ctx as any).el.clientWidth * widthPercentage || (ctx as any).el.clientWidth || 300;
                const height = this.settings.standardEmbedHeight || 300;
                const alignment = this.settings.alignment || "center";

                //codeblock[0].style.maxWidth = "50%";

                //console.log("Calculated width: " + width)
                //console.log("Calculated width_el: " + (ctx as any).el.clientWidth)

                //get width percentage from settings, or from json block, multiply el width with it. 
                initializeThreeJsScene(this, el, parsedData, modelPath, parsedData.name, width, widthPercentage, height, alignment, ctx, renderer);

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
        contentEl.style.padding = "10px";
        contentEl.createEl("h2", { text: "Welcome to 3D Embed" });

        // Introductory text with GitHub link.
        const messagepart2 = contentEl.createEl("p");
        messagepart2.appendText("You just updated the 3D embed plugin. If you'd like to learn how to control your scenes with more details or suggest new features check out my ");
        const GitHub = messagepart2.createEl("a", { text: "GitHub!", href: "https://github.com/ElmoNeedsArson/Obsidian-3D-embed#readme" });
        GitHub.setAttribute("target", "_blank"); // Opens in a new tab

        // Dropdown callout using a details element.
        //const detailsEl = contentEl.createEl("details");
        //const summaryEl = detailsEl.createEl("summary", { text: "If you just updated from 1.0.7 or older to a newer version, click here!" });

        const warning = contentEl.createEl("p")
        // The callout content – you can apply custom CSS to the classes below.
        const calloutEl = warning.createEl("div", { cls: "callout callout-warning" });
        calloutEl.createEl("strong", { text: "Update Notice:" });
        const calloutText = calloutEl.createEl("p");
        calloutText.appendText("In this update the syntax of the codeblock has significantly changed. This causes the old embeds to stop working. ");
        calloutText.appendText("To fix this, remove your old codeblock and execute the 3D embed command again.")

        const calloutText2 = calloutEl.createEl("p");
        calloutText2.appendText("Now there is a chance you already put a lot of effort into the current setup of your models, unfortunately if you want to keep this setup, you will have to do a bit of manual work. You can review the updated syntax in the ");
        const readmeLink = calloutText2.createEl("a", { text: "ReadMe", href: "https://github.com/ElmoNeedsArson/Obsidian-3D-embed#readme" });
        readmeLink.setAttribute("target", "_blank");
        calloutText2.appendText(" and fill in your values for the new syntax.");

        const calloutText3 = calloutEl.createEl("p");
        calloutText3.appendText("Apologies for the inconvenience. But I hope you can keep enjoying the plugin with all its new functions.")

        // Additional apology message.
        const messagepart4 = contentEl.createEl("p");
        messagepart4.appendText("Thank you and Enjoy!");

        // Close button.
        const closeButton = contentEl.createEl("button", { text: "Close" });
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
