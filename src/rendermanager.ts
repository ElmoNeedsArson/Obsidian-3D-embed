import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice } from 'obsidian';
import * as THREE from 'three';
import ThreeJSPlugin from "./main"; 

let rendererPool: Map<string, Map<string, THREE.WebGLRenderer>> = new Map();

export function getUniqueId(ctx: MarkdownPostProcessorContext, el: HTMLElement): string {
    const filePath = ctx.sourcePath;
    const lineNumber = ctx.getSectionInfo(el)?.lineStart ?? -1;
    const instanceId = `${filePath}:${lineNumber}:${Date.now()}:${Math.random()}`;
    return instanceId;
}

window.onerror = (message, source, lineno, colno, error) => {
    if (message?.toString().includes("'shaderSource' on 'WebGL2RenderingContext'")) {
        console.log("erorrrrr")
        new Notice("A rendering error occurred, too many instances at once, reload obsidian please", 10000)
        // disposeAllRenderers()
        // alert("A rendering error occurred. Please reload the application.");
    }
};


export function getRenderer(blockId: string, instanceId: string, el: HTMLElement): THREE.WebGLRenderer {
    console.log("1")
    if (!rendererPool.has(blockId)) {
        rendererPool.set(blockId, new Map());
    }

    console.log("2")
    const blockRenderers = rendererPool.get(blockId)!;

    console.log("3")
    if (blockRenderers.has(instanceId)) {
        return blockRenderers.get(instanceId)!;
    }

    console.log("4")
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    console.log("5")
    blockRenderers.set(instanceId, renderer);
    console.log("6")
    return renderer;
}

function disposeRenderer(blockId: string, instanceId: string) {
    const blockRenderers = rendererPool.get(blockId);
    if (!blockRenderers) return;

    const renderer = blockRenderers.get(instanceId);
    if (renderer) {
        try {
            const gl = renderer.getContext();
            if (gl) {
                const loseContextExtension = gl.getExtension("WEBGL_lose_context");
                if (loseContextExtension) loseContextExtension.loseContext();
            }

            renderer.dispose();
            renderer.domElement?.parentNode?.removeChild(renderer.domElement);
            blockRenderers.delete(instanceId);

            console.log(`Renderer for blockId ${blockId} instanceId ${instanceId} disposed.`);
        } catch (error) {
            console.error("Error disposing renderer:", error);
        }
    }

    if (blockRenderers.size === 0) {
        rendererPool.delete(blockId);
    }
}

function disposeAllRenderers() {
    // Iterate over all blockIds in the rendererPool
    for (const [blockId, blockRenderers] of rendererPool.entries()) {
        // Iterate over all instanceIds in the blockRenderers map
        for (const [instanceId, renderer] of blockRenderers.entries()) {
            try {
                const gl = renderer.getContext();
                if (gl) {
                    const loseContextExtension = gl.getExtension("WEBGL_lose_context");
                    if (loseContextExtension) loseContextExtension.loseContext();
                }

                renderer.dispose();
                renderer.domElement?.parentNode?.removeChild(renderer.domElement);
                console.log(`Renderer for blockId ${blockId} instanceId ${instanceId} disposed.`);
            } catch (error) {
                console.error(`Error disposing renderer for blockId ${blockId} instanceId ${instanceId}:`, error);
            }
        }

        // After disposing all renderers in the block, delete the block from the pool
        rendererPool.delete(blockId);
    }
    console.log("All renderers have been disposed.");
}


export class ThreeJSRendererChild extends MarkdownRenderChild {
    blockId: string;
    instanceId: string;
    plugin: ThreeJSPlugin;

    constructor(containerEl: HTMLElement, blockId: string, instanceId: string, plugin: ThreeJSPlugin) {
        super(containerEl);
        this.blockId = blockId;
        this.instanceId = instanceId;
        this.plugin = plugin;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.removedNodes) {
                    mutation.removedNodes.forEach((node) => {
                        if (node === containerEl) {
                            this.onunload();
                        }
                    });
                }
            }
        });

        observer.observe(containerEl.parentNode!, { childList: true });
    }

    onunload() {
        disposeRenderer(this.blockId, this.instanceId);
    }
}