import { MarkdownView, MarkdownPostProcessorContext } from 'obsidian';

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import ThreeJSPlugin from './main';
import { SceneData, ModelConfig, JsonValue } from './types';

export function gui2(plugin: ThreeJSPlugin, el: HTMLElement, scene: THREE.Scene, axesHelper: THREE.AxesHelper, gridHelper: THREE.GridHelper, orbit: OrbitControls, camera: THREE.Camera, renderer: THREE.Renderer, ctx: MarkdownPostProcessorContext, modelArr: THREE.Object3D[], config: SceneData) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectedGroup: THREE.Group | null = null;
    let hoveredGroup: THREE.Group | null = null;

    // Initialize TransformControls
    const controls = new TransformControls(camera, renderer.domElement);
    controls.addEventListener('change', () => renderer.render(scene, camera)); // Ensure updates

    controls.addEventListener('dragging-changed', (event) => {
        orbit.enabled = !(event as { value: boolean }).value;
    });

    let isTransforming2 = false;

    // Listen for transformation changes
    controls.addEventListener("mouseDown", () => {
        isTransforming2 = true;
    });

    controls.addEventListener("mouseUp", () => {
        isTransforming2 = false;
    });

    let lastSelectedMode: "translate" | "rotate" = "translate"; // Default mode

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
                controls.setMode(lastSelectedMode);
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
        const intersects = raycaster.intersectObjects(modelArr, true);

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

    function findParentGroup(mesh: THREE.Object3D): THREE.Group | null {
        let obj = mesh;
        while (obj.parent) {
            if (modelArr.includes(obj.parent)) return obj.parent as THREE.Group;
            obj = obj.parent;
        }
        return null;
    }

    // Helper: Apply hover effect (e.g., outline or color change)
    function applyHoverEffect(group: THREE.Group) {
        group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                (child.userData as { originalMaterial?: THREE.Material | THREE.Material[] }).originalMaterial = child.material as THREE.Material | THREE.Material[];
                child.material = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
            }
        });
    }

    // Helper: Reset hover effect
    function resetHoverEffect(group: THREE.Group) {
        group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial as THREE.Material | THREE.Material[];
            }
        });
    }

    // Add event listeners
    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    const gizmo = controls.getHelper();

    //Parent element sidebar
    let sidebar = activeDocument.createElement('div')
    sidebar.addClass("ThreeD_embed_sidebar")
    el.appendChild(sidebar)

    //Footer and options
    let footer = activeDocument.createElement('div')
    footer.addClass("ThreeD_embed_sidebar_footer")
    sidebar.appendChild(footer)
    let options = activeDocument.createElement('div')
    options.addClass("ThreeD_embed_sidebar_options")
    sidebar.appendChild(options)

    //Seperator line
    let seperator = activeDocument.createElement('hr');
    seperator.addClass("ThreeD_embed_seperator")
    footer.appendChild(seperator)

    //Reset button
    let reset = activeDocument.createElement('button');
    reset.addClass("ThreeD_embed_reset")
    reset.innerText = "↩"
    reset.title = "Resrt to codeblock config (can only do this once)"
    footer.appendChild(reset)

    //Reload button
    let applyReload = activeDocument.createElement('button');
    applyReload.addClass("ThreeD_embed_reload")
    applyReload.innerText = "✔"
    applyReload.title = "Permanentally save all your modifications to the scene"
    footer.appendChild(applyReload)

    //color input
    let colorInput = activeDocument.createElement('input');
    if (config.scene?.backgroundColor != "transparent") {
        colorInput.addClass("ThreeD_embed_colorInput")
        colorInput.type = 'color'
        colorInput.value = "#" + config.scene?.backgroundColor || plugin.settings.standardColor
        colorInput.title = "Set the scene color"
        options.appendChild(colorInput)
    }

    //Grid and Axis button
    let gridAxis = activeDocument.createElement('button');
    gridAxis.addClass("ThreeD_embed_gridAxis")
    gridAxis.innerText = "⛶"
    gridAxis.title = "Toggle a grid and axis"
    options.appendChild(gridAxis)

    //Radio buttons for transformcontrols
    let transformBtn = activeDocument.createElement('button')
    transformBtn.classList.add("ThreeD_embed_radioButton", "transformBtn", "active")
    transformBtn.innerText = "✣"
    options.appendChild(transformBtn)

    let rotationBtn = activeDocument.createElement('button')
    rotationBtn.classList.add("ThreeD_embed_radioButton", "rotationBtn")
    rotationBtn.innerText = "⟲"
    options.appendChild(rotationBtn)

    //Resets to settings from codeblock
    reset.addEventListener('click', () => {
        //NEEDS TO CHANGE, RESET SHOULD MEAN READ OUT THE CONFIG OR THE STANDARD SETTINGS --- Discussion Point
        (modelArr as THREE.Group[]).forEach((child: THREE.Group, index: number) => {
            const modelCfg = config.models?.[index];
            if (!modelCfg) return;
            child.position.x = modelCfg.position?.[0] ?? 0;
            child.position.y = modelCfg.position?.[1] ?? 0;
            child.position.z = modelCfg.position?.[2] ?? 0;

            child.rotation.x = THREE.MathUtils.degToRad(modelCfg.rotation?.[0] ?? 0);
            child.rotation.y = THREE.MathUtils.degToRad(modelCfg.rotation?.[1] ?? 0);
            child.rotation.z = THREE.MathUtils.degToRad(modelCfg.rotation?.[2] ?? 0);
        });

        if (config.camera?.camPosXYZ) {
            camera.position.x = config.camera.camPosXYZ[0];
            camera.position.y = config.camera.camPosXYZ[1];
            camera.position.z = config.camera.camPosXYZ[2];
        }

        if (config.camera?.LookatXYZ) {
            orbit.target.x = config.camera.LookatXYZ[0];
            orbit.target.y = config.camera.LookatXYZ[1];
            orbit.target.z = config.camera.LookatXYZ[2];
        }

        scene.background = new THREE.Color(plugin.settings.standardColor);
        colorInput.value = plugin.settings.standardColor
    })

    //Saves settings to codeblock
    applyReload.addEventListener("click", () => {
        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        const sec = ctx.getSectionInfo(el);
        const lineno = sec?.lineStart;
        const lineEnd = sec?.lineEnd;
        const colorValue: string = colorInput.value.replace("#", "");

        if (!view || modelArr.length === 0) {
            console.error("No models found to update. Contact Developer, because this is most likely a bug.");
            return;
        }

        try {
            // Update global properties
            if (config.scene?.backgroundColor && config.scene.backgroundColor != "transparent") config.scene.backgroundColor = colorValue;
            if (config.scene?.showGuiOverlay) config.scene.showGuiOverlay = false;
            if (config.camera?.camPosXYZ) config.camera.camPosXYZ = [camera.position.x, camera.position.y, camera.position.z];
            if (config.camera?.LookatXYZ) config.camera.LookatXYZ = [orbit.target.x, orbit.target.y, orbit.target.z];

            // Update models
            config.models?.forEach((model: ModelConfig, index: number) => {
                model.position = [
                    parseFloat(modelArr[index].position.x.toFixed(3)),
                    parseFloat(modelArr[index].position.y.toFixed(3)),
                    parseFloat(modelArr[index].position.z.toFixed(3))
                ];
                model.rotation = [
                    parseFloat((modelArr[index].rotation.x * (180 / Math.PI)).toFixed(3)),
                    parseFloat((modelArr[index].rotation.y * (180 / Math.PI)).toFixed(3)),
                    parseFloat((modelArr[index].rotation.z * (180 / Math.PI)).toFixed(3))
                ];
            });

            // Custom formatter that outputs JSON in a specific style.
            // Top-level keys (first iteration) are not indented.
            function customFormat(value: JsonValue, indent = ""): string {
                const indentStep = "   "; // 3 spaces for each nested level

                // Handle arrays
                if (Array.isArray(value)) {
                    // If all elements are primitives, output inline.
                    if (value.every(isPrimitive)) {
                        return `[${(value as (string | number | boolean | null)[]).join(", ")}]`;
                    }
                    // If the array contains only "simple objects", format each inline.
                    if (value.every(isSimpleObject)) {
                        const items = value.map(item => formatObjectInline(item));
                        return `[\n${indentStep}${items.join(",\n" + indentStep)}\n]`;
                    }
                    // Otherwise, format each element recursively.
                    const items = value.map(item => customFormat(item, indent));
                    return `[\n${indentStep}${items.join(",\n" + indentStep)}\n]`;
                }

                // Handle objects
                if (value !== null && typeof value === "object") {
                    const keys = Object.keys(value);
                    // For each key, add no indent if we're at the top level (indent === ""),
                    // or indent using indent+indentStep for nested levels.
                    const lines = keys.map(key => {
                        const formattedValue = customFormat((value as Record<string, JsonValue>)[key], indentStep);
                        // Use no indentation for top-level keys; add indentation for nested keys.
                        const keyPrefix = indent === "" ? "" : indent;
                        return `${keyPrefix}"${key}": ${formattedValue}`;
                    });
                    return `{\n${lines.join(",\n")}\n}`;
                }

                // Handle primitives (numbers, strings, booleans, null)
                return JSON.stringify(value);
            }

            // Determines if a value is a primitive.
            function isPrimitive(val: JsonValue): boolean {
                return val === null || (typeof val !== "object" && typeof val !== "function");
            }

            // Checks if an object is "simple": all of its properties are primitives
            // or flat arrays (arrays of primitives).
            function isSimpleObject(obj: JsonValue): boolean {
                if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return false;
                return Object.values(obj).every(val => {
                    if (Array.isArray(val)) {
                        return val.every(isPrimitive);
                    }
                    return isPrimitive(val);
                });
            }

            // Formats a simple object on one line.
            function formatObjectInline(obj: JsonValue): string {
                if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return JSON.stringify(obj);
                const entries = Object.entries(obj).map(([key, val]) => {
                    let formatted: string;
                    if (Array.isArray(val)) {
                        // If the array is flat, join it inline.
                        if (val.every(isPrimitive)) {
                            formatted = `[${(val as (string | number | boolean | null)[]).join(", ")}]`;
                        } else {
                            formatted = JSON.stringify(val);
                        }
                    } else {
                        formatted = JSON.stringify(val);
                    }
                    return `"${key}": ${formatted}`;
                });
                return `{${entries.join(", ")}}`;
            }

            let formattedJson = customFormat(config as unknown as JsonValue);
            // Remove the outer braces (like if you're inserting it inside a code block without them)
            formattedJson = formattedJson.slice(1, -1).trim();

            // Now insert formattedJson into your editor:
            view.editor.replaceRange(
                "```3D\n" + formattedJson + "\n```\n",
                { line: lineno ?? 0, ch: 0 },
                { line: (lineEnd ?? 0) + 1, ch: 0 }
            );
        } catch (error) {
            console.error("Error updating JSON: " + error);
        }
    });

    controls.addEventListener('change', render);

    // Disable OrbitControls when TransformControls is actively dragging
    controls.addEventListener('dragging-changed', function (event) {
        orbit.enabled = !event.value;
    });

    scene.add(gizmo);

    function render() {
        renderer.render(scene, camera);
    }

    activeDocument.querySelectorAll('.ThreeD_embed_radioButton').forEach(button => {
        button.addEventListener('click', () => {
            activeDocument.querySelectorAll('.ThreeD_embed_radioButton').forEach(btn => btn.classList.remove('active'));

            const btnElement = button as HTMLButtonElement;
            let classes = button.classList

            if (classes.contains("rotationBtn")) {
                controls.setMode('rotate');
                lastSelectedMode = "rotate"
            } else if (classes.contains("transformBtn")) {
                controls.setMode('translate');
                lastSelectedMode = "translate"
            }

            btnElement.classList.add('active');
        });
    });

    //Toggle for grid
    let toggled = false
    gridAxis.addEventListener('click', () => {
        if (toggled) {
            scene.remove(axesHelper);
            scene.remove(gridHelper);
            gridAxis.classList.remove('active')
            toggled = false
        } else {
            scene.add(gridHelper);
            scene.add(axesHelper);
            gridAxis.classList.add('active')
            toggled = true;
        }
    })

    colorInput.addEventListener('input', () => {
        scene.background = new THREE.Color(colorInput.value);
    })
}
