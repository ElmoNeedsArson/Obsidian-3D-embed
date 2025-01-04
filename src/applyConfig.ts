import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import ThreeJSPlugin from './main';

export function applyCameraSettings(cam: any, config: any, controls: OrbitControls) {
    if (config.camPosXYZ) {
        cam.position.x = config.camPosXYZ[0];
        cam.position.y = config.camPosXYZ[1];
        cam.position.z = config.camPosXYZ[2];
    } else {
        cam.position.x = 0
        cam.position.y = 5
        cam.position.z = 10
    }
    if (config.LookatXYZ) {
        controls.target.set(config.LookatXYZ[0], config.LookatXYZ[1], config.LookatXYZ[2])
    } else {
        controls.target.set(0, 0, 0)
    }
}

export function applyModelSettings(plugin: ThreeJSPlugin, model: THREE.Object3D, config: any) {
    model.scale.set(config.scale || plugin.settings.standardScale || 1, config.scale || plugin.settings.standardScale || 1, config.scale || plugin.settings.standardScale || 1);
    model.rotation.x = THREE.MathUtils.degToRad(config.rotationX || 0);
    model.rotation.y = THREE.MathUtils.degToRad(config.rotationY || 0);
    model.rotation.z = THREE.MathUtils.degToRad(config.rotationZ || 0);
    model.position.set(config.positionX || 0, config.positionY || 0, config.positionZ || 0);
}