import { FileView, WorkspaceLeaf, TFile } from 'obsidian';
import * as THREE from 'three';
import { SUPPORTED_3D_EXTENSIONS } from './loadModelType';
import { initializeThreeJsScene } from './threejsScene';
import ThreeJSPlugin from './main';

export const DIRECT3D_VIEW_TYPE = "threedEmbed-direct3D-view";

export class Direct3DView extends FileView {
    private plugin: ThreeJSPlugin;
    private renderer: THREE.WebGLRenderer | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: ThreeJSPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return DIRECT3D_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.file ? this.file.name : "3D Viewer";
    }

    canAcceptExtension(extension: string): boolean {
        return (SUPPORTED_3D_EXTENSIONS as readonly string[]).includes(extension);
    }

    async onLoadFile(file: TFile) {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();

        // Dispose any previous renderer before creating a new one
        this.disposeCurrentRenderer();

        container.style.overflow = "hidden";
        const wrapper = container.createDiv();
        wrapper.style.height = "97%";

        const config = {
            models: [{
                name: file.path
            }],
        };

        //TODO: test all global settings on whether applied

        // Defer until after the browser has laid out the DOM so that
        // clientWidth/clientHeight return real values instead of 0.
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        const widthPercentage = 0.97;
        const width = container.clientWidth || 800;
        const initialHeight = container.clientHeight || 600;
        const alignment = "center";

        this.renderer = new THREE.WebGLRenderer({ alpha: true });
        this.renderer.setSize(width, initialHeight);
        wrapper.appendChild(this.renderer.domElement);

        await initializeThreeJsScene(
            this.plugin, wrapper, config,
            width, widthPercentage, "fill:97", alignment,
            null, this.renderer, false, false
        );
    }

    async onUnloadFile(_file: TFile) {
        this.disposeCurrentRenderer();
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
    }

    private disposeCurrentRenderer() {
        if (!this.renderer) return;
        try {
            const gl = this.renderer.getContext();
            const loseCtx = gl.getExtension("WEBGL_lose_context");
            if (loseCtx) loseCtx.loseContext();
            this.renderer.dispose();
            this.renderer.domElement?.parentNode?.removeChild(this.renderer.domElement);
        } catch (e) {
            console.error("Direct3DView: error disposing renderer", e);
        }
        this.renderer = null;
    }
}
