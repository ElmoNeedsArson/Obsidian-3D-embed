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

export function getRenderer(blockId: string, instanceId: string, el: HTMLElement): THREE.WebGLRenderer {
    if (!rendererPool.has(blockId)) {
        rendererPool.set(blockId, new Map());
    }

    const blockRenderers = rendererPool.get(blockId)!;

    // If a renderer is currently being disposed, wait before creating a new one
    if (disposingRenderers.has(`${blockId}:${instanceId}`)) {
        // console.warn(`Waiting for disposal to complete before creating a new renderer for ${blockId}`);
        return blockRenderers.get(Array.from(blockRenderers.keys())[0])!; // Reuse an existing one if available
    }

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    blockRenderers.set(instanceId, renderer);
    return renderer;
}

const disposingRenderers = new Set<string>(); // Track renderers currently being disposed

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

            // console.log(Renderer for blockId ${blockId} instanceId ${instanceId} disposed.);
        } catch (error) {
            console.error("Error disposing renderer:", error);
        }
    }

    if (blockRenderers.size === 0) {
        rendererPool.delete(blockId);
    }
}

// function disposeAllRenderers() {
//     // Iterate over all blockIds in the rendererPool
//     for (const [blockId, blockRenderers] of rendererPool.entries()) {
//         // Iterate over all instanceIds in the blockRenderers map
//         for (const [instanceId, renderer] of blockRenderers.entries()) {
//             try {
//                 const gl = renderer.getContext();
//                 if (gl) {
//                     const loseContextExtension = gl.getExtension("WEBGL_lose_context");
//                     if (loseContextExtension) loseContextExtension.loseContext();
//                 }

//                 renderer.dispose();
//                 renderer.domElement?.parentNode?.removeChild(renderer.domElement);
//                 // console.log(`Renderer for blockId ${blockId} instanceId ${instanceId} disposed.`);
//             } catch (error) {
//                 // console.error(`Error disposing renderer for blockId ${blockId} instanceId ${instanceId}:`, error);
//             }
//         }

//         // After disposing all renderers in the block, delete the block from the pool
//         rendererPool.delete(blockId);
//     }
//     // console.log("All renderers have been disposed.");
// }

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