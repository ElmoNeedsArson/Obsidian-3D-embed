import * as THREE from 'three';

import ThreeJSPlugin from './main';

export function loadLights(plugin: ThreeJSPlugin, scene: THREE.Scene, type: string, show: boolean, color: string, position: any, strength: number, cam: any) {
    //Take color from config or else standardvalue
    let lightColor
    if (color) {
        lightColor = "#" + color
    } else {
        lightColor = plugin.settings.lightSettings[0].color ?? 0xFFFFFF
    }

    //Set light strength
    let lightStrength
    if (strength) {
        lightStrength = strength
    } else if (strength == 0) {
        lightStrength = 0
    } else {
        lightStrength = plugin.settings.lightSettings[0].intensity ?? 1
    }

    //Show indicator for light if true
    // if (show == true) {
    //     const lightIndicator_Geometry = new THREE.SphereGeometry(1)
    //     const lightIndicator_material = new THREE.MeshBasicMaterial({ color: lightColor });
    //     const lightIndicator = new THREE.Mesh(lightIndicator_Geometry, lightIndicator_material);
    //     lightIndicator.position.set(position[0] ?? plugin.settings.lightSettings[0].position[0], position[1] ?? plugin.settings.lightSettings[0].position[1], position[2] ?? plugin.settings.lightSettings[0].position[2]);
    //     scene.add(lightIndicator);
    // }

    switch (type) {
        case 'point':
            const point = new THREE.PointLight(lightColor, lightStrength);

            if (position) {
                point.position.set(position[0], position[1], position[2])
            } else {
                point.position.set(plugin.settings.lightSettings[0].position[0], plugin.settings.lightSettings[0].position[1], plugin.settings.lightSettings[0].position[2])
            }

            scene.add(point)
            if (show == true) {
                const sphereSize = 1;
                const pointLightHelper = new THREE.PointLightHelper(point, sphereSize);
                scene.add(pointLightHelper);
            }
            return point
            break;
        case 'ambient':
            const ambient = new THREE.AmbientLight(lightColor, lightStrength);

            if (position) {
                ambient.position.set(position[0], position[1], position[2])
            } else {
                ambient.position.set(plugin.settings.lightSettings[0].position[0], plugin.settings.lightSettings[0].position[1], plugin.settings.lightSettings[0].position[2])
            }

            scene.add(ambient)
            //callback(ambient);
            return ambient
            break;
        case 'directional':
            const directional = new THREE.DirectionalLight(lightColor, lightStrength);

            if (position) {
                directional.position.set(position[0], position[1], position[2])
            } else {
                directional.position.set(plugin.settings.lightSettings[0].position[0], plugin.settings.lightSettings[0].position[1], plugin.settings.lightSettings[0].position[2])
            }

            scene.add(directional)
            if (show == true) {
                const helper = new THREE.DirectionalLightHelper(directional, 5);
                scene.add(helper);
            }
            return directional
        case 'attachToCam':
            const AttachToCam = new THREE.DirectionalLight(lightColor, lightStrength);

            AttachToCam.position.set(0, 10, 45);
            AttachToCam.castShadow = true;

            cam.add(AttachToCam)
            //callback(AttachToCam);
            return AttachToCam
    }
}
