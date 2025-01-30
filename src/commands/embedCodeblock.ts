import { Editor, Notice } from 'obsidian';

import ThreeJSPlugin from '../main';

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
            if (!modelPath) { new Notice("This model cannot be found", 5000); }
            else if (modelPath) {

                let autorotateY = plugin.settings.autoRotate ? 0.001 : 0
                let codeBlockType = "\n```3D\n{"
                let name = `\n"name": "` + selection + `"`
                let GUI = `,\n"showGuiOverlay": ` + plugin.settings.autoShowGUI
                let rotation = `,\n"rotationX": 0, "rotationY": 0, "rotationZ": 0`
                let autoRotate = `,\n"AutorotateX": 0, "AutorotateY":` + autorotateY + `, "AutorotateZ": 0`
                let position = `,\n"positionX": 0, "positionY": 0, "positionZ": 0`
                let showTransformControls = `,\n"showTransformControls": false`
                let scale = `,\n"scale": "` + plugin.settings.standardScale + `"`
                let objectColor = `,\n"stlColorHexString": "` + plugin.settings.stlColor.replace(/#/g, "") + `"`
                let wireFrame = `,\n"stlWireframe":` + plugin.settings.stlWireframe
                let backgroundColor = `,\n"backgroundColorHexString": "` + plugin.settings.standardColor.replace(/#/g, "") + `"`
                
                let attachLightToCam = `,\n"attachLightToCam": ` + plugin.settings.attachLightToCam
                let lightColor = `,\n"lightColor": "` + plugin.settings.standardLightColor.replace(/#/g, "") + `"`
                let lightStrength = `,\n"lightStrength":` + plugin.settings.standardlightStrength
                let showLight = `,\n"showLight":` + plugin.settings.standardshowLight
                let lightPos = `,\n"lightPosXYZ": [` + plugin.settings.standardlightPosX + `,` + plugin.settings.standardlightPosY + `,` + plugin.settings.standardlightPosZ + `]`

                let cameraType = ""
                if (plugin.settings.cameraType == "Orthographic") {
                    cameraType = `,\n"orthographic": true`
                } else {
                    cameraType = `,\n"orthographic": false`
                }

                let cameraPos = `,\n"camPosXYZ": [0,5,10]`
                //let cameraRot = `,\n"camRotXYZ": [0,0,0]`
                let cameraLookat = `,\n"LookatXYZ": [0,0,0]`
                let showAxisHelper = `,\n"showAxisHelper": false, "length": 5`
                let showGridHelper = `,\n"showGridHelper": false, "gridSize": 10`
                let codeBlockClosing = '\n}\n```\n'
                let content = ""
                if (plugin.settings.showConfig) {
                    content = codeBlockType + name + GUI + rotation + autoRotate + position + showTransformControls + scale + objectColor + wireFrame + backgroundColor + attachLightToCam + lightColor + lightStrength + showLight + lightPos + cameraType + cameraPos + cameraLookat + showAxisHelper + showGridHelper + codeBlockClosing
                } else if (!plugin.settings.showConfig) {
                    content = codeBlockType + name + GUI + rotation + position + backgroundColor + cameraPos + cameraLookat + codeBlockClosing
                }
                editor.replaceSelection(content);
            }
        },
    });
}