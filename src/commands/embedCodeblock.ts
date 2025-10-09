import { Editor, Notice } from 'obsidian';

import ThreeJSPlugin from '../main';
// For example, in convertLights.ts
import { LightSetting } from '../settings'; // Adjust the path as necessary

export function ThreeD_Embed_Command(plugin: ThreeJSPlugin) {
    plugin.addCommand({
        id: "Add a 3D embed at the cursorposition",
        name: "Add a 3D embed at the cursorposition",
        editorCallback: (editor: Editor) => {
            let selection = editor.getSelection();

            //gets the embed on the line to get the 3D model name in the vault
            if (selection == "") {
                const lineNumber = editor.getCursor().line
                const searchQuery = editor.getLine(lineNumber).trim()

                function mySubString(str: string) {
                    let newStr;
                    newStr = str.substring(str.indexOf("[") + 1, str.lastIndexOf("]"));
                    return newStr;
                }
                let newStr1 = mySubString(searchQuery)
                let newStr2 = mySubString(newStr1)
                selection = newStr2;
            }

            //If a path to the selection can be found the model can be displayed, otherwise display a warning
            const modelPath = plugin.getModelPath(selection)
            if (!modelPath) {
                new Notice("This model: '" + selection + "' cannot be found in your vault", 5000);
            } else if (modelPath) {

                let autorotateY = plugin.settings.autoRotate ? 0.001 : 0
                let cameraType = ""
                if (plugin.settings.cameraType == "Orthographic") {
                    cameraType = `"orthographic": true`
                } else { cameraType = `"orthographic": false` }

                let codeBlockType = "\n```3D"
                let models = `\n"models": [\n   {"name": "` + selection + `", "scale": ` + plugin.settings.standardScale + `, "position": [0, 0, 0], "rotation": [0, 0, 0]}\n]`
                //let lights = `,\n"lights": [\n   {"type":"directional", "color":"FFFFFF", "pos":[5,10,5], "strength": 1, "show": false},\n   {"type":"ambient", "color":"FFFFFF", "pos":[5,10,5], "strength": 0.5, "show": false}\n]`
                let camera = `,\n"camera": {\n   ` + cameraType + `,\n   "camPosXYZ": [` + plugin.settings.camPosX + `,` + plugin.settings.camPosY + `,` + plugin.settings.camPosZ + `], "LookatXYZ": [0,0,0]\n}`
                let scene = `,\n"scene": {\n   "showGuiOverlay": ` + plugin.settings.autoShowGUI + `,\n   "autoRotation": [0, ` + autorotateY + `, 0],\n   "backgroundColor": "` + plugin.settings.standardColor.replace(/#/g, "") + `",\n   "showAxisHelper": false, "length": 5,\n   "showGridHelper": false, "gridSize": 10` + `\n}`
                let stl = `,\n"stl": {\n   "stlColorHexString": "` + plugin.settings.stlColor.replace(/#/g, "") + `",\n   "stlWireframe":` + plugin.settings.stlWireframe + `\n}`
                let ThreeD_block = `,\n"renderBlock": {\n   "widthPercentage": ` + plugin.settings.standardEmbedWidthPercentage + `,\n   "height": ` + plugin.settings.standardEmbedHeight + `,\n   "alignment": "` + plugin.settings.alignment + `"\n}`
                let codeBlockClosing = '\n```\n'

                // let lights = `,\n"lights": [\n${plugin.settings.lightSettings
                //     .map((light: { dropdownValue: string; color: string; position: [number, number, number]; intensity: number }) =>
                //         `   {"type":"${light.dropdownValue}", "color":"${light.color.replace("#", "")}", "pos":[${light.position.join(",")}], "strength": ${light.intensity}, "show": false}`
                //     )
                //     .join(",\n")}\n]`;

                // Assuming you have imported or defined the updated LightSetting type:
                let lights = `,\n"lights": [\n${plugin.settings.lightSettings
                    .map((light: LightSetting) => {
                      const defaultColor = "#FFFFFF";
                      const colorString = (light.color ?? defaultColor).replace("#", "");
                      const posString = light.position ? light.position.join(",") : "0,0,0";
                  
                      if (light.dropdownValue === "hemisphere") {
                        const groundColor = (light.secondaryColor ?? defaultColor).replace("#", "");
                        return `   {"type": "hemisphere", "skyColor": "${colorString}", "groundColor": "${groundColor}", "strength": ${light.intensity}, "show": false}`;
                      } else if (light.dropdownValue === "directional" || light.dropdownValue === "spot") {
                        const targetString = light.targetPosition ? light.targetPosition.join(",") : "0,0,0";
                        if (light.dropdownValue === "spot") {
                          // For spotlights, include distance and angle.
                          const distanceValue = light.distance !== undefined ? light.distance : 0;
                          const angleValue = light.angle !== undefined ? light.angle : 0;
                          return `   {"type": "spot", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "distance": ${distanceValue}, "angle": ${angleValue}, "strength": ${light.intensity}, "show": false}`;
                        } else {
                          return `   {"type": "directional", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "strength": ${light.intensity}, "show": false}`;
                        }
                      } else {
                        return `   {"type": "${light.dropdownValue}", "color": "${colorString}", "pos": [${posString}], "strength": ${light.intensity}, "show": false}`;
                      }
                    })
                    .join(",\n")}\n]`;

                let content = ""
                if (plugin.settings.showConfig) {
                    content = codeBlockType + models + lights + camera + scene + stl + ThreeD_block + codeBlockClosing
                } else if (!plugin.settings.showConfig) {
                    content = codeBlockType + models + camera + lights + codeBlockClosing
                }
                editor.replaceSelection(content);
            }
        },
    });
}