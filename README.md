# 3D Embed Plugin - How to use

Currently supported filetypes: stl,glb,obj,fbx,3mf

## 1. Showing all filetypes in obsidian:
Go to the settings tab of obsidian -> 'Files and Links' -> toggle the 'Detect all file extensions'
![image](https://github.com/user-attachments/assets/d5e27828-1a29-4870-8294-52e9011e2083)
This allows you to see every type of file in your obsidian vault, including 3D model files such as stl. 

## 2. Watch this video that showcases how to use the plugin:


https://github.com/user-attachments/assets/9b10c36c-36c3-4bc1-a4a7-f5d00f735ec7



## 3. Or read these images and text:
3.1) Drag Model from file overview/manager into note as an embed
![Screenshot 2024-11-03 184117](https://github.com/user-attachments/assets/245386b4-5f41-4bf3-8afa-55287cd46207)

3.2) position cursor on line with 3D model embed
![Screenshot 2024-11-03 184225](https://github.com/user-attachments/assets/cad3f9f5-d1bd-4b61-a816-79ce3fc0a00e)

3.3) On line with embed execute the embed 3D command (ctrl+p) -> embed 3D: 3DModel
![image](https://github.com/user-attachments/assets/c75579e8-a051-433c-ab64-486aa30fd9da)

3.4) Voila a 3D model
![image](https://github.com/user-attachments/assets/6e142009-9cfb-44e4-b1a9-1457f288f55f)

# Additional Information
Each embed will contain a codeblock of information. You can access this by clicking in the top right of the scene or my moving your type cursor into the codeblock

This codeblock will allow you to modify settings for this block only. If you want settings to be generally applied to all scenes you embed you should go to the settings tab. 

## Minimal Configuration
A codeblock should minimally contain these values:
```JSON
{
"name": "model.stl",
"rotationX": 0, "rotationY": 0, "rotationZ": 0,
"positionX": 0, "positionY": 0, "positionZ": 0,
"backgroundColorHexString": "80bcd6",
"camPosXYZ": [0,5,10],
"LookatXYZ": [0,0,0]
}
```

> [!Important]
> The last line of the codeblock should not end on a comma, all other lines should

But the codeblock can receive a lot more variables to modify the scene and give you more control. 

## Additional Configuration
Look at the codeblock to alter minor things in the scene. It shows all the config options of a 3D scene for now. 

Beside the basic configuration, these are lines you can add for more control:

### Generic Scene Settings
To rotate your model automatically on any axis
```
"AutorotateX": 0, "AutorotateY":0, "AutorotateZ": 0,
```

To set the scale of your model
```
"scale": "0.5",
```

To change the camera to an orthographic camera rather than a perspective camera
```
"orthographic": false,
```

To show scene helpers such as a grid or the main axis
```
"showAxisHelper": false, "length": 5,
```
```
"showGridHelper": false, "gridSize": 10,
```

### STL Configurations
To allow the stl model to be seen in wireframe mode and change the color
```
"stlColorHexString": "ffffff",
```
```
"stlWireframe":true,
```

### Lighting Configuration
Lighting settings such as color, strength, position and whether you can see a sphere at the location of the light
```
"lightColor": "ffffff",
```
```
"lightStrength":1,
```
```
"showLight":false,
```
```
"lightPosXYZ": [5,10,5],
```

Settings to attach a light to the camera, its color and intensity. 
```
"attachLightToCam": false,
```
```
"lightColor_AttachedCam": "FFFFFF",
```
```
"lightStrength_AttachedCam":1,
```

### GUI (BETA)
Now working with a codeblock might be a tad annoying to finetune your models. So I've been working on a GUI that allows you to change some of the parameters with more ease. 
Be changing this option in your config to true
```
"showGuiOverlay": false,
```
You can use transform controls and color pickers to finetune your scene a bit better. See the images below, you have a color picker, a rotation tool, a position tool and moving the camera. When clicking 'apply&reload' the scene will be saved as is in the config. But you can also reset it if you mess up somehow.  
![image](https://github.com/user-attachments/assets/ba911e8d-80c5-48ba-9698-bd534ffb9f4c)
![image](https://github.com/user-attachments/assets/edcacab3-1fdb-4e4a-b742-455026eecd64)

## Standard Settings
Use the settings tab, to alter standard settings such as background color, size of 3D embed, or scale of the model. 
![image](https://github.com/user-attachments/assets/b7df88bf-75e2-4066-a685-8dfa11478816)

## Precautions:
1) The plugin can currently support 16 models at one time being rendered, but due to refreshing issues, contexts might be lost sometimes needing you to trigger the codeblock again to render the model. I am trying to fix this. 
2) Big models will be laggy, since obsidian has a limited amount of RAM that cannot be altered.
3) If your model is not showing up in the scene, half of the time the scale of the model is the cause, so try playing around with sizes both large and small. 

## Future plans:
1) Use one renderer instead of a new renderer with introduction of a new model. (Uncertain of achievability)
2) Load textures in 3D models
3) Load multiple objects in one scene
4) Be able to run custom three.js script for a scene. 

