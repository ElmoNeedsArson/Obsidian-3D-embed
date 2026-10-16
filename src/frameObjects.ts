import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const activeAnimations = new WeakMap<THREE.Camera, number>();

export function frameObjects(
    camera: THREE.Camera,
    controls: OrbitControls,
    objects: THREE.Object3D[],
    padding = 1.25,
    duration = 600
) {
    const bounds = new THREE.Box3();
    for (const object of objects) {
        object.updateWorldMatrix(true, true);
        bounds.expandByObject(object);
    }

    if (bounds.isEmpty()) return;

    const center = bounds.getCenter(new THREE.Vector3());
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 0.0001);
    const fitPadding = Math.max(padding, 1);
    const direction = camera.position.clone().sub(controls.target);

    if (direction.lengthSq() < 1e-6) direction.set(1, 0.6, 1);
    direction.normalize();

    const targetPosition = new THREE.Vector3();
    let targetZoom = camera instanceof THREE.OrthographicCamera ? camera.zoom : 1;

    if (camera instanceof THREE.PerspectiveCamera) {
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        const aspect = camera.aspect > 0 ? camera.aspect : 1;
        const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
        const halfFov = Math.min(verticalFov, horizontalFov) / 2;
        const distance = (radius * fitPadding) / Math.sin(halfFov);

        targetPosition.copy(center).addScaledVector(direction, distance);
    } else if (camera instanceof THREE.OrthographicCamera) {
        const frustumWidth = camera.right - camera.left;
        const frustumHeight = camera.top - camera.bottom;
        targetZoom = Math.min(frustumWidth, frustumHeight) / (2 * radius * fitPadding);

        const distance = Math.max(radius * 2 * fitPadding, 1);
        targetPosition.copy(center).addScaledVector(direction, distance);
    } else {
        return;
    }

    const currentAnimation = activeAnimations.get(camera);
    if (currentAnimation !== undefined) window.cancelAnimationFrame(currentAnimation);

    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const startZoom = camera instanceof THREE.OrthographicCamera ? camera.zoom : 1;
    const startNear = camera.near;
    const startFar = camera.far;
    const targetNear = Math.max(targetPosition.distanceTo(center) - radius, 0.01);
    const targetFar = targetPosition.distanceTo(center) + radius;
    const startTime = performance.now();

    const animate = (time: number) => {
        const progress = duration <= 0 ? 1 : Math.min((time - startTime) / duration, 1);
        const easedProgress = progress * progress * (3 - 2 * progress);

        camera.position.lerpVectors(startPosition, targetPosition, easedProgress);
        controls.target.lerpVectors(startTarget, center, easedProgress);
        camera.near = THREE.MathUtils.lerp(startNear, targetNear, easedProgress);
        camera.far = THREE.MathUtils.lerp(startFar, targetFar, easedProgress);

        if (camera instanceof THREE.OrthographicCamera) {
            camera.zoom = THREE.MathUtils.lerp(startZoom, targetZoom, easedProgress);
        }

        camera.updateProjectionMatrix();
        controls.update();

        if (progress < 1) {
            activeAnimations.set(camera, window.requestAnimationFrame(animate));
        } else {
            activeAnimations.delete(camera);
        }
    };

    activeAnimations.set(camera, window.requestAnimationFrame(animate));
}