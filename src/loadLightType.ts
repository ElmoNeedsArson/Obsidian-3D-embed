import * as THREE from 'three';

import ThreeJSPlugin from './main';

export function loadLights(plugin: ThreeJSPlugin, scene: THREE.Scene, type: string, show: boolean, color: string, position: any, strength: number, cam: THREE.Camera, lightconfig: any) {
    //Take color from config or else standardvalue
    let lightColor
    if (color) {
        lightColor = "#" + color
    } else {
        lightColor = plugin.settings.lightSettings[0].color ?? 0xFFFFFF
    }

    let lightColor2
    if (lightconfig.color2) {
        lightColor2 = "#" + lightconfig.color2
    } else {
        lightColor2 = plugin.settings.lightSettings[0].color ?? 0xFFFFFF
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
                //point.position.set(plugin.settings.lightSettings[0].position[0], plugin.settings.lightSettings[0].position[1], plugin.settings.lightSettings[0].position[2])
            }

            if (lightconfig.castShadows) {
                point.castShadow = true;

                point.shadow.camera.near = 0.5;
                point.shadow.camera.far = 100;
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
                //ambient.position.set(plugin.settings.lightSettings[0].position[0], plugin.settings.lightSettings[0].position[1], plugin.settings.lightSettings[0].position[2])
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
                //directional.position.set(plugin.settings.lightSettings[0].position[0], plugin.settings.lightSettings[0].position[1], plugin.settings.lightSettings[0].position[2])
            }

            if (lightconfig.target) {
                directional.target.position.set(lightconfig.target[0], lightconfig.target[1], lightconfig.target[2])
            }

            if (lightconfig.castShadows) {
                directional.castShadow = true;

                directional.shadow.camera.left = -15;
                directional.shadow.camera.right = 15;
                directional.shadow.camera.top = 15;
                directional.shadow.camera.bottom = -15;
                directional.shadow.camera.near = 0.5;
                directional.shadow.camera.far = 100;
            }

            scene.add(directional)

            if (show == true) {
                //const helper = new THREE.DirectionalLightHelper(directional, 5);
                //scene.add(helper);

                // Add shadow camera helper for debugging
                const shadowHelper = new THREE.CameraHelper(directional.shadow.camera);
                scene.add(shadowHelper);
            }
            return directional
        case 'spot':
            let distance;
            let angle;
            let decay;

            if (lightconfig.distance) {
                distance = lightconfig.distance
            } else {
                distance = 10;
            }



            if (lightconfig.angle) {
                let entered_percentage = lightconfig.angle
                if (entered_percentage < 0) entered_percentage = 0;
                if (entered_percentage > 100) entered_percentage = 100;

                angle = (entered_percentage / 100) * (Math.PI / 2);
            } else {
                angle = Math.PI / 6
            }

            if (lightconfig.decay) {
                decay = lightconfig.decay
            } else {
                decay = 0;
            }

            const spot = new THREE.SpotLight(lightColor, lightStrength, distance, angle);
            spot.decay = decay;

            if (lightconfig.target) {
                spot.target.position.set(lightconfig.target[0], lightconfig.target[1], lightconfig.target[2])
            }

            if (lightconfig.castShadows) {
                spot.castShadow = true;

                //spot.angle = Math.PI / 4; // cone width
                spot.penumbra = 0.2;      // softness at edge
                spot.shadow.camera.near = 0.5;
                spot.shadow.camera.far = 100;

            }

            if (position) {
                spot.position.set(position[0], position[1], position[2])
            } else {
                //spot.position.set(plugin.settings.lightSettings[0].position[0], plugin.settings.lightSettings[0].position[1], plugin.settings.lightSettings[0].position[2])
            }

            scene.add(spot);
            if (show == true) {
                const spotLightHelper = new THREE.SpotLightHelper(spot);

                spotLightHelper.scale.set(0.1, 0.1, 0.1)
                scene.add(spotLightHelper);
            }
            return spot
        case 'hemisphere':
            let skyColor = "#" + lightconfig.skyColor || "#FFFFFF";
            let groundColor = "#" + lightconfig.groundColor || "#FFFFFF";
            const hemisphere = new THREE.HemisphereLight(skyColor, groundColor, lightStrength);

            if (show == true) {
                const helper = new THREE.HemisphereLightHelper(hemisphere, 5);
                scene.add(helper);
            }

            scene.add(hemisphere);
            return hemisphere
        case 'attachToCam':
            const AttachToCam = new THREE.DirectionalLight(lightColor, lightStrength);

            AttachToCam.position.set(0, 10, 45);
            if (lightconfig.castShadows) {
                AttachToCam.castShadow = true;

                AttachToCam.shadow.camera.left = -15;
                AttachToCam.shadow.camera.right = 15;
                AttachToCam.shadow.camera.top = 15;
                AttachToCam.shadow.camera.bottom = -15;
                AttachToCam.shadow.camera.near = 0.5;
                AttachToCam.shadow.camera.far = 100;
            }

            cam.add(AttachToCam)
            return AttachToCam
    }
}
