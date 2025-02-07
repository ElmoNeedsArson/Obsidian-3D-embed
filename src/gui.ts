import { MarkdownView, Notice } from 'obsidian';

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import ThreeJSPlugin from './main';

export function gui2(plugin: ThreeJSPlugin, el: HTMLElement, scene: THREE.Scene, axesHelper: THREE.AxesHelper, gridHelper: THREE.GridHelper, orbit: OrbitControls, camera: any, renderer: any, ctx: any, modelArr: any, config: any) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectedGroup: THREE.Group | null = null;
    let hoveredGroup: THREE.Group | null = null;

    // Initialize TransformControls
    const controls = new TransformControls(camera, renderer.domElement);
    controls.addEventListener('change', () => renderer.render(scene, camera)); // Ensure updates

    let isTransforming = false;

    controls.addEventListener('dragging-changed', (event) => {
        orbit.enabled = !(event as { value: boolean }).value;
        isTransforming = (event as { value: boolean }).value;
    });

    // Mouse click to select the whole model group
    // function onMouseClick(event: MouseEvent) {
    //     if (isTransforming) return; // Ignore clicks if still transforming

    //     updateMousePosition(event);
    //     raycaster.setFromCamera(mouse, camera);
    //     const intersects = raycaster.intersectObjects(modelArr, true);

    //     if (intersects.length > 0) {
    //         const selectedMesh = intersects[0].object;
    //         const group = findParentGroup(selectedMesh);

    //         if (group) {
    //             selectedGroup = group;
    //             controls.attach(selectedGroup);
    //             scene.add(gizmo);
    //         }
    //     } else {
    //         // Only deselect if the user is not transforming
    //         if (selectedGroup) {
    //             controls.detach();
    //             selectedGroup = null;
    //             scene.remove(gizmo);
    //         }
    //     }
    // }

    let isTransforming2 = false;

    // Listen for transformation changes
    controls.addEventListener("mouseDown", () => {
        isTransforming2 = true;
    });

    controls.addEventListener("mouseUp", () => {
        isTransforming2 = false;
    });

    // Mouse click to select the whole model group
    function onMouseClick(event: MouseEvent) {
        if (isTransforming2) return; // Ignore clicks if still transforming

        updateMousePosition(event);
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(modelArr, true);

        if (intersects.length > 0) {
            const selectedMesh = intersects[0].object;
            const group = findParentGroup(selectedMesh);

            if (group) {
                selectedGroup = group;
                controls.attach(selectedGroup);
                scene.add(gizmo);
            }
        } else if (!isTransforming2) { // Only deselect if the user is not using controls
            if (selectedGroup) {
                controls.detach();
                selectedGroup = null;
                scene.remove(gizmo);
            }
        }
    }

    // Mouse move for hover effect
    function onMouseMove(event: MouseEvent) {
        updateMousePosition(event);
        raycaster.setFromCamera(mouse, camera);  // Recalculate raycaster position
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            const hoveredMesh = intersects[0].object;
            const group = findParentGroup(hoveredMesh);

            if (group !== hoveredGroup) {
                if (hoveredGroup) resetHoverEffect(hoveredGroup);
                hoveredGroup = group;
                if (hoveredGroup) applyHoverEffect(hoveredGroup);
            }
        } else {
            if (hoveredGroup) resetHoverEffect(hoveredGroup);
            hoveredGroup = null;
        }
    }

    // Helper: Convert mouse position to normalized device coordinates
    function updateMousePosition(event: MouseEvent) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    // Helper: Find the top-level group of a selected mesh
    function findParentGroup(mesh: THREE.Object3D): THREE.Group | null {
        let obj = mesh;
        while (obj.parent) {
            if (obj.parent instanceof THREE.Group) return obj.parent;
            obj = obj.parent;
        }
        return null;
    }

    // Helper: Apply hover effect (e.g., outline or color change)
    function applyHoverEffect(group: THREE.Group) {
        group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.userData.originalMaterial = child.material;
                child.material = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
            }
        });
    }

    // Helper: Reset hover effect
    function resetHoverEffect(group: THREE.Group) {
        group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
            }
        });
    }

    // Add event listeners
    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    const gizmo = controls.getHelper();

    //if (guiShow) {
    let applyReload = document.createElement('button');
    applyReload.addClass("buttonInput_Reload")
    applyReload.innerText = "Apply & Reload"
    el.appendChild(applyReload)

    let reset = document.createElement('button');
    reset.addClass("buttonInput_Reset")
    reset.innerText = "Reset"
    el.appendChild(reset)

    let colorInput = document.createElement('input');
    colorInput.addClass("colorInput")
    colorInput.type = 'color'
    colorInput.value = plugin.settings.standardColor
    colorInput.title = "Set the Scene Color"
    el.appendChild(colorInput)

    let axisInput = document.createElement('input');
    axisInput.classList.add('axisInput');
    axisInput.type = 'checkbox'
    axisInput.title = "Show the basic axis in the scene"
    el.appendChild(axisInput)

    let gridInput = document.createElement('input');
    gridInput.classList.add('gridInput');
    gridInput.type = 'checkbox'
    gridInput.title = "Show a grid in the scene"
    el.appendChild(gridInput)

    let TransformControlsInput = document.createElement('input');
    TransformControlsInput.classList.add('TransformControlsInput');
    TransformControlsInput.type = 'checkbox'
    TransformControlsInput.title = "Show transform controls on the objects"
    el.appendChild(TransformControlsInput)

    reset.addEventListener('click', () => {
        //NEEDS TO CHANGE, RESET SHOULD MEAN READ OUT THE CONFIG OR THE STANDARD SETTINGS --- Discussion Point
        modelArr.forEach((child: THREE.Group, index: number) => {
            child.position.x = config.models[index].position[0];
            child.position.y = config.models[index].position[1];
            child.position.z = config.models[index].position[2];

            child.rotation.x = THREE.MathUtils.degToRad(config.models[index].rotation[0]);
            child.rotation.y = THREE.MathUtils.degToRad(config.models[index].rotation[1]);
            child.rotation.z = THREE.MathUtils.degToRad(config.models[index].rotation[2]);
        });

        camera.position.x = config.camera.camPosXYZ[0];
        camera.position.y = config.camera.camPosXYZ[1];
        camera.position.z = config.camera.camPosXYZ[2];

        orbit.target.x = config.camera.LookatXYZ[0];
        orbit.target.y = config.camera.LookatXYZ[1];
        orbit.target.z = config.camera.LookatXYZ[2];

        scene.background = new THREE.Color(plugin.settings.standardColor);
        colorInput.value = plugin.settings.standardColor
    })

    // applyReload.addEventListener('click', () => {
    //     let mdl = model

    //     const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);

    //     //gets line number of the codeblock that is being triggered with the button
    //     const sec = ctx.getSectionInfo(ctx.el);
    //     const lineno = sec?.lineStart;
    //     const lineEnd = sec?.lineEnd

    //     const colorValue = colorInput.value.replace('#', '');

    //     if (view) {
    //         if (mdl) {
    //             // for the codeblock at hand check each line
    //             for (let i = lineno; i < lineEnd; i++) {
    //                 // save position settings
    //                 if (view.editor.getLine(i).contains(`"positionX"`)) {
    //                     if (view.editor.getLine(i + 1).contains(`}`)) {
    //                         view.editor.setLine(i, `"positionX": ${mdl.position.x.toFixed(3)}, "positionY": ${mdl.position.y.toFixed(3)}, "positionZ": ${mdl.position.z.toFixed(3)}`)
    //                     } else {
    //                         view.editor.setLine(i, `"positionX": ${mdl.position.x.toFixed(3)}, "positionY": ${mdl.position.y.toFixed(3)}, "positionZ": ${mdl.position.z.toFixed(3)},`)
    //                     }
    //                 }

    //                 //save guioverlay setting
    //                 if (view.editor.getLine(i).contains(`"showGuiOverlay"`)) {
    //                     if (view.editor.getLine(i + 1).contains(`}`)) {
    //                         view.editor.setLine(i, `"showGuiOverlay": false`)
    //                     } else {
    //                         view.editor.setLine(i, `"showGuiOverlay": false,`)
    //                     }
    //                 }

    //                 //save background color setting
    //                 if (view.editor.getLine(i).contains(`"backgroundColorHexString"`)) {
    //                     if (view.editor.getLine(i + 1).contains(`}`)) {
    //                         view.editor.setLine(i, `"backgroundColorHexString": "${colorValue}"`)
    //                     } else {
    //                         view.editor.setLine(i, `"backgroundColorHexString": "${colorValue}",`)
    //                     }
    //                 }

    //                 //save rotation settings
    //                 if (view.editor.getLine(i).contains(`"rotationX"`)) {
    //                     if (view.editor.getLine(i + 1).contains(`}`)) {
    //                         view.editor.setLine(i, `"rotationX": ${mdl.rotation.x * (180 / Math.PI)}, "rotationY": ${mdl.rotation.y * (180 / Math.PI)}, "rotationZ": ${mdl.rotation.z * (180 / Math.PI)}`)
    //                     } else {
    //                         view.editor.setLine(i, `"rotationX": ${mdl.rotation.x * (180 / Math.PI)}, "rotationY": ${mdl.rotation.y * (180 / Math.PI)}, "rotationZ": ${mdl.rotation.z * (180 / Math.PI)},`)
    //                     }
    //                 }

    //                 //save camera position
    //                 if (view.editor.getLine(i).contains(`"camPosXYZ"`)) {
    //                     if (view.editor.getLine(i + 1).contains(`}`)) {
    //                         view.editor.setLine(i, `"camPosXYZ": [${camera.position.x},${camera.position.y},${camera.position.z}]`)
    //                     } else {
    //                         view.editor.setLine(i, `"camPosXYZ": [${camera.position.x},${camera.position.y},${camera.position.z}],`)
    //                     }
    //                 }

    //                 if (view.editor.getLine(i).contains(`"LookatXYZ"`)) {
    //                     if (view.editor.getLine(i + 1).contains(`}`)) {
    //                         view.editor.setLine(i, `"LookatXYZ": [${orbit.target.x},${orbit.target.y},${orbit.target.z}]`)
    //                     } else {
    //                         view.editor.setLine(i, `"LookatXYZ": [${orbit.target.x},${orbit.target.y},${orbit.target.z}],`)
    //                     }
    //                 }
    //             }
    //         } else {
    //             new Notice("Failed to find a model to apply settings to. Contact Developer");
    //         }
    //     }
    // })

    // TransformControlsInput.addEventListener('input', () => {
    //     controls.addEventListener('change', render);
    //     controls.addEventListener('dragging-changed', function (event) {
    //         orbit.enabled = !event.value;
    //     });

    //     //scene.add(gizmo);
    //     if (TransformControlsInput.checked) {
    //         scene.add(gizmo);
    //         transformOptions()
    //     } else {
    //         scene.remove(gizmo); // or some other action for false
    //         const radioParent = el.querySelector('.radioParent')
    //         if (radioParent) el.removeChild(radioParent);
    //     }

    //     function render() {
    //         renderer.render(scene, camera);
    //     }

    //     function transformOptions() {
    //         let radioParent = document.createElement('div');
    //         radioParent.classList.add('radioParent');
    //         el.appendChild(radioParent)

    //         const radioData = [
    //             { label: 'Transform', value: '1' },
    //             { label: 'Rotate', value: '2' },
    //             //{ label: 'Scale', value: '3' },
    //         ];

    //         // Create a radio button group
    //         radioData.forEach((data, index) => {
    //             // Create the radio input element
    //             const radio = document.createElement('input');
    //             radio.type = 'radio';
    //             radio.name = 'exampleRadio'; // Group name for the radio buttons
    //             radio.id = `radio${index}`;
    //             radio.value = data.value;

    //             if (index == 0) {
    //                 radio.checked = true;
    //             }

    //             // Create the label element
    //             const label = document.createElement('label');
    //             label.htmlFor = `radio${index}`;
    //             label.textContent = data.label;

    //             // Append the radio and label to the container
    //             radioParent.appendChild(radio);
    //             radioParent.appendChild(label);

    //             radio.addEventListener('change', (event) => {
    //                 const target = event.target as HTMLInputElement;

    //                 switch (target.value) {
    //                     case '1':
    //                         controls.setMode('translate');
    //                         break;

    //                     case '2':
    //                         controls.setMode('rotate');
    //                         break;

    //                     // case '3':
    //                     //     controls.setMode('scale');
    //                     //     break;
    //                 }
    //             })
    //         });
    //     }
    // })

    TransformControlsInput.addEventListener('input', () => {
        controls.addEventListener('change', render);

        // Disable OrbitControls when TransformControls is actively dragging
        controls.addEventListener('dragging-changed', function (event) {
            orbit.enabled = !event.value;
        });

        if (TransformControlsInput.checked) {
            scene.add(gizmo);
            transformOptions();
        } else {
            scene.remove(gizmo);
            const radioParent = el.querySelector('.radioParent');
            if (radioParent) el.removeChild(radioParent);
        }

        function render() {
            renderer.render(scene, camera);
        }

        function transformOptions() {
            let radioParent = document.createElement('div');
            radioParent.classList.add('radioParent');
            el.appendChild(radioParent);

            const radioData = [
                { label: 'Transform', value: '1' },
                { label: 'Rotate', value: '2' },
            ];

            radioData.forEach((data, index) => {
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'transformMode';
                radio.id = `radio${index}`;
                radio.value = data.value;
                if (index === 0) radio.checked = true;

                const label = document.createElement('label');
                label.htmlFor = `radio${index}`;
                label.textContent = data.label;

                radioParent.appendChild(radio);
                radioParent.appendChild(label);

                radio.addEventListener('change', (event) => {
                    const target = event.target as HTMLInputElement;
                    switch (target.value) {
                        case '1':
                            controls.setMode('translate');
                            break;
                        case '2':
                            controls.setMode('rotate');
                            break;
                    }
                });
            });
        }
    });

    gridInput.addEventListener('input', () => {
        if (gridInput.checked) {
            scene.add(gridHelper);
        } else {
            scene.remove(gridHelper); // or some other action for false
        }
    })

    axisInput.addEventListener('input', () => {
        if (axisInput.checked) {
            scene.add(axesHelper);
        } else {
            scene.remove(axesHelper); // or some other action for false
        }
    })

    colorInput.addEventListener('input', () => {
        scene.background = new THREE.Color(colorInput.value);
    })
    // } else {
    //     const colorInput = el.querySelector('.colorInput');
    //     const axisInput = el.querySelector('.axisInput');
    //     const gridInput = el.querySelector('.gridInput');
    //     const TransformControlsInput = el.querySelector('.TransformControlsInput')

    //     if (colorInput) el.removeChild(colorInput);
    //     if (axisInput) el.removeChild(axisInput);
    //     if (gridInput) el.removeChild(gridInput);
    //     if (TransformControlsInput) el.removeChild(TransformControlsInput);
    // }
}