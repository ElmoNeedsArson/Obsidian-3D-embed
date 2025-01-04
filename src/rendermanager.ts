import { MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
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

    if (blockRenderers.has(instanceId)) {
        return blockRenderers.get(instanceId)!;
    }

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    blockRenderers.set(instanceId, renderer);
    return renderer;
}

function disposeRenderer(blockId: string, instanceId: string) {
    const blockRenderers = rendererPool.get(blockId);
    if (!blockRenderers) return;

    const renderer = blockRenderers.get(instanceId);
    if (renderer) {
        const gl = renderer.getContext();
        if (gl) {
            const loseContextExtension = gl.getExtension("WEBGL_lose_context");
            if (loseContextExtension) loseContextExtension.loseContext();
        }

        renderer.dispose();
        renderer.domElement?.parentNode?.removeChild(renderer.domElement);
        blockRenderers.delete(instanceId);

        console.log(`Renderer for blockId ${blockId} instanceId ${instanceId} disposed.`);
    }

    if (blockRenderers.size === 0) {
        rendererPool.delete(blockId);
    }
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