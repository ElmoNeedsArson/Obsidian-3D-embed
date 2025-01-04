import { MarkdownView, Notice } from 'obsidian';

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import ThreeJSPlugin from './main';

export function gui(plugin: ThreeJSPlugin, guiShow: boolean, el: HTMLElement, scene: THREE.Scene, axesHelper: THREE.AxesHelper, gridHelper: THREE.GridHelper, controls: TransformControls, orbit: OrbitControls, gizmo: any, camera: any, renderer: any, ctx: any, model: THREE.Object3D) {
        if (guiShow) {
            let applyReload = document.createElement('button');
            applyReload.addClass("buttonInput_Reload")
            applyReload.innerText = "Apply & Reload"
            el.appendChild(applyReload)

            let reset = document.createElement('button');
            reset.addClass("buttonInput_Reset")
            reset.innerText = "Reset Rotation/Position"
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
                console.log(camera.rotation)

                let mdl = model
                mdl.position.x = 0;
                mdl.position.y = 0;
                mdl.position.z = 0;

                mdl.rotation.x = 0;
                mdl.rotation.y = 0;
                mdl.rotation.z = 0;

                camera.position.x = 0;
                camera.position.y = 5;
                camera.position.z = 10;

                orbit.target.x = 0;
                orbit.target.y = 0;
                orbit.target.z = 0;

                scene.background = new THREE.Color(plugin.settings.standardColor);
                colorInput.value = plugin.settings.standardColor
            })

            applyReload.addEventListener('click', () => {
                console.log("passed model: " + model)
                let mdl = model

                const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);

                //gets line number of the codeblock that is being triggered with the button
                const sec = ctx.getSectionInfo(ctx.el);
                const lineno = sec?.lineStart;
                const lineEnd = sec?.lineEnd

                const colorValue = colorInput.value.replace('#', '');

                if (view) {
                    if (mdl) {
                        // for the codeblock at hand check each line
                        for (let i = lineno; i < lineEnd; i++) {
                            console.log("checking line: " + i)
                            // save position settings
                            if (view.editor.getLine(i).contains(`"positionX"`)) {
                                console.log("found position replacing it")
                                if (view.editor.getLine(i + 1).contains(`}`)) {
                                    view.editor.setLine(i, `"positionX": ${mdl.position.x.toFixed(3)}, "positionY": ${mdl.position.y.toFixed(3)}, "positionZ": ${mdl.position.z.toFixed(3)}`)
                                } else {
                                    view.editor.setLine(i, `"positionX": ${mdl.position.x.toFixed(3)}, "positionY": ${mdl.position.y.toFixed(3)}, "positionZ": ${mdl.position.z.toFixed(3)},`)
                                }
                            }

                            //save guioverlay setting
                            if (view.editor.getLine(i).contains(`"showGuiOverlay"`)) {
                                console.log("found gui replacing it")
                                if (view.editor.getLine(i + 1).contains(`}`)) {
                                    view.editor.setLine(i, `"showGuiOverlay": false`)
                                } else {
                                    view.editor.setLine(i, `"showGuiOverlay": false,`)
                                }
                            }

                            //save background color setting
                            if (view.editor.getLine(i).contains(`"backgroundColorHexString"`)) {
                                console.log("found color replacing it")
                                if (view.editor.getLine(i + 1).contains(`}`)) {
                                    view.editor.setLine(i, `"backgroundColorHexString": "${colorValue}"`)
                                } else {
                                    view.editor.setLine(i, `"backgroundColorHexString": "${colorValue}",`)
                                }
                            }

                            //save rotation settings
                            if (view.editor.getLine(i).contains(`"rotationX"`)) {
                                console.log("found rotation replacing it")
                                if (view.editor.getLine(i + 1).contains(`}`)) {
                                    view.editor.setLine(i, `"rotationX": ${mdl.rotation.x * (180 / Math.PI)}, "rotationY": ${mdl.rotation.y * (180 / Math.PI)}, "rotationZ": ${mdl.rotation.z * (180 / Math.PI)}`)
                                } else {
                                    view.editor.setLine(i, `"rotationX": ${mdl.rotation.x * (180 / Math.PI)}, "rotationY": ${mdl.rotation.y * (180 / Math.PI)}, "rotationZ": ${mdl.rotation.z * (180 / Math.PI)},`)
                                }
                            }

                            //save camera position
                            if (view.editor.getLine(i).contains(`"camPosXYZ"`)) {
                                console.log("found camXYZ replacing it")
                                if (view.editor.getLine(i + 1).contains(`}`)) {
                                    view.editor.setLine(i, `"camPosXYZ": [${camera.position.x},${camera.position.y},${camera.position.z}]`)
                                } else {
                                    view.editor.setLine(i, `"camPosXYZ": [${camera.position.x},${camera.position.y},${camera.position.z}],`)
                                }
                            }

                            if (view.editor.getLine(i).contains(`"LookatXYZ"`)) {
                                console.log("found camLookat replacing it")
                                if (view.editor.getLine(i + 1).contains(`}`)) {
                                    view.editor.setLine(i, `"LookatXYZ": [${orbit.target.x},${orbit.target.y},${orbit.target.z}]`)
                                } else {
                                    view.editor.setLine(i, `"LookatXYZ": [${orbit.target.x},${orbit.target.y},${orbit.target.z}],`)
                                }
                            }
                        }
                    } else {
                        new Notice("Failed to find a model to apply settings to. Contact Developer");
                    }
                }
            })

            TransformControlsInput.addEventListener('input', () => {
                console.log("trigger")
                controls.addEventListener('change', render);
                controls.addEventListener('dragging-changed', function (event) {
                    orbit.enabled = !event.value;
                });

                //scene.add(gizmo);
                if (TransformControlsInput.checked) {
                    scene.add(gizmo);
                    transformOptions()
                } else {
                    scene.remove(gizmo); // or some other action for false
                    const radioParent = el.querySelector('.radioParent')
                    if (radioParent) el.removeChild(radioParent);
                }

                function render() {
                    renderer.render(scene, camera);
                }

                function transformOptions() {
                    let radioParent = document.createElement('div');
                    radioParent.classList.add('radioParent');
                    el.appendChild(radioParent)

                    const radioData = [
                        { label: 'Transform', value: '1' },
                        { label: 'Rotate', value: '2' },
                        //{ label: 'Scale', value: '3' },
                    ];

                    // Create a radio button group
                    radioData.forEach((data, index) => {
                        // Create the radio input element
                        const radio = document.createElement('input');
                        radio.type = 'radio';
                        radio.name = 'exampleRadio'; // Group name for the radio buttons
                        radio.id = `radio${index}`;
                        radio.value = data.value;

                        if (index == 0) {
                            radio.checked = true;
                        }

                        // Create the label element
                        const label = document.createElement('label');
                        label.htmlFor = `radio${index}`;
                        label.textContent = data.label;

                        // Append the radio and label to the container
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

                                // case '3':
                                //     controls.setMode('scale');
                                //     break;
                            }
                        })
                    });
                }
            })

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
        } else {
            const colorInput = el.querySelector('.colorInput');
            const axisInput = el.querySelector('.axisInput');
            const gridInput = el.querySelector('.gridInput');
            const TransformControlsInput = el.querySelector('.TransformControlsInput')

            if (colorInput) el.removeChild(colorInput);
            if (axisInput) el.removeChild(axisInput);
            if (gridInput) el.removeChild(gridInput);
            if (TransformControlsInput) el.removeChild(TransformControlsInput);
        }
}