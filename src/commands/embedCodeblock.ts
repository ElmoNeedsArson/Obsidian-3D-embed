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
          console.log("CastShadows value: " + light.castShadows);
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

      // Replace selection or insert at cursor
      //console.log("Inserting 3D embed code block at:\n" + editor.getCursor().line);
      //editor.replaceSelection(content);

      // --- after editor.replaceSelection(content); ---

      //const sectionsToFold = ["scene", "camera", "lights"];

      // Helper: find matching closing brace for a JSON object starting at bracePos (offsets)
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


      // Inserted content already put into the editor
      console.log("Inserting 3D embed code block at:\n" + editor.getCursor().line);
      editor.replaceSelection(content);

      // Try to get the CodeMirror 6 EditorView from Obsidian's editor object.
      // Different Obsidian/CM versions expose it as `editor.cm` or `editor.cm?.editor` etc.
      // We'll try common patterns:
      // const cmView = (editor as any).cm || (editor as any).cmEditor || (editor as any).cm?.view;

      // // If you don't get an EditorView here, log and bail (you can inspect console)
      // if (!cmView) {
      //   // best-effort: attempt to use obsidian API to find the MarkdownView editor's cm view
      //   // const mdView = (plugin.app.workspace.getActiveViewOfType(MarkdownView) as any);
      //   // cmView = mdView?.editor?.cm;
      //   console.warn("ThreeJS plugin: couldn't get CodeMirror EditorView for folding. cmView:", cmView);
      // } else {
      //   try {
      //     const docText = cmView.state.doc.toString();

      //     // compute the insertion start offset — the selection start before we inserted.
      //     // If you stored the cursor position before replacing, prefer that.
      //     // Here we derive it from the selection (the selection has moved to end of inserted text after replace).
      //     // So we compute the likely insertion range as: end - content.length ... end
      //     const selectionAfter = cmView.state.selection.main;
      //     const insertEnd = selectionAfter.to;
      //     const insertStart = Math.max(0, insertEnd - content.length);

      //     // search for the '"scene"' key inside the newly inserted text
      //     // --- after insertion, automatically fold configured sections ---

      //     // Which sections to auto-collapse
      //     const sectionsToFold = ["scene", "camera", "lights"]; // add/remove freely

      //     const cellMatches = docText
      //       .slice(insertStart, insertEnd)
      //       .matchAll(/"cell\d+"/g);

      //     for (const match of cellMatches) {
      //       sectionsToFold.push(match[0].replace(/"/g, "")); // strip quotes
      //     }

      //     console.log(sectionsToFold)

      //     for (const key of sectionsToFold) {
      //       const keyIndex = docText.indexOf(`"${key}"`, insertStart);
      //       if (keyIndex === -1 || keyIndex > insertEnd) continue;

      //       // Find the first opening symbol ({ or [) after the key
      //       const nextBrace = docText.indexOf("{", keyIndex);
      //       const nextBracket = docText.indexOf("[", keyIndex);

      //       // Pick whichever appears first (and is valid)
      //       const openingPos = [nextBrace, nextBracket]
      //         .filter(i => i !== -1)
      //         .sort((a, b) => a - b)[0];

      //       if (openingPos === undefined || openingPos > insertEnd) {
      //         console.warn(`ThreeJS plugin: couldn't find opening brace/bracket for '${key}'`);
      //         continue;
      //       }

      //       // Determine the matching closer
      //       const closingPos = findMatchingBrace(docText, openingPos);
      //       if (closingPos === -1) {
      //         console.warn(`ThreeJS plugin: couldn't find closing for '${key}'`);
      //         continue;
      //       }

      //       // Dispatch fold for this section
      //       cmView.dispatch({
      //         effects: (foldEffect as any).of({ from: openingPos, to: closingPos + 1 })
      //       });

      //       console.log(`Folded section: ${key}`);
      //     }

      //   } catch (e) {
      //     console.error("ThreeJS plugin: error while attempting to fold 'scene' section:", e);
      //   }
      // }

    },
  });
}
