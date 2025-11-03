import { Editor, Notice } from 'obsidian';
import ThreeJSPlugin from '../main';
import { LightSetting } from '../settings'; // adjust as needed
// try this first (modern): 
import { foldEffect } from '@codemirror/language';

// fallback if your environment exposes fold in a different package, you can try:
// import { foldEffect } from '@codemirror/fold';


export function ThreeD_Embed_Command(plugin: ThreeJSPlugin) {
  plugin.addCommand({
    id: "Add a 3D embed at the cursorposition",
    name: "Single Scene: Add a 3D embed at the cursorposition",
    editorCallback: (editor: Editor) => {
      let selection = editor.getSelection().trim();
      let modelNames: string[] = [];

      // If nothing selected, check the current line for embeds
      if (!selection) {
        const lineNumber = editor.getCursor().line;
        const lineText = editor.getLine(lineNumber);
        const matches = Array.from(lineText.matchAll(/\[\[(.*?)\]\]/g));
        modelNames = matches.map(m => m[1]);
      } else {
        // User selected text — may contain multiple embeds
        const matches = Array.from(selection.matchAll(/\[\[(.*?)\]\]/g));
        modelNames = matches.map(m => m[1]);
      }

      if (modelNames.length === 0) {
        new Notice("No 3D model references found (expected syntax: ![[model.obj]])", 4000);
        return;
      }

      // Verify models exist and filter missing ones
      const validModels = modelNames.filter(name => {
        const path = plugin.getModelPath(name);
        if (!path) {
          new Notice(`Model not found: '${name}'`, 4000);
          return false;
        }
        return true;
      });

      if (validModels.length === 0) {
        new Notice("No valid models found in selection.", 4000);
        return;
      }

      // Build models array JSON string
      const modelsJSON = validModels
        .map((name, idx) => {
          return `   {"name": "${name}", "scale": ${plugin.settings.standardScale}, "position": [0, 0, ${idx * 5}], "rotation": [0, 0, 0]}`;
        })
        .join(",\n");

      let autorotateY = plugin.settings.autoRotate ? 0.001 : 0;
      let cameraType = plugin.settings.cameraType == "Orthographic"
        ? `"orthographic": true`
        : `"orthographic": false`;

      let codeBlockType = "\n```3D";
      let models = `\n"models": [\n${modelsJSON}\n]`;
      let camera = `,\n"camera": {\n   ${cameraType},\n   "camPosXYZ": [${plugin.settings.camPosX},${plugin.settings.camPosY},${plugin.settings.camPosZ}], "LookatXYZ": [0,0,0]\n}`;
      let scene = `,\n"scene": {\n   "showGuiOverlay": ${plugin.settings.autoShowGUI},\n   "autoRotation": [0, ${autorotateY}, 0],\n   "backgroundColor": "${plugin.settings.colorChoice === "transparent" ? "transparent" : plugin.settings.standardColor.replace(/#/g, "")}",\n   "showGroundShadows": ${plugin.settings.showGroundShadows},\n   "orbitControlDamping": ${plugin.settings.dampedOrbit},\n   "showAxisHelper": false, "length": 5,\n   "showGridHelper": false, "gridSize": 10\n}`;
      let stl = `,\n"stl": {\n   "stlColorHexString": "${plugin.settings.stlColor.replace(/#/g, "")}",\n   "stlWireframe": ${plugin.settings.stlWireframe}\n}`;
      let ThreeD_block = `,\n"renderBlock": {\n   "widthPercentage": ${plugin.settings.standardEmbedWidthPercentage},\n   "height": ${plugin.settings.standardEmbedHeight},\n   "alignment": "${plugin.settings.alignment}"\n}`;
      let codeBlockClosing = "\n```\n";

      // let lights = `,\n"lights": [\n${plugin.settings.lightSettings
      //   .map((light: LightSetting) => {
      //     const defaultColor = "#FFFFFF";
      //     const colorString = (light.color ?? defaultColor).replace("#", "");
      //     const posString = light.position ? light.position.join(",") : "0,0,0";

      //     if (light.dropdownValue === "hemisphere") {
      //       const groundColor = (light.secondaryColor ?? defaultColor).replace("#", "");
      //       return `   {"type": "hemisphere", "skyColor": "${colorString}", "groundColor": "${groundColor}", "strength": ${light.intensity}, "show": false}`;
      //     } else if (light.dropdownValue === "directional" || light.dropdownValue === "spot") {
      //       const targetString = light.targetPosition ? light.targetPosition.join(",") : "0,0,0";
      //       if (light.dropdownValue === "spot") {
      //         const distanceValue = light.distance ?? 0;
      //         const angleValue = light.angle ?? 0;
      //         return `   {"type": "spot", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "distance": ${distanceValue}, "angle": ${angleValue}, "strength": ${light.intensity}, "show": false}`;
      //       } else {
      //         return `   {"type": "directional", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "strength": ${light.intensity}, "show": false}`;
      //       }
      //     } else {
      //       return `   {"type": "${light.dropdownValue}", "color": "${colorString}", "pos": [${posString}], "strength": ${light.intensity}, "show": false}`;
      //     }
      //   })
      //   .join(",\n")}\n]`;

      // Build final block

      let lights = `,\n"lights": [\n${plugin.settings.lightSettings
        .map((light: LightSetting) => {
          const defaultColor = "#FFFFFF";
          const colorString = (light.color ?? defaultColor).replace("#", "");
          const posString = light.position ? light.position.join(",") : "0,0,0";
          if (light.castShadows === undefined) {
            light.castShadows = true; // default to true if undefined
          }
          const castShadows = light.castShadows ? "true" : "false"; // new boolean setting

          if (light.dropdownValue === "hemisphere") {
            const groundColor = (light.secondaryColor ?? defaultColor).replace("#", "");
            return `   {"type": "hemisphere", "skyColor": "${colorString}", "groundColor": "${groundColor}", "strength": ${light.intensity}, "show": false}`;
          }
          else if (light.dropdownValue === "spot") {
            const targetString = light.targetPosition ? light.targetPosition.join(",") : "0,0,0";
            const distanceValue = light.distance ?? 0;
            const angleValue = light.angle ?? 0;
            return `   {"type": "spot", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "distance": ${distanceValue}, "angle": ${angleValue}, "strength": ${light.intensity}, "castShadows": ${castShadows}, "show": false}`;
          }
          else if (light.dropdownValue === "directional") {
            const targetString = light.targetPosition ? light.targetPosition.join(",") : "0,0,0";
            return `   {"type": "directional", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "strength": ${light.intensity}, "castShadows": ${castShadows}, "show": false}`;
          }
          else if (light.dropdownValue === "point") {
            return `   {"type": "point", "color": "${colorString}", "pos": [${posString}], "strength": ${light.intensity}, "castShadows": ${castShadows}, "show": false}`;
          }
          else {
            return `   {"type": "${light.dropdownValue}", "color": "${colorString}", "pos": [${posString}], "strength": ${light.intensity}, "show": false}`;
          }
        })
        .join(",\n")}\n]`;

      let content = "";
      if (plugin.settings.showConfig) {
        content = codeBlockType + models + lights + camera + scene + stl + ThreeD_block + codeBlockClosing;
      } else {
        content = codeBlockType + models + camera + lights + codeBlockClosing;
      }

      editor.replaceSelection(content);
    },
  });
}
