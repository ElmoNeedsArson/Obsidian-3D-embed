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

export function loadModels(plugin: ThreeJSPlugin, scene: THREE.Scene, modelPath: string, extension: string, modelconfig: any, stlconfig: any, materialPath: string): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
        switch (extension) {
            case 'stl':
                const stlLoader = new STLLoader();
                stlLoader.load(modelPath, (geometry) => {
                    let material: any;
                    if (stlconfig.stlColorHexString) {
                        let col2: string;
                        col2 = "#" + stlconfig.stlColorHexString
                        material = new THREE.MeshStandardMaterial({ color: col2 });
                        if (stlconfig.stlWireframe) {
                            material.wireframe = true;
                        }
                    } else {
                        material = new THREE.MeshPhongMaterial({ color: 0x606060, shininess: 100 });
                    }
                    const model = new THREE.Mesh(geometry, material);
                    applyModelConfig(plugin, model, modelconfig);
                    scene.add(model);
                    resolve(model)
                }, undefined, (error) => {
                    new Notice("Failed to load stl model: " + error);
                });
                break;
            case 'glb':
                const gltfLoader = new GLTFLoader();
                gltfLoader.load(modelPath, (gltf) => {
                    const model = gltf.scene;
                    applyModelConfig(plugin, model, modelconfig);
                    scene.add(model);
                    resolve(model)
                }, undefined, (error) => {
                    new Notice("Failed to load glb (GLTF) model: " + error);
                });
                break;
            case 'obj':
                const objLoader = new OBJLoader();
                const mtlLoader = new MTLLoader();

                //console.log("Materialpath: " + materialPath)
                //console.log("conf: " + modelconfig)
                // const MTLpath = modelPath.replace(/\.obj(\?|$)/, ".mtl$1");
                // const cleanMTLPath = MTLpath.split('?')[0];

                if (materialPath === "unknown") {
                    console.log("Loading obj without mtl")
                    objLoader.load(modelPath, (obj) => {
                        obj.traverse((child) => {
                            if (child instanceof THREE.Mesh) {
                                if (!child.material) {
                                    child.material = new THREE.MeshStandardMaterial({ color: 0x606060 });
                                }
                            }
                        });
                        applyModelConfig(plugin, obj, modelconfig);
                        scene.add(obj);
                        resolve(obj);
                    }, undefined, (error) => {
                        new Notice("Failed to load obj model: " + error);
                    });
                } else {
                    console.log("Loading obj with mtl")
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
                            applyModelConfig(plugin, obj, modelconfig);
                            scene.add(obj);
                            resolve(obj)
                        }, undefined, (error) => {
                            new Notice("Failed to load obj model: " + error);
                        });
                    }, undefined, (error) => {
                        new Notice("Failed to load MTL file: " + error);
                        reject(error);
                    });
                }
                break;
            case 'fbx':
                const fbxLoader = new FBXLoader();
                fbxLoader.load(modelPath, (fbx) => {

                    fbx.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            //For some reason, fbx files have weird scaling, so specifically scaling the mesh, makes it work-ish
                            child.scale.set(modelconfig.scale, modelconfig.scale, modelconfig.scale);
                        }
                    });

                    applyModelConfig(plugin, fbx, modelconfig);
                    scene.add(fbx)
                    resolve(fbx)
                }, undefined, (error) => {
                    new Notice("Failed to load fbx model: " + error);
                });
                break;
            case '3mf':
                const ThreeMFloader = new ThreeMFLoader();

                ThreeMFloader.load(modelPath, (ThreeMF) => {
                    applyModelConfig(plugin, ThreeMF, modelconfig);
                    scene.add(ThreeMF);
                    resolve(ThreeMF)
                }, undefined, (error) => {
                    new Notice("Failed to load 3mf model: " + error);
                });
                break;
            default:
                throw new Error("Unsupported model format");
        }
    });
}