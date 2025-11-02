import { Editor, Notice, Plugin, getLinkpath, Modal, App, MarkdownView, setIcon } from 'obsidian';

import { DEFAULT_SETTINGS, ThreeDEmbedSettings, ThreeDSettingsTab } from './settings';
import { ThreeJSRendererChild, getUniqueId, getRenderer } from './rendermanager'
import { initializeThreeJsScene } from './threejsScene';
import { ThreeD_Embed_Command } from './commands/embedCodeblock'
import { ThreeD_Embed_Grid_Command } from './commands/embedGridCodeblock'

export default class ThreeJSPlugin extends Plugin {
    settings: ThreeDEmbedSettings;

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        const existingData = await this.loadData() || {};
        const updatedData = {
            ...existingData,             // preserve extra fields
            ...structuredClone(this.settings), // ensure nested changes get saved
        };
        await this.saveData(updatedData);
    }

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ThreeDSettingsTab(this.app, this));

        //adds a code block that instantly adds the 3D scene to your note
        ThreeD_Embed_Command(this)
        ThreeD_Embed_Grid_Command(this)

        const data = await this.loadData(); //delete version from data.json to trigger modal again
        if (data) {
            if (data.version) {
                console.log("3D Embed: Loading Plugin version: " + this.manifest.version);
                if (data.version != this.manifest.version) {
                    const newVersion = this.manifest.version.toString()
                    const updatedData = { ...data, version: newVersion }
                    await this.saveData(updatedData)
                }
                //Potential future option for showing an installation modal
            } else {
                console.log("No version found showing modal")

                new UpdateModal(this.app, async () => {
                    //await this.saveData({ hasSeenUpdateModal: true });
                }).open();

                const existingData = await this.loadData() || {};
                const newVersion = this.manifest.version.toString()
                const updatedData = { ...existingData, version: newVersion };
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

                //Send through the width and height from settings, but in initializeThreeJsScene check if the json contains overrides for it
                let widthPercentage = this.settings.standardEmbedWidthPercentage / 100;
                const width = (ctx as any).el.clientWidth * widthPercentage || (ctx as any).el.clientWidth || 300;
                const height = this.settings.standardEmbedHeight || 300;
                const alignment = this.settings.alignment || "center";

                const grid = false;
                const scissor = false;

                const removeButton = el.createEl("button", { text: "" });
                removeButton.addClass("ThreeDEmbed_Codeblock_Remove");
                removeButton.style.background = "none";
                removeButton.style.boxShadow = "none";

                setIcon(removeButton, "lucide-trash");

                removeButton.addEventListener("click", () => {
                    const section = ctx.getSectionInfo(el);
                    if (!section) return;

                    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (!view) return;
                    const editor = view.editor;

                    const from = { line: section.lineStart, ch: 0 };
                    const to = { line: section.lineEnd + 1, ch: 0 }; // +1 to include the closing ```
                    editor.replaceRange("", from, to);
                });

                const copyButton = el.createEl("button", { text: "" });
                copyButton.addClass("ThreeDEmbed_Codeblock_Copy");
                copyButton.style.background = "none";
                copyButton.style.boxShadow = "none";

                setIcon(copyButton, "lucide-copy");

                copyButton.addEventListener("click", async () => {
                    const section = ctx.getSectionInfo(el);
                    if (!section) return;

                    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (!view) return;
                    const editor = view.editor;

                    const from = { line: section.lineStart, ch: 0 };
                    const to = { line: section.lineEnd + 1, ch: 0 }; // +1 includes closing fence
                    const blockText = editor.getRange(from, to);

                    await navigator.clipboard.writeText(blockText);
                    new Notice("Copied to clipboard!");
                })

                initializeThreeJsScene(this, el, parsedData, width, widthPercentage, height, alignment, ctx, renderer, grid, scissor);
            } catch (error) {
                let message = error.toString().includes("Expected ',' or '}'")
                    ? "Please make sure that every line BUT the last one ends with a comma ','"
                    : error.toString().includes("Expected double")
                        ? "The last line should not end with a comma"
                        : error.message;

                const errInfo = parseJsonError(error.message);

                if (errInfo) {
                    const lines = source.split("\n");
                    const errorLine = lines[errInfo.line - 2]?.trim() || "(unknown)";
                    message = `There is an error on line ${errInfo.line}: \n${errorLine}`;
                    let codeBlockMessage = `3D Embed\nThere is an error on line ${errInfo.line}: \n${errorLine}`;
                    let reasons = `\n
Possible reasons:
- A missing comma at the end of the line
- A comma too much at the end of the line
- A missing or extra quotation mark (" or ')
- An opening or closing brace ({ } [ ]) is missing or too many
- A typo in variable names (Look at the plugin description or README for variable names)
- If none of this works, just redo the command`

                    el.classList.add("json-error-container");
                    el.dataset.errorLine = codeBlockMessage + reasons;
                }

                new Notice("Failed to render 3D model: " + message, 10000);
            }
        });

        this.registerMarkdownCodeBlockProcessor('3D-grid', (source, el, ctx) => {
            if (this.settings.scissor) {
                // Combine file path, content, and linestart to create a unique ID
                const blockId = getUniqueId(ctx, el); // Block-level unique ID
                const instanceId = `${blockId}:${Date.now()}:${Math.random()}`; // Instance-level unique ID

                const renderer = getRenderer(blockId, instanceId, el);
                // const renderer = new THREE.WebGLRenderer

                // Doing this because the child needs to be registered before initializeThreeJsScene is called or smth, i dont recall tbh
                const child = new ThreeJSRendererChild(el, blockId, instanceId, this);
                ctx.addChild(child);

                try {
                    const parsedData = JSON.parse("{" + source + "}");

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
                    const validCells: Record<string, any> = {};

                    const validateScene = (sceneData: any, cellName: string) => {
                        let cellIsValid = true;

                        for (const [parentField, subfields] of Object.entries(requiredSubfields)) {
                            for (const [subfield, example] of Object.entries(subfields)) {
                                const value = sceneData[parentField];

                                if (parentField === "models") {
                                    if (!Array.isArray(value)) {
                                        errors.push(`In "${cellName}", "${parentField}" must be an array.`);
                                        cellIsValid = false;
                                        continue;
                                    }

                                    value.forEach((obj: any, i: number) => {
                                        if (obj[subfield] === undefined) {
                                            errors.push(
                                                `In "${cellName}", please include "${subfield}" inside each object in "${parentField}" (item ${i}). Example: ${example}`
                                            );
                                            cellIsValid = false;
                                        }
                                    });
                                } else {
                                    if (value?.[subfield] === undefined) {
                                        errors.push(
                                            `In "${cellName}", please include "${subfield}" inside "${parentField}". Example: ${example}`
                                        );
                                        cellIsValid = false;
                                    }
                                }
                            }
                        }

                        if (cellIsValid) validCells[cellName] = sceneData;
                    };

                    // 🩻 Step 1 — Validation loop
                    for (const [cellName, cellData] of Object.entries(parsedData)) {
                        if (!cellName.startsWith("cell")) continue;
                        validateScene(cellData, cellName);
                    }

                    if (errors.length > 0) {
                        console.error("Validation errors:", errors);
                        throw new Error(errors.join("\n"));
                    }

                    const columns = parsedData.gridSettings?.columns || this.settings.columnsAmount || 4;
                    const width = 50;
                    const widthPercentage = 1 / columns;
                    const height = 400;
                    const alignment = "irrelevant";
                    const grid = true;
                    const scissor = true;

                    //renderer.setScissorTest(true);

                    initializeThreeJsScene(this, el, parsedData, width, widthPercentage, height, alignment, ctx, renderer, grid, scissor);
                } catch (error) {
                    let message = error.toString().includes("Expected ',' or '}'")
                        ? "Please make sure that every line BUT the last one ends with a comma ','"
                        : error.toString().includes("Expected double")
                            ? "The last line should not end with a comma"
                            : error.message;

                    const errInfo = parseJsonError(error.message);

                    if (errInfo) {
                        const lines = source.split("\n");
                        const errorLine = lines[errInfo.line - 2]?.trim() || "(unknown)";
                        message = `There is an error on line ${errInfo.line}: \n${errorLine}`;
                        let codeBlockMessage = `3D Embed\nThere is an error on line ${errInfo.line}: \n${errorLine}`;
                        let reasons = `\n
Possible reasons:
- A missing comma at the end of the line
- A comma too much at the end of the line
- A missing or extra quotation mark (" or ')
- An opening or closing brace ({ } [ ]) is missing or too many
- A typo in variable names (Look at the plugin description or README for variable names)
- If none of this works, just redo the command`

                        el.classList.add("json-error-container");
                        el.dataset.errorLine = codeBlockMessage + reasons;
                    }

                    new Notice("Failed to render 3D model: " + message, 10000);
                }
            } else {
                try {
                    const parsedData = JSON.parse("{" + source + "}");

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
                    const validCells: Record<string, any> = {};

                    const validateScene = (sceneData: any, cellName: string) => {
                        let cellIsValid = true;

                        for (const [parentField, subfields] of Object.entries(requiredSubfields)) {
                            for (const [subfield, example] of Object.entries(subfields)) {
                                const value = sceneData[parentField];

                                if (parentField === "models") {
                                    if (!Array.isArray(value)) {
                                        errors.push(`In "${cellName}", "${parentField}" must be an array.`);
                                        cellIsValid = false;
                                        continue;
                                    }

                                    value.forEach((obj: any, i: number) => {
                                        if (obj[subfield] === undefined) {
                                            errors.push(
                                                `In "${cellName}", please include "${subfield}" inside each object in "${parentField}" (item ${i}). Example: ${example}`
                                            );
                                            cellIsValid = false;
                                        }
                                    });
                                } else {
                                    if (value?.[subfield] === undefined) {
                                        errors.push(
                                            `In "${cellName}", please include "${subfield}" inside "${parentField}". Example: ${example}`
                                        );
                                        cellIsValid = false;
                                    }
                                }
                            }
                        }

                        if (cellIsValid) validCells[cellName] = sceneData;
                    };

                    // 🩻 Step 1 — Validation loop
                    for (const [cellName, cellData] of Object.entries(parsedData)) {
                        if (!cellName.startsWith("cell")) continue;
                        validateScene(cellData, cellName);
                    }

                    if (errors.length > 0) {
                        console.error("Validation errors:", errors);
                        throw new Error(errors.join("\n"));
                    }

                    //Send through the width and height from settings, but in initializeThreeJsScene check if the json contains overrides for it
                    let widthPercentage = this.settings.standardEmbedWidthPercentage / 100;
                    const width = (ctx as any).el.clientWidth * widthPercentage || (ctx as any).el.clientWidth || 300;
                    const height = this.settings.standardEmbedHeight || 300;
                    const alignment = this.settings.alignment || "center";

                    // Step 2 — Initialization loop (your renderer logic per cell)
                    for (const [cellName, cellData] of Object.entries(validCells)) {
                        if (!cellName.startsWith("cell")) continue;

                        // This is your original logic, now inside the per-cell loop
                        const blockId = getUniqueId(ctx, el);
                        const instanceId = `${blockId}:${Date.now()}:${Math.random()}`;

                        const renderer = getRenderer(blockId, instanceId, el);
                        const child = new ThreeJSRendererChild(el, blockId, instanceId, this);
                        ctx.addChild(child);

                        //const columns = 4; // desired number of columns // SHOULD THIS BE MOVED OUTSIDE LOOP?
                        const columns = parsedData.gridSettings?.columns || this.settings.columnsAmount || 4;
                        el.style.display = 'grid';
                        el.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
                        //el.style.gap = '1rem';
                        el.style.gap = `${parsedData.gridSettings?.gapY || this.settings.gapY || 10}px ${parsedData.gridSettings?.gapX || this.settings.gapX || 10}px`

                        const modelPath = this.getModelPath(cellData.models[0].name);
                        const width = 50;
                        const widthPercentage = 1 / columns;
                        const height = parsedData.gridSettings?.rowHeight || this.settings.rowHeight || 200;
                        const alignment = "irrelevant";
                        const grid = true;
                        const scissor = false;
                        initializeThreeJsScene(this, el, cellData, width, widthPercentage, height, alignment, ctx, renderer, grid, scissor, parsedData.gridSettings);
                    }
                } catch (error) {
                    let message = error.toString().includes("Expected ',' or '}'")
                        ? "Please make sure that every line BUT the last one ends with a comma ','"
                        : error.toString().includes("Expected double")
                            ? "The last line should not end with a comma"
                            : error.message;

                    const errInfo = parseJsonError(error.message);

                    if (errInfo) {
                        const lines = source.split("\n");
                        const errorLine = lines[errInfo.line - 2]?.trim() || "(unknown)";
                        message = `There is an error on line ${errInfo.line}: \n${errorLine}`;
                        let codeBlockMessage = `3D Embed\nThere is an error on line ${errInfo.line}: \n${errorLine}`;
                        let reasons = `\n
Possible reasons:
- A missing comma at the end of the line
- A comma too much at the end of the line
- A missing or extra quotation mark (" or ')
- An opening or closing brace ({ } [ ]) is missing or too many
- A typo in variable names (Look at the plugin description or README for variable names)
- If none of this works, just redo the command`

                        el.classList.add("json-error-container");
                        el.dataset.errorLine = codeBlockMessage + reasons;
                    }

                    new Notice("Failed to render 3D model: " + message, 10000);
                }
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
        messagepart2.appendText("You just updated/Installed the 3D embed plugin. If you'd like to learn how to control your scenes with more details or suggest new features check out my ");
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
        calloutText.appendText("If you updated from a version older than 1.0.8: this update the syntax of the codeblock has significantly changed. This causes the old embeds to stop working. ");
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

function parseJsonError(errorMessage: string) {
    const regex = /at position (\d+) \(line (\d+) column (\d+)\)/;
    const match = errorMessage.match(regex);
    if (!match) return null;

    const [, position, line, column] = match.map(Number);
    return { position, line, column };
}
