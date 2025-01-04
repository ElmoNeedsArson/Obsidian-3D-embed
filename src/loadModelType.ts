import { Notice } from 'obsidian';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

import { applyCameraSettings, applyModelSettings } from './applyConfig'
import ThreeJSPlugin from './main';

export function loadModel(plugin: ThreeJSPlugin, scene: THREE.Scene, modelPath: string, extension: string, config: any, callback: (model: THREE.Object3D) => void) {
    switch (extension) {
        case 'stl':
            const stlLoader = new STLLoader();
            stlLoader.load(modelPath, (geometry) => {
                let material: any;
                if (config.stlColorHexString) {
                    let col2: string;
                    col2 = "#" + config.stlColorHexString
                    material = new THREE.MeshStandardMaterial({ color: col2 });
                    if (config.stlWireframe) {
                        material.wireframe = true;
                    }
                } else {
                    material = new THREE.MeshPhongMaterial({ color: 0x606060, shininess: 100 });
                }
                const model = new THREE.Mesh(geometry, material);
                applyModelSettings(plugin, model, config);
                scene.add(model);
                callback(model);
            }, undefined, (error) => {
                new Notice("Failed to load stl model: " + error);
            });
            break;
        case 'glb':
            const gltfLoader = new GLTFLoader();
            gltfLoader.load(modelPath, (gltf) => {
                const model = gltf.scene;
                applyModelSettings(plugin, model, config);
                scene.add(model);
                callback(model);
            }, undefined, (error) => {
                new Notice("Failed to load glb (GLTF) model: " + error);
            });
            break;
        case 'obj':
            const objLoader = new OBJLoader();
            objLoader.load(modelPath, (obj) => {
                obj.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (!child.material) {
                            child.material = new THREE.MeshStandardMaterial({ color: 0x606060 });
                        }
                    }
                });
                applyModelSettings(plugin, obj, config);
                scene.add(obj);
                callback(obj);
            }, undefined, (error) => {
                new Notice("Failed to load obj model: " + error);
            });
            break;
        case 'fbx':
            const fbxLoader = new FBXLoader();
            fbxLoader.load(modelPath, (fbx) => {

                fbx.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        //For some reason, fbx files have weird scaling, so specifically scaling the mesh, makes it work-ish
                        child.scale.set(config.scale, config.scale, config.scale);
                    }
                });

                applyModelSettings(plugin, fbx, config);
                scene.add(fbx)
                callback(fbx);
            }, undefined, (error) => {
                new Notice("Failed to load fbx model: " + error);
            });
            break;
        case '3mf':
            const ThreeMFloader = new ThreeMFLoader();

            ThreeMFloader.load(modelPath, (ThreeMF) => {
                applyModelSettings(plugin, ThreeMF, config);
                scene.add(ThreeMF);
                callback(ThreeMF);
            }, undefined, (error) => {
                new Notice("Failed to load 3mf model: " + error);
            });
            break;
        default:
            throw new Error("Unsupported model format");
    }
}