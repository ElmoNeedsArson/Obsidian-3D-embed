import { Notice, Plugin, getLinkpath, Modal, App, MarkdownView, setIcon, setTooltip, MarkdownPostProcessorContext } from 'obsidian';
import { Direct3DView, DIRECT3D_VIEW_TYPE } from './direct3DView';
import { SUPPORTED_3D_EXTENSIONS } from './loadModelType';

import { DEFAULT_SETTINGS, ThreeDEmbedSettings, ThreeDSettingsTab } from './settings';
import { ThreeJSRendererChild, getUniqueId, getRenderer } from './rendermanager'
import { initializeThreeJsScene } from './threejsScene';
import { ThreeD_Embed_Command } from './commands/embedCodeblock'
import { ThreeD_Embed_Grid_Command } from './commands/embedGridCodeblock'
import { SceneData, ModelConfig, GridConfig } from './types';

export default class ThreeJSPlugin extends Plugin {
    settings: ThreeDEmbedSettings = DEFAULT_SETTINGS;

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Record<string, unknown>);
    }

    async saveSettings() {
        const existingData = (await this.loadData() as Record<string, unknown> | null) ?? {};
        const updatedData = {
            ...existingData,             // preserve extra fields
            ...structuredClone(this.settings), // ensure nested changes get saved
        };
        await this.saveData(updatedData);
    }

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ThreeDSettingsTab(this.app, this));

        // register commands
        ThreeD_Embed_Command(this)
        ThreeD_Embed_Grid_Command(this)

        this.registerView(DIRECT3D_VIEW_TYPE, (leaf) => new Direct3DView(leaf, this));
        this.registerExtensions([...SUPPORTED_3D_EXTENSIONS], DIRECT3D_VIEW_TYPE);

        const data = (await this.loadData()) as { version?: string; [key: string]: unknown } | null;
        if (!data) {
            // Fresh install — no data.json existed before
            // console.log("3D Embed: Fresh install, creating default data.json");
            const newData = { version: this.manifest.version.toString(), ...DEFAULT_SETTINGS };
            await this.saveData(newData);
        } else {
            if (!data.version) {
                // Old user upgrading from <1.0.9
                // console.log("3D Embed: No version found, showing update modal");
                new UpdateModal(this.app, () => {}).open();

                const updatedData = { ...data, version: this.manifest.version.toString() };
                await this.saveData(updatedData);
            } else if (data.version !== this.manifest.version) {
                // Normal version update, already has version field
                // console.log(`3D Embed: Updating plugin data version from ${data.version} to ${this.manifest.version}`);
                const updatedData = { ...data, version: this.manifest.version.toString() };
                await this.saveData(updatedData);
            } else {
                // Everything up to date
                console.log(`3D Embed: Plugin version ${this.manifest.version} loaded`);
            }
        }

        this.registerMarkdownCodeBlockProcessor('3D', (source, el, ctx) => {
            // Combine file path, content, and linestart to create a unique ID
            const blockId = getUniqueId(ctx, el); // Block-level unique ID
            const instanceId = `${blockId}:${Date.now()}:${Math.random()}`; // Instance-level unique ID

            const renderer = getRenderer(blockId, instanceId, el);

            const child = new ThreeJSRendererChild(el, blockId, instanceId, this);
            ctx.addChild(child);

            try {
                const parsedData = JSON.parse("{" + source + "}") as SceneData;
                const modelPath = this.getModelPath(parsedData.models?.[0]?.name ?? "")

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
                                parsedData.models.some((model: ModelConfig) => model[subfield as keyof ModelConfig] === undefined)
                            ) {
                                errors.push(`Please include the "${subfield}" field inside each object in "models". Example: ${example}`);
                            }
                        } else {
                            // Regular object field check (e.g., camera.orthographic)
                            if (parsedData[parentField as keyof typeof parsedData]?.[subfield as never] === undefined) {
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
                const width = el.clientWidth * widthPercentage || el.clientWidth || 300;
                const height = this.settings.standardEmbedHeight || 300;
                const alignment = this.settings.alignment || "center";

                const grid = false;
                const scissor = false;

                createHelperButtons(el, ctx, renderer.domElement, this, parsedData.models?.[0]?.name)

                void initializeThreeJsScene(this, el, parsedData, width, widthPercentage, height, alignment, ctx, renderer, grid, scissor);
            } catch (error) {
                handleCodeblockError(error, source, el)
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
                    const parsedData = JSON.parse("{" + source + "}") as GridConfig;

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
                    const validCells: Record<string, SceneData> = {};

                    const validateScene = (sceneData: SceneData, cellName: string) => {
                        let cellIsValid = true;

                        for (const [parentField, subfields] of Object.entries(requiredSubfields)) {
                            for (const [subfield, example] of Object.entries(subfields)) {
                                const value = sceneData[parentField as keyof SceneData];

                                if (parentField === "models") {
                                    if (!Array.isArray(value)) {
                                        errors.push(`In "${cellName}", "${parentField}" must be an array.`);
                                        cellIsValid = false;
                                        continue;
                                    }

                                    (value as ModelConfig[]).forEach((obj, i: number) => {
                                        if (obj[subfield as keyof ModelConfig] === undefined) {
                                            errors.push(
                                                `In "${cellName}", please include "${subfield}" inside each object in "${parentField}" (item ${i}). Example: ${example}`
                                            );
                                            cellIsValid = false;
                                        }
                                    });
                                } else {
                                    if ((value as Record<string, unknown>)?.[subfield] === undefined) {
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

                    for (const [cellName, cellData] of Object.entries(parsedData)) {
                        if (!cellName.startsWith("cell")) continue;
                        validateScene(cellData as SceneData, cellName);
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

                    createHelperButtons(el, ctx, renderer.domElement, this)

                    void initializeThreeJsScene(this, el, parsedData, width, widthPercentage, height, alignment, ctx, renderer, grid, scissor);

                } catch (error) {
                    handleCodeblockError(error, source, el)
                }
            } else {
                try {
                    const parsedData = JSON.parse("{" + source + "}") as GridConfig;

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
                    const validCells: Record<string, SceneData> = {};

                    const validateScene = (sceneData: SceneData, cellName: string) => {
                        let cellIsValid = true;

                        for (const [parentField, subfields] of Object.entries(requiredSubfields)) {
                            for (const [subfield, example] of Object.entries(subfields)) {
                                const value = sceneData[parentField as keyof SceneData];

                                if (parentField === "models") {
                                    if (!Array.isArray(value)) {
                                        errors.push(`In "${cellName}", "${parentField}" must be an array.`);
                                        cellIsValid = false;
                                        continue;
                                    }

                                    (value as ModelConfig[]).forEach((obj, i: number) => {
                                        if (obj[subfield as keyof ModelConfig] === undefined) {
                                            errors.push(
                                                `In "${cellName}", please include "${subfield}" inside each object in "${parentField}" (item ${i}). Example: ${example}`
                                            );
                                            cellIsValid = false;
                                        }
                                    });
                                } else {
                                    if ((value as Record<string, unknown>)?.[subfield] === undefined) {
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

                    for (const [cellName, cellData] of Object.entries(parsedData)) {
                        if (!cellName.startsWith("cell")) continue;
                        validateScene(cellData as SceneData, cellName);
                    }

                    if (errors.length > 0) {
                        console.error("Validation errors:", errors);
                        throw new Error(errors.join("\n"));
                    }

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
                        el.addClass("ThreeDEmbed_grid_container");
                        el.setCssProps({
                            '--3d-columns': `${columns}`,
                            '--3d-gap': `${parsedData.gridSettings?.gapY || this.settings.gapY || 10}px ${parsedData.gridSettings?.gapX || this.settings.gapX || 10}px`
                        });

                        const width = 50;
                        const widthPercentage = 1 / columns;
                        const height = parsedData.gridSettings?.rowHeight || this.settings.rowHeight || 200;
                        const alignment = "irrelevant";
                        const grid = true;
                        const scissor = false;

                        const removeButton = el.createEl("button", { text: "" });
                        removeButton.addClass("ThreeDEmbed_Codeblock_Remove");

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

                        setIcon(copyButton, "lucide-copy");

                        copyButton.addEventListener("click", () => {
                            void (async () => {
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
                            })();
                        })

                        void initializeThreeJsScene(this, el, cellData, width, widthPercentage, height, alignment, ctx, renderer, grid, scissor, parsedData.gridSettings);
                    }
                } catch (error) {
                    handleCodeblockError(error, source, el)
                }
            }

        });

    }

    getModelPath(name: string): string | null {
        const path = this.app.metadataCache.getFirstLinkpathDest(getLinkpath(name), name);
        return path ? this.app.vault.getResourcePath(path) : null;
    }

    onunload() {
        // console.log("3D Embed Plugin Unloaded")
    }
}

function handleCodeblockError(error: unknown, source: string, el: HTMLElement) {
    const errStr = String(error);
    const errMsg = error instanceof Error ? error.message : errStr;

    let message = errStr.includes("Expected ',' or '}'")
        ? "Please make sure that every line BUT the last one ends with a comma ','"
        : errStr.includes("Expected double")
            ? "The last line should not end with a comma"
            : errMsg;

    const errInfo = parseJsonError(errMsg);

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

function sanitizeModelName(raw: string): string {
    return raw
        .replace(/^\[\[/, "").replace(/\]\]$/, "") // strip wikilink brackets
        .replace(/\.[^.]+$/, "")                   // strip extension
        .replace(/[\\/:*?"<>|]/g, "_");            // replace invalid filename chars
}

function createHelperButtons(el: HTMLElement, ctx: MarkdownPostProcessorContext, canvas: HTMLCanvasElement, plugin: ThreeJSPlugin, modelName?: string) {
    const removeButton = el.createEl("button", { text: "" });
    removeButton.addClass("ThreeDEmbed_Codeblock_Remove");
    setIcon(removeButton, "lucide-trash");
    setTooltip(removeButton, "Remove 3D embed");

    removeButton.addEventListener("click", () => {
        const section = ctx.getSectionInfo(el);
        if (!section) return;

        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        const editor = view.editor;

        const from = { line: section.lineStart, ch: 0 };
        const to = { line: section.lineEnd + 1, ch: 0 }; // +1 to include the closing ```
        editor.replaceRange("", from, to);
    });

    const copyButton = el.createEl("button", { text: "" });
    copyButton.addClass("ThreeDEmbed_Codeblock_Copy");
    setIcon(copyButton, "lucide-copy");
    setTooltip(copyButton, "Copy 3D embed to clipboard");

    copyButton.addEventListener("click", () => {
        void (async () => {
            const section = ctx.getSectionInfo(el);
            if (!section) return;

            const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view) return;
            const editor = view.editor;

            const from = { line: section.lineStart, ch: 0 };
            const to = { line: section.lineEnd + 1, ch: 0 }; // +1 includes closing fence
            const blockText = editor.getRange(from, to);

            await navigator.clipboard.writeText(blockText);
            new Notice("Copied to clipboard!");
        })();
    });

    const exportButton = el.createEl("button", { text: "" });
    exportButton.addClass("ThreeDEmbed_Codeblock_Export");
    setIcon(exportButton, "lucide-camera");
    setTooltip(exportButton, "Export snapshot to vault");

    exportButton.addEventListener("click", () => {
        void (async () => {
            const dataUrl = canvas.toDataURL("image/png");
            const base64 = dataUrl.split(",")[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const noteStem = ctx.sourcePath.replace(/.*\//, "").replace(/\.md$/, "");
            const modelNameBase = modelName ? sanitizeModelName(modelName) : noteStem;
            const folder = plugin.settings.snapshotFolder.replace(/\/$/, "");
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const stem = `${timestamp}-${modelNameBase}-3D-Embed-thumbnail`;
            const filename = folder ? `${folder}/${stem}.png` : `${stem}.png`;

            try {
                if (folder && !plugin.app.vault.getFolderByPath(folder)) {
                    new Notice(`Snapshot folder not found: "${folder}"`);
                    return;
                }

                if (plugin.settings.snapshotOverwrite) {
                    const noteFile = plugin.app.vault.getFileByPath(ctx.sourcePath);
                    if (noteFile) {
                        const fm = plugin.app.metadataCache.getFileCache(noteFile)?.frontmatter;
                        const oldLink: string = (fm?.["3D Embed-thumbnail"] as string | undefined) ?? "";
                        const oldLinktext = oldLink.replace(/^\[\[/, "").replace(/\]\]$/, "");
                        const oldFile = oldLinktext
                            ? plugin.app.metadataCache.getFirstLinkpathDest(oldLinktext, ctx.sourcePath)
                            : null;
                        if (oldFile) {
                            try {
                                await plugin.app.fileManager.trashFile(oldFile);
                            } catch {
                                // old snapshot could not be deleted — proceed with saving the new one
                            }
                        }
                    }
                }

                await plugin.app.vault.createBinary(filename, bytes.buffer);

                if (plugin.settings.snapshotAutoProperty) {
                    const noteFile = plugin.app.vault.getFileByPath(ctx.sourcePath);
                    if (noteFile) {
                        await plugin.app.fileManager.processFrontMatter(noteFile, (fm: Record<string, unknown>) => {
                            fm["3D Embed-thumbnail"] = `[[${stem}.png]]`;
                        });
                    }
                }

                new Notice(`Snapshot saved: ${filename}`);
            } catch (e: unknown) {
                new Notice(`Failed to save snapshot: ${e instanceof Error ? e.message : String(e)}`);
            }
        })();
    });
}

class UpdateModal extends Modal {
    private onAcknowledge: () => void;

    constructor(app: App, onAcknowledge: () => void) {
        super(app);
        this.onAcknowledge = onAcknowledge;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("ThreeDEmbed_modal_content");
        contentEl.createEl("h2", { text: "Welcome to 3d embed" });

        // Introductory text with GitHub link.
        const messagepart2 = contentEl.createEl("p");
        messagepart2.appendText("You just updated/Installed the 3D embed plugin. If you'd like to learn how to control your scenes with more details or suggest new features check out my ");
        const GitHub = messagepart2.createEl("a", { text: "GitHub!", href: "https://github.com/ElmoNeedsArson/Obsidian-3D-embed#readme" });
        GitHub.setAttribute("target", "_blank"); // Opens in a new tab

        const warning = contentEl.createEl("p")
        const calloutEl = warning.createEl("div", { cls: "callout callout-warning" });
        calloutEl.createEl("strong", { text: "Update notice:" });
        const calloutText = calloutEl.createEl("p");
        calloutText.appendText("If you updated from a version older than 1.0.8: this update the syntax of the codeblock has significantly changed. This causes the old embeds to stop working. ");
        calloutText.appendText("To fix this, remove your old codeblock and execute the 3D embed command again.")

        const calloutText2 = calloutEl.createEl("p");
        calloutText2.appendText("Now there is a chance you already put a lot of effort into the current setup of your models, unfortunately if you want to keep this setup, you will have to do a bit of manual work. You can review the updated syntax in the ");
        const readmeLink = calloutText2.createEl("a", { text: "Readme", href: "https://github.com/ElmoNeedsArson/Obsidian-3D-embed#readme" });
        readmeLink.setAttribute("target", "_blank");
        calloutText2.appendText(" and fill in your values for the new syntax.");

        const calloutText3 = calloutEl.createEl("p");
        calloutText3.appendText("Apologies for the inconvenience. But I hope you can keep enjoying the plugin with all its new functions.")

        const messagepart4 = contentEl.createEl("p");
        messagepart4.appendText("Thank you and Enjoy!");

        // Close button.
        const closeButton = contentEl.createEl("button", { text: "Close" });
        closeButton.addEventListener("click", () => {
            this.onAcknowledge();
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
