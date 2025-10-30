import { MarkdownView } from 'obsidian';

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import ThreeJSPlugin from './main';

export function gui2(plugin: ThreeJSPlugin, el: HTMLElement, scene: THREE.Scene, axesHelper: THREE.AxesHelper, gridHelper: THREE.GridHelper, orbit: OrbitControls, camera: any, renderer: any, ctx: any, modelArr: any, config: any, lightsArr: any) {
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

    //Parent element sidebar
    let sidebar = document.createElement('div')
    sidebar.addClass("ThreeD_embed_sidebar")
    el.appendChild(sidebar)

    //Footer and options
    let footer = document.createElement('div')
    footer.addClass("ThreeD_embed_sidebar_footer")
    sidebar.appendChild(footer)
    let options = document.createElement('div')
    options.addClass("ThreeD_embed_sidebar_options")
    sidebar.appendChild(options)

    //Seperator line
    let seperator = document.createElement('hr');
    seperator.addClass("ThreeD_embed_seperator")
    footer.appendChild(seperator)

    //Reset button
    let reset = document.createElement('button');
    reset.addClass("ThreeD_embed_reset")
    reset.innerText = "↩"
    reset.title = "Resrt to codeblock config (can only do this once)"
    footer.appendChild(reset)

    //Reload button
    let applyReload = document.createElement('button');
    applyReload.addClass("ThreeD_embed_reload")
    applyReload.innerText = "✔"
    applyReload.title = "Permanentally save all your modifications to the scene"
    footer.appendChild(applyReload)

    //color input
    let colorInput = document.createElement('input');
    if (config.scene.backgroundColor != "transparent") {
        colorInput.addClass("ThreeD_embed_colorInput")
        colorInput.type = 'color'
        colorInput.value = "#" + config.scene.backgroundColor || plugin.settings.standardColor
        colorInput.title = "Set the Scene Color"
        options.appendChild(colorInput)
    }

    //Grid and Axis button
    let gridAxis = document.createElement('button');
    gridAxis.addClass("ThreeD_embed_gridAxis")
    gridAxis.innerText = "⛶"
    gridAxis.title = "Toggle a grid and axis"
    options.appendChild(gridAxis)

    //Radio buttons for transformcontrols
    let transformBtn = document.createElement('button')
    transformBtn.classList.add("ThreeD_embed_radioButton", "transformBtn", "active")
    transformBtn.innerText = "✣"
    options.appendChild(transformBtn)

    let rotationBtn = document.createElement('button')
    rotationBtn.classList.add("ThreeD_embed_radioButton", "rotationBtn")
    rotationBtn.innerText = "⟲"
    options.appendChild(rotationBtn)

    //Resets to settings from codeblock
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

    //Saves settings to codeblock
    applyReload.addEventListener("click", () => {
        //console.log("Pressed Save")
        const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        const sec = ctx.getSectionInfo(ctx.el);
        const lineno = sec?.lineStart;
        const lineEnd = sec?.lineEnd;
        const colorValue: string = colorInput.value.replace("#", "");

        if (!view || modelArr.length === 0) {
            console.error("No models found to update. Contact Developer, because this is most likely a bug.");
            return;
        }

        try {
            // Update global properties
            if (config.scene.backgroundColor && config.scene.backgroundColor != "transparent") config.scene.backgroundColor = colorValue;
            if (config.scene.showGuiOverlay) config.scene.showGuiOverlay = false;
            if (config.camera.camPosXYZ) config.camera.camPosXYZ = [camera.position.x, camera.position.y, camera.position.z];
            if (config.camera.LookatXYZ) config.camera.LookatXYZ = [orbit.target.x, orbit.target.y, orbit.target.z];

            // Update models
            config.models.forEach((model: any, index: number) => {
                //const matchingModel = modelArr.find((mdl: THREE.Group) => mdl.name === model.name);
                //if (matchingModel) {
                model.position = [modelArr[index].position.x.toFixed(3), modelArr[index].position.y.toFixed(3), modelArr[index].position.z.toFixed(3)];
                model.rotation = [
                    (modelArr[index].rotation.x * (180 / Math.PI)).toFixed(3),
                    (modelArr[index].rotation.y * (180 / Math.PI)).toFixed(3),
                    (modelArr[index].rotation.z * (180 / Math.PI)).toFixed(3)
                ];
                //}
            });

            /**
    * Custom formatter that outputs JSON in a specific style.
    * Top-level keys (first iteration) are not indented.
    */
            function customFormat(value: any, indent = ""): string {
                const indentStep = "   "; // 3 spaces for each nested level

                // Handle arrays
                if (Array.isArray(value)) {
                    // If all elements are primitives, output inline.
                    if (value.every(isPrimitive)) {
                        return `[${value.join(", ")}]`;
                    }
                    // If the array contains only “simple objects”, format each inline.
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
                        const formattedValue = customFormat(value[key], indentStep);
                        // Use no indentation for top-level keys; add indentation for nested keys.
                        const keyPrefix = indent === "" ? "" : indent;
                        return `${keyPrefix}"${key}": ${formattedValue}`;
                    });
                    return `{\n${lines.join(",\n")}\n}`;
                }

                // Handle primitives (numbers, strings, booleans, null)
                return JSON.stringify(value);
            }

            /**
             * Determines if a value is a primitive.
             */
            function isPrimitive(val: any): boolean {
                return val === null || (typeof val !== "object" && typeof val !== "function");
            }

            /**
             * Checks if an object is "simple": all of its properties are primitives
             * or flat arrays (arrays of primitives).
             */
            function isSimpleObject(obj: any): boolean {
                if (obj === null || typeof obj !== "object") return false;
                return Object.values(obj).every(val => {
                    if (Array.isArray(val)) {
                        return val.every(isPrimitive);
                    }
                    return isPrimitive(val);
                });
            }

            /**
             * Formats a simple object on one line.
             */
            function formatObjectInline(obj: any): string {
                const entries = Object.entries(obj).map(([key, val]) => {
                    let formatted: string;
                    if (Array.isArray(val)) {
                        // If the array is flat, join it inline.
                        if (val.every(isPrimitive)) {
                            formatted = `[${val.join(", ")}]`;
                        } else {
                            formatted = JSON.stringify(val);
                        }
                    } else {
                        formatted = typeof val === "string" ? JSON.stringify(val) : String(val);
                    }
                    return `"${key}": ${formatted}`;
                });
                return `{${entries.join(", ")}}`;
            }
            // Convert back to JSON string without outer brackets
            //let updatedJsonText = JSON.stringify(config, null, 3).slice(1, -1).trim();
            //let updatedJsonText = JSON.stringify(config, null, 0).slice(1, -1).trim();

            let formattedJson = customFormat(config);
            // If you want to remove the outer braces (like if you're inserting it inside a code block without them)
            formattedJson = formattedJson.slice(1, -1).trim();

            // Now insert formattedJson into your editor:
            view.editor.replaceRange(
                "```3D\n" + formattedJson + "\n```\n",
                { line: lineno, ch: 0 },
                { line: lineEnd + 1, ch: 0 }
            );

            // Replace the old JSON in the editor with proper codeblock formatting
            //view.editor.replaceRange(`\`\`\`3D\n${updatedJsonText}\n\`\`\``, { line: lineno, ch: 0 }, { line: lineEnd, ch: 0 });

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

    document.querySelectorAll('.ThreeD_embed_radioButton').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.ThreeD_embed_radioButton').forEach(btn => btn.classList.remove('active'));

            const btnElement = button as HTMLButtonElement;
            let classes = button.classList
            //console.log(classes)

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