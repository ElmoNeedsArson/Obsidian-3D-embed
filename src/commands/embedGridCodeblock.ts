import { Editor, Notice } from 'obsidian';
import ThreeJSPlugin from '../main';
import { LightSetting } from '../settings';

export function ThreeD_Embed_Grid_Command(plugin: ThreeJSPlugin) {
  plugin.addCommand({
    id: "Add a 3D grid embed from selection",
    name: "Grid: Add a 3D grid embed from selection",
    editorCallback: (editor: Editor) => {
      const selection = editor.getSelection();

      if (!selection || selection.trim() === "") {
        new Notice("Please select one or more model references [[model.stl]]", 5000);
        return;
      }

      const matches = Array.from(selection.matchAll(/\[\[(.*?)\]\]/g));

      if (matches.length === 0) {
        new Notice("No valid model references found in selection.", 5000);
        return;
      }

      const cells: string[] = [];
      let cellIndex = 1;

      matches.forEach((match, index) => {
        const modelName = match[1];
        const modelPath = plugin.getModelPath(modelName);

        if (!modelPath) {
          new Notice(`Model '${modelName}' cannot be found in your vault`, 5000);
          return;
        }

        const autorotateY = plugin.settings.autoRotate ? 0.001 : 0;
        const cameraType = plugin.settings.cameraType === "Orthographic" ? true : false;

        // Build the JSON string for this cell manually to avoid wrapping braces
        const cellJSON = `"cell${cellIndex}": {
   "models": [
      {"name": "${modelName}", "scale": ${plugin.settings.standardScale}, "position": [0,0,0], "rotation": [0,0,0]}
   ],
   "lights": [
${plugin.settings.lightSettings.map((light: LightSetting) => {
          const colorString = (light.color ?? "#FFFFFF").replace("#", "");
          const posString = light.position ?? [0, 0, 0];
          const targetString = light.targetPosition ?? [0, 0, 0];
          switch (light.dropdownValue) {
            case "hemisphere":
              const groundColor = (light.secondaryColor ?? "#FFFFFF").replace("#", "");
              return `      {"type": "hemisphere", "skyColor": "${colorString}", "groundColor": "${groundColor}", "strength": ${light.intensity}, "show": false}`;
            case "spot":
              return `      {"type": "spot", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "distance": ${light.distance ?? 0}, "angle": ${light.angle ?? 0}, "strength": ${light.intensity}, "show": false}`;
            case "directional":
              return `      {"type": "directional", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "strength": ${light.intensity}, "show": false}`;
            default:
              return `      {"type": "${light.dropdownValue}", "color": "${colorString}", "pos": [${posString}], "strength": ${light.intensity}, "show": false}`;
          }
        }).join(",\n")}\n   ],
  "camera": {
      "orthographic": ${cameraType},
      "camPosXYZ": [${plugin.settings.camPosX}, ${plugin.settings.camPosY}, ${plugin.settings.camPosZ}],
      "LookatXYZ": [0,0,0]
  },
  "scene": {
      "showGuiOverlay": false,
      "autoRotation": [0, ${autorotateY}, 0],
      "backgroundColor": "${plugin.settings.standardColor.replace(/#/g, "")}",
      "orbitControlDamping": ${plugin.settings.dampedOrbit},
      "showAxisHelper": false,
      "length": 5,
      "showGridHelper": false,
      "gridSize": 10
  },
  "stl": {
      "stlColorHexString": "${plugin.settings.stlColor.replace(/#/g, "")}",
      "stlWireframe": ${plugin.settings.stlWireframe}
  }
}`;
        cells.push(cellJSON);
        cellIndex++;
      });

      // Build final block manually to avoid extra braces
      const codeBlock = "```3D-grid\n" +
        `"gridSettings": {\n   "columns": ${plugin.settings.columnsAmount},\n   "rowHeight": ${plugin.settings.rowHeight},\n   "gapX": ${plugin.settings.gapX},\n   "gapY": ${plugin.settings.gapY}\n},\n` +
        cells.join(",\n") +
        "\n```\n";

      editor.replaceSelection(codeBlock);
      new Notice("3D grid embed created!", 3000);
    }
  });
}
