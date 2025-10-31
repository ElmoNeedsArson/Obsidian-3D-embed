import { Editor, Notice } from 'obsidian';
import ThreeJSPlugin from '../main';
import { LightSetting } from '../settings';
import { foldEffect } from '@codemirror/language';

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
          const castShadows = light.castShadows ? "true" : "false"; // new boolean property

          switch (light.dropdownValue) {
            case "hemisphere":
              const groundColor = (light.secondaryColor ?? "#FFFFFF").replace("#", "");
              return `      {"type": "hemisphere", "skyColor": "${colorString}", "groundColor": "${groundColor}", "strength": ${light.intensity}, "show": false}`;

            case "spot":
              return `      {"type": "spot", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "distance": ${light.distance ?? 0}, "angle": ${light.angle ?? 0}, "strength": ${light.intensity}, "castShadows": ${castShadows}, "show": false}`;

            case "directional":
              return `      {"type": "directional", "color": "${colorString}", "pos": [${posString}], "target": [${targetString}], "strength": ${light.intensity}, "castShadows": ${castShadows}, "show": false}`;

            case "point":
              return `      {"type": "point", "color": "${colorString}", "pos": [${posString}], "strength": ${light.intensity}, "castShadows": ${castShadows}, "show": false}`;

            default:
              return `      {"type": "${light.dropdownValue}", "color": "${colorString}", "pos": [${posString}], "strength": ${light.intensity}, "show": false}`;
          }
        }).join(",\n")}\n   ],
   "camera": { 
      "orthographic": ${cameraType}, 
      "camPosXYZ": [${plugin.settings.camPosX}, ${plugin.settings.camPosY}, ${plugin.settings.camPosZ}], 
      "LookatXYZ": [0,0,0]},
   "scene": {
      "showGuiOverlay": false, 
      "orbitControlDamping": ${plugin.settings.dampedOrbit}, 
      "showGroundShadows": ${plugin.settings.showGroundShadows},
      "autoRotation": [0, ${autorotateY}, 0], 
      "backgroundColor": "${(plugin.settings.colorChoice === "transparent" ? "transparent" : plugin.settings.standardColor.replace(/#/g, ""))}",
      "showAxisHelper": false, "length": 5, 
      "showGridHelper": false, "gridSize": 10
   }${modelName.toLowerCase().endsWith(".stl") ? `,\n   "stl": {\n      "stlColorHexString": "${plugin.settings.stlColor.replace(/#/g, "")}",\n      "stlWireframe": ${plugin.settings.stlWireframe}\n   }`: ""}\n}`;
        cells.push(cellJSON);
        cellIndex++;
      });

      // Build final block manually to avoid extra braces
      const codeBlock = "```3D-grid\n" +
        `"gridSettings": { "columns": ${plugin.settings.columnsAmount}, "rowHeight": ${plugin.settings.rowHeight}, "gapX": ${plugin.settings.gapX}, "gapY": ${plugin.settings.gapY} },\n` +
        cells.join(",\n") +
        "\n```\n";

      function findMatchingBrace(text: string, startIndex: number): number {
        const openChar = text[startIndex];
        const closeChar = openChar === '{' ? '}' : ']';
        let depth = 0;

        for (let i = startIndex; i < text.length; i++) {
          if (text[i] === openChar) depth++;
          else if (text[i] === closeChar) depth--;
          if (depth === 0) return i;
        }
        return -1; // No match found
      }

      editor.replaceSelection(codeBlock);

      const cmView = (editor as any).cm || (editor as any).cmEditor || (editor as any).cm?.view;

      if (!cmView) {
        console.warn("ThreeJS plugin: couldn't get CodeMirror EditorView for folding. cmView:", cmView);
      } else {
        try {
          const docText = cmView.state.doc.toString();

          // compute the insertion start offset — the selection start before we inserted.
          // If you stored the cursor position before replacing, prefer that.
          // Here we derive it from the selection (the selection has moved to end of inserted text after replace).
          // So we compute the likely insertion range as: end - content.length ... end
          const selectionAfter = cmView.state.selection.main;
          const insertEnd = selectionAfter.to;
          const insertStart = Math.max(0, insertEnd - codeBlock.length);

          // search for the '"scene"' key inside the newly inserted text
          // --- after insertion, automatically fold configured sections ---

          // Which sections to auto-collapse
          const sectionsToFold = []; // add/remove freely

          const cellMatches = docText
            .slice(insertStart, insertEnd)
            .matchAll(/"cell\d+"/g);

          for (const match of cellMatches) {
            sectionsToFold.push(match[0].replace(/"/g, "")); // strip quotes
          }

          console.log(sectionsToFold)

          for (const key of sectionsToFold) {
            const keyIndex = docText.indexOf(`"${key}"`, insertStart);
            if (keyIndex === -1 || keyIndex > insertEnd) continue;

            // Find the first opening symbol ({ or [) after the key
            const nextBrace = docText.indexOf("{", keyIndex);
            const nextBracket = docText.indexOf("[", keyIndex);

            // Pick whichever appears first (and is valid)
            const openingPos = [nextBrace, nextBracket]
              .filter(i => i !== -1)
              .sort((a, b) => a - b)[0];

            if (openingPos === undefined || openingPos > insertEnd) {
              console.warn(`ThreeJS plugin: couldn't find opening brace/bracket for '${key}'`);
              continue;
            }

            // Determine the matching closer
            const closingPos = findMatchingBrace(docText, openingPos);
            if (closingPos === -1) {
              console.warn(`ThreeJS plugin: couldn't find closing for '${key}'`);
              continue;
            }

            // Dispatch fold for this section
            cmView.dispatch({
              effects: (foldEffect as any).of({ from: openingPos, to: closingPos + 1 })
            });

            console.log(`Folded section: ${key}`);
          }

        } catch (e) {
          console.error("ThreeJS plugin: error while attempting to fold 'scene' section:", e);
        }
      }
    }
  });
}
