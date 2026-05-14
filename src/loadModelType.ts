import { Notice } from 'obsidian';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

import { applyModelConfig } from './applyConfig'
import ThreeJSPlugin from './main';
import { ModelConfig, StlConfig } from './types';

export const SUPPORTED_3D_EXTENSIONS = ['stl', 'glb', 'obj', 'fbx', '3mf'] as const;

export function loadModels(plugin: ThreeJSPlugin, scene: THREE.Scene, modelPath: string, extension: string, modelconfig: ModelConfig, stlconfig: StlConfig | undefined, materialPath: string): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
        const finalize = (loaded: THREE.Object3D) => {
            const wrapper = new THREE.Group();
            wrapper.name = modelconfig.name || "UnnamedModel";
            wrapper.add(loaded);

            applyModelConfig(plugin, wrapper, modelconfig);
            scene.add(wrapper);

            resolve(wrapper);
        };

        switch (extension) {
            case 'stl': {
                const stlLoader = new STLLoader();
                stlLoader.load(modelPath, (geometry) => {
                    let material: THREE.MeshStandardMaterial | THREE.MeshPhongMaterial;
                    if (stlconfig?.stlColorHexString) {
                        let col2: string;
                        col2 = "#" + stlconfig.stlColorHexString
                        material = new THREE.MeshStandardMaterial({ color: col2 });
                        if (stlconfig.stlWireframe) {
                            material.wireframe = true;
                        } else {
                            material.wireframe = plugin.settings.stlWireframe;
                        }
                    } else {
                        material = new THREE.MeshPhongMaterial({ color: plugin.settings.stlColor })
                        material.wireframe = plugin.settings.stlWireframe;
                    }
                    const model = new THREE.Mesh(geometry, material);
                    finalize(model);
                }, undefined, (error) => {
                    console.error("Error loading STL model: ", error);
                    new Notice("Failed to load stl model: " + String(error));
                });
                break;
            }
            case 'glb': {
                const gltfLoader = new GLTFLoader();
                gltfLoader.load(modelPath, (gltf) => {
                    const model = gltf.scene;
                    finalize(model);
                }, undefined, (error) => {
                    new Notice("Failed to load glb (GLTF) model: " + String(error));
                });
                break;
            }
            case 'obj': {
                const objLoader = new OBJLoader();
                const mtlLoader = new MTLLoader();

                if (materialPath === "unknown") {
                    objLoader.load(modelPath, (obj) => {
                        obj.traverse((child) => {
                            if (child instanceof THREE.Mesh) {
                                if (!child.material) {
                                    child.material = new THREE.MeshStandardMaterial({ color: 0x606060 });
                                }
                            }
                        });
                        finalize(obj);
                    }, undefined, (error) => {
                        new Notice("Failed to load obj model: " + String(error));
                    });
                } else {
                    mtlLoader.load(materialPath, (materials) => {
                        materials.preload();
                        objLoader.setMaterials(materials);
                        objLoader.load(modelPath, (obj) => {
                            obj.traverse((child) => {
                                if (child instanceof THREE.Mesh) {
                                    if (!child.material) {
                                        child.material = new THREE.MeshStandardMaterial({ color: 0x606060 });
                                    }
                                }
                            });
                            finalize(obj);
                        }, undefined, (error) => {
                            new Notice("Failed to load obj model: " + String(error));
                        });
                    }, undefined, (error) => {
                        new Notice("Failed to load MTL file: " + String(error));
                        reject(error instanceof Error ? error : new Error(String(error)));
                    });
                }
                break;
            }
            case 'fbx': {
                const fbxLoader = new FBXLoader();
                fbxLoader.load(modelPath, (fbx) => {

                    fbx.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            //For some reason, fbx files have weird scaling, so specifically scaling the mesh, makes it work-ish
                            child.scale.set(modelconfig.scale ?? 1, modelconfig.scale ?? 1, modelconfig.scale ?? 1);
                        }
                    });
                    finalize(fbx);
                }, undefined, (error) => {
                    new Notice("Failed to load fbx model: " + String(error));
                });
                break;
            }
            case '3mf': {
                const ThreeMFloader = new ThreeMFLoader();

                ThreeMFloader.load(modelPath, (ThreeMF) => {
                    finalize(ThreeMF);
                }, undefined, (error) => {
                    new Notice("Failed to load 3mf model: " + String(error));
                });
                break;
            }
            default:
                throw new Error("Unsupported model format");
        }
    });
}
