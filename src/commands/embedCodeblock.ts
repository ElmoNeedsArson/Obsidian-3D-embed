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
                let codeBlockType = "\n```3D"
                //let name = `\n"name": "` + selection + `"`
                let models = `\n"models": [
   {"name": "` + selection + `", "scale": ` + plugin.settings.standardScale + `, 
   "position": [0, 0, 0], "rotation": [0, 0, 0]}
]`
                let lights = `,\n"lights": [
   {"type":"directional", "color":"FFFFFF", "pos":[5,10,5], "strength": 1, "show": false},
   {"type":"ambient", "color":"FFFFFF", "pos":[5,10,5], "strength": 0.5, "show": false}
]`              
                let cameraType = ""
                if (plugin.settings.cameraType == "Orthographic") {
                    cameraType = `"orthographic": true`
                } else {
                    cameraType = `"orthographic": false`
                }
                let camera = `,\n"camera": {
   ` + cameraType + `, 
   "camPosXYZ": [0,5,10], "LookatXYZ": [0,0,0]
}`
                
                let scene = `,\n"scene": { 
   "showGuiOverlay": ` + plugin.settings.autoShowGUI + `, 
   "autoRotation": [0, ` + autorotateY + `, 0], 
   "backgroundColorHexString": "` + plugin.settings.standardColor.replace(/#/g, "") + `", 
   "showAxisHelper": false, "length": 5, "showGridHelper": false, "gridSize": 10` + `
}`

                let stl = `,\n"stl": {
   "stlColorHexString": "` + plugin.settings.stlColor.replace(/#/g, "") + `",
   "stlWireframe":` + plugin.settings.stlWireframe + `
}`
                // let cameraPos = `,\n"camPosXYZ": [0,5,10]`
                // //let cameraRot = `,\n"camRotXYZ": [0,0,0]`
                // let cameraLookat = `,\n"LookatXYZ": [0,0,0]`

                //let GUI = `,\n"showGuiOverlay": ` + plugin.settings.autoShowGUI
                //let rotation = `,\n"rotationX": 0, "rotationY": 0, "rotationZ": 0`
                //let autoRotation = `,\n"autoRotation": [0, ` + autorotateY + `, 0]`
                //let position = `,\n"positionX": 0, "positionY": 0, "positionZ": 0`
                // let showTransformControls = `,\n"showTransformControls": false`
                //let scale = `,\n"scale": "` + plugin.settings.standardScale + `"`
                //let objectColor = `,\n"stlColorHexString": "` + plugin.settings.stlColor.replace(/#/g, "") + `"`
                //let wireFrame = `,\n"stlWireframe":` + plugin.settings.stlWireframe
                //let backgroundColor = `,\n"backgroundColorHexString": "` + plugin.settings.standardColor.replace(/#/g, "") + `"`
                
                // let attachLightToCam = `,\n"attachLightToCam": ` + plugin.settings.attachLightToCam
                // let lightColor_AttachedCam = `,\n"lightColor_AttachedCam": "` + plugin.settings.standardLightColor_AttachedCam.replace(/#/g, "") + `"`
                // let lightStrength_AttachedCam = `,\n"lightStrength_AttachedCam":` + plugin.settings.standardlightStrength_AttachedCam

                // let lightColor = `,\n"lightColor": "` + plugin.settings.standardLightColor.replace(/#/g, "") + `"`
                // let lightStrength = `,\n"lightStrength":` + plugin.settings.standardlightStrength
                // let showLight = `,\n"showLight":` + plugin.settings.standardshowLight
                // let lightPos = `,\n"lightPosXYZ": [` + plugin.settings.standardlightPosX + `,` + plugin.settings.standardlightPosY + `,` + plugin.settings.standardlightPosZ + `]`

                //let showAxisHelper = `,\n"showAxisHelper": false, "length": 5`
                //let showGridHelper = `,\n"showGridHelper": false, "gridSize": 10`
                let codeBlockClosing = '\n```\n'
                let content = ""
                if (plugin.settings.showConfig) {
                    content = codeBlockType + models + lights + camera + scene + stl + codeBlockClosing
                    //content = codeBlockType + name + GUI + rotation + autoRotate + position + scale + objectColor + wireFrame + backgroundColor + attachLightToCam + lightColor_AttachedCam + lightStrength_AttachedCam + lightColor + lightStrength + showLight + lightPos + cameraType + cameraPos + cameraLookat + showAxisHelper + showGridHelper + codeBlockClosing
                } else if (!plugin.settings.showConfig) {
                    content = codeBlockType + models + lights + codeBlockClosing
                    //content = codeBlockType + name + rotation + position + backgroundColor + cameraPos + cameraLookat + codeBlockClosing
                }
                editor.replaceSelection(content);
            }
        },
    });
}