Add this to readme:
| <img alt="1" src="https://github.com/user-attachments/assets/f2a2a5c5-8018-4ca7-9254-a29f67864104" /> | <img alt="2" src="https://github.com/user-attachments/assets/cb89e299-11d5-4ea6-a654-3302926c3c51" /> |
|:--:|:--:|
| <img alt="4" src="https://github.com/user-attachments/assets/ba47623c-4036-4b26-a134-9442f742940d" /> | <img alt="3" src="https://github.com/user-attachments/assets/7de120bb-6c2b-4cd7-81fb-861232e05ef9" /> |

# 3D Embed Plugin - How to use

Currently supported filetypes: `stl, glb, obj, fbx, 3mf`

This plugin allows you to showcase all sorts of 3D models in your vault and notes using the infamous three.js library. As opposed to other plugins this plugin allows you to embed your 3D models locally. This means you **won't** have to upload your models to some other website and embed that in your note, but rather just have the file in your vault and the plugin does all the other work for you.

This plugin also allows you to make your scene with the whole model look as nice as possible. Influencing a lot of variables such as background colors, autorotation, lighting, scales, etc. [Look at the documentation below for all the options]

> [!Note]
> Developer Note!: If the plugin misses anything, feel free to open a github [issue](https://github.com/ElmoNeedsArson/Obsidian-3D-embed/issues) or tag me in the obsidian [discord](https://discord.com/invite/obsidianmd) `@jesse5`. I am very open to suggestions and bugfixes and love hearing them :)

> [!Tip]
> If you like my plugin feel free to leave a star on my [repository](https://github.com/ElmoNeedsArson/Obsidian-3D-embed) (it's like a reward)

## 1. IMPORTANT!: Showing all filetypes in obsidian:
Go to the settings tab of obsidian -> 'Files and Links' -> toggle the 'Detect all file extensions'
![image](https://github.com/user-attachments/assets/d5e27828-1a29-4870-8294-52e9011e2083)
This allows you to see every type of file in your obsidian vault, including 3D model files such as stl. 

## 2. Watch this video that showcases how to use the plugin:


https://github.com/user-attachments/assets/9b10c36c-36c3-4bc1-a4a7-f5d00f735ec7



## 3. Or read these images and text:

|![Screenshot 2024-11-03 184117](https://github.com/user-attachments/assets/245386b4-5f41-4bf3-8afa-55287cd46207)|![Screenshot 2024-11-03 184225](https://github.com/user-attachments/assets/cad3f9f5-d1bd-4b61-a816-79ce3fc0a00e)|
|:--:|:--:|
|1. Drag Model from file overview/manager into note as an embed | 2. position cursor on line with 3D model embed|

|![image](https://github.com/user-attachments/assets/c75579e8-a051-433c-ab64-486aa30fd9da)|![image](https://github.com/user-attachments/assets/6e142009-9cfb-44e4-b1a9-1457f288f55f)|
|:--:|:--:|
|3. On line with embed execute the embed 3D command (ctrl+p) -> Embed 3D: Add a 3D embed at cursor position|4. Voila a 3D model|

## 3.1 Alternatively
Version 1.1.0 also allows you to include grids of 3D models in your vault if you wanna showcase multiple models or perspectives at once
| ![obsidian grid](https://github.com/user-attachments/assets/33209e18-9c39-40b3-8d2c-d2164d7edcb5) | <img alt="image of grid of 3D models" src="https://github.com/user-attachments/assets/29a88191-8a65-40a4-ada2-46415fbc76f9" /> |
|:--:|:--:|
|Video of getting a grid|possible view of a grid| Voila a Grid|
To get the grid, similarly to the instructions above, drag in all the models you want. Select all the models with your a drag selection, and execute the grid command: (ctrl+p) -> Embed 3D: Add a 3D grid embed from selection.

# Additional Information
Each embed will contain a codeblock of information. You can access this by clicking in the top right of the scene OR by moving your type cursor into the codeblock

![image](https://github.com/user-attachments/assets/427a00bc-faa0-4764-8e9b-0302a1712553)

This codeblock will allow you to modify settings for this block only. If you want settings to be generally applied to all scenes you embed you should go to the settings tab. 

## Minimal Configuration
A codeblock should minimally contain these values:
```JSON
"models": [
   {"name": "Airship.glb", "scale": 0.7, "position": [0, 0, 0], "rotation": [0, 0, 0]}
],
"camera": {
   "orthographic": false,
   "camPosXYZ": [0,5,10], "LookatXYZ": [0,0,0]
},
"lights": [
   {"type": "directional", "color": "FFFFFF", "pos": [5,10,5], "target": [0,0,0], "strength": 1, "show": false},
   {"type": "ambient", "color": "FFFFFF", "pos": [0,0,0], "strength": 0.5, "show": false}
]
```

But this is just the tip of the iceberg! The codeblock can receive a lot more variables to modify the scene and give you more control. 

> [!Important]
> The last line of the codeblock should not end on a comma, all other lines should (The codeblock uses JSON structure)

## Additional Configuration
Look at the codeblock to alter minor things in the scene. It shows all the config options of a 3D scene for now. 

Beside the basic configuration, these are lines you can add for more control:

### Model settings
This will come preloaded when entering the command, but this config allows you to change elements about the model(s).
You can add multiple models in this array to render multiple models in one scene at the same time. 
```JSON
"models": [
   {"name": "Airship.glb", "scale": 0.7, "position": [0, 0, 0], "rotation": [0, 0, 0]}
],
```
- `name` is the name of the file of the 3D model in your vault
- `scale` is the scale of the object related to your export size
- `position` allows you to change the position of the model in the scene
- `rotation` allows you to change the rotation of the model in the scene 

### Render block settings
To change the width or height, or the css alignment of a block:
```JSON
"renderBlock": {
   "widthPercentage": 100,
   "height": 300,
   "alignment": "center"
}
```
- `widthPercentage` goes from 1 - 100
- `height` is in pixels
- `alignment` has 3 options (begin, center, end)

### Generic Scene Settings
To change some other scene settings:
```JSON
"scene": {
   "showGuiOverlay": false,
   "autoRotation": [0, 0, 0],
   "backgroundColor": "4bb8dd",
   "showAxisHelper": false, "length": 5,
   "showGridHelper": false, "gridSize": 10
},
```
- `showGuiOverlay` provides you with a gui (see further down)
- `autoRotation` rotates your model automatically on any axis
- `backgroundColor` can also be set to `transparent` or any hexvalue for a color. 
- `showAxisHelper` and `showGridHelper` show scene helpers such as a grid or the main axis

### STL Configurations
Specifically for stl model files, I added some additional configuration
```JSON
"stl": {
   "stlColorHexString": "ff0000",
   "stlWireframe":false
},
```
- `stlColorHexString` allows you to set the color of an stl model itself
- `stlWireframe` allows you to show the stl as a wireframe

### Lighting Configuration
Lighting settings such as type, color, position, strength and whether you can see a sphere at the location of the light
```JSON
"lights": [
   {"type": "directional", "color": "FFFFFF", "pos": [5,10,5], "target": [0,0,0], "strength": 1, "show": false},
   {"type": "ambient", "color": "FFFFFF", "pos": [0,0,0], "strength": 0.5, "show": false},
   {"type": "attachToCam", "color": "ffffff", "pos": [5,10,5], "strength": 1, "show": false},
   {"type": "point", "color": "ffffff", "pos": [5,10,5], "strength": 1, "show": false},
   {"type": "spot", "color": "ffffff", "pos": [5,10,5], "target": [0,0,0], "distance": 0, "angle": 0, "strength": 1, "show": false},
   {"type": "hemisphere", "skyColor": "ffffff", "groundColor": "FFFFFF", "strength": 1, "show": false}
],
```
- `type` has 6 options `directional, ambient, attachToCam, point, spot, hemisphere` (each of them can be found in the three.js documentation if you want to read more. Except for `attachToCam` which just attaches a lightsource to the camera)
- `color` allows you to set a hexvalue for the color of the light
- `position` allows you to set the position of the lightsource
- `strength` allows you to set the strength of the lightsource
- `show` allows you to physically see the lightsource position by placing a sphere at the position coordinates you provide (can be usefull for setting up your scene)
- `target` only available in the `directional` and `spot` lightsource, to aim it at a point
- `distance` only available in the `spot` lightsource, allows you to say how far the light projects
- `angle` only available in the `spot` lightsource, allows you to adjust the angle of the spotlight
- `skycolor` and `groundColor` are part of the `hemisphere` lightsource, for a color transition. (look at three.js documentation for more details)

### Camera configuration
To change camera settings:
```JSON
"camera": {
   "orthographic": false,
   "camPosXYZ": [0,5,10], "LookatXYZ": [0,0,0]
},
```
- `orthographic` allows you to switch between a perspective and orthographic camera
- `camPosXYZ` allows you to set the camera position
- `LookatXYZ` allows you to aim the camera at a specific point

### GUI (BETA)
Now working with a codeblock might be a tad annoying to finetune your models. So I've been working on a GUI that allows you to change some of the parameters with more ease. 
By changing this option in your config of the scene to true
```JSON
"scene": {
   "showGuiOverlay": false | true,
},
```
You can use transform controls and color pickers to finetune your scene a bit better. See the images below, you have a color picker (becomes unavailable when your background color is set to `transparent`), a rotation tool, a position tool and moving the camera. When clicking the checkmark, the scene will be saved as is in the config. But you can also reset it if you mess up somehow. 
[OUTDATED IMAGES] 
![image](https://github.com/user-attachments/assets/3b594b76-234d-40a0-bac2-356b95150df8)

## Standard Settings
Use the settings tab, to alter standard settings for how all the models are initially loaded. The settings tab has the same options as the codeblock above, but are global settings, the codeblock for each model will override the global setting if they are different. But the codeblocks initial values will be filled according to the global settings. Such as background color, size of 3D embed, or scale of the model. 
![image](https://github.com/user-attachments/assets/b7df88bf-75e2-4066-a685-8dfa11478816)

## Precautions:
1) The plugin can currently support 16 models at one time being rendered, but due to refreshing issues, contexts might be lost sometimes needing you to trigger the codeblock again to render the model. I am trying to fix this. 
2) Big models will be laggy, since obsidian has a limited amount of RAM that cannot be altered.
3) If your model is not showing up in the scene, half of the time the scale of the model is the cause, so try playing around with sizes both large and small. 

## Future plans:
1) Load textures in 3D models
2) Be able to run custom three.js script for a scene. 
3) Camera Path Animations
4) More intuitive GUI for editing scenes
5) Loading .blend files (Unsure of possibility)

