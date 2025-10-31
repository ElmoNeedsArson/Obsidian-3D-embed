import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import ThreeJSPlugin from './main';

export function applyCameraSettings(cam: THREE.Camera, config: any, controls: OrbitControls) {
    if (config.camera.camPosXYZ) {
        cam.position.x = config.camera.camPosXYZ[0];
        cam.position.y = config.camera.camPosXYZ[1];
        cam.position.z = config.camera.camPosXYZ[2];
    } else {
        cam.position.x = 0
        cam.position.y = 5
        cam.position.z = 10
    }
    if (config.camera.LookatXYZ) {
        controls.target.set(config.camera.LookatXYZ[0], config.camera.LookatXYZ[1], config.camera.LookatXYZ[2])
    } else {
        controls.target.set(0, 0, 0)
    }
}

export function applyModelConfig(plugin: ThreeJSPlugin, model: THREE.Object3D, modelconfig: any) {
    model.scale.set(modelconfig.scale || plugin.settings.standardScale || 1, modelconfig.scale || plugin.settings.standardScale || 1, modelconfig.scale || plugin.settings.standardScale || 1);
    model.rotation.set(THREE.MathUtils.degToRad(modelconfig.rotation[0]) || 0, THREE.MathUtils.degToRad(modelconfig.rotation[1]) || 0, THREE.MathUtils.degToRad(modelconfig.rotation[2]) || 0);
    model.position.set(modelconfig.position[0] || 0, modelconfig.position[1] || 0, modelconfig.position[2] || 0);
}