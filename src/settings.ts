import { App, PluginSettingTab, Setting } from 'obsidian';
import ThreeJSPlugin from './main';

export interface ThreeDEmbedSettings {
    showConfig: boolean,
    standardColor: string;
    standardScale: number;
    standardEmbedHeight: number;
    autoRotate: boolean;
    camPosX: number;
    camPosY: number;
    camPosZ: number;
    orthographicCam: boolean;
    cameraType: string;
    autoShowGUI: boolean;
    stlWireframe: boolean;
    stlColor: string;
    attachLightToCam: boolean;
    standardLightColor_AttachedCam: string;
    standardlightStrength_AttachedCam: number;
    standardLightColor: string;
    standardlightStrength: number;
    standardshowLight: boolean;
    standardlightPosX: number;
    standardlightPosY: number;
    standardlightPosZ: number;
}

export const DEFAULT_SETTINGS: ThreeDEmbedSettings = {
    showConfig: true,
    standardColor: "#ADD8E6",
    standardScale: 0.5,
    standardEmbedHeight: 300,
    autoRotate: false,
    camPosX: 0,
    camPosY: 5,
    camPosZ: 10,
    orthographicCam: false,
    cameraType: "Perspective",
    autoShowGUI: false,
    stlWireframe: false,
    stlColor: "#606060",
    attachLightToCam: false,
    standardLightColor_AttachedCam: "#FFFFFF",
    standardlightStrength_AttachedCam: 1,
    standardLightColor: "#FFFFFF",
    standardlightStrength: 1,
    standardshowLight: false,
    standardlightPosX: 5,
    standardlightPosY: 10,
    standardlightPosZ: 5
};

export class ThreeDSettingsTab extends PluginSettingTab {
    plugin: ThreeJSPlugin;

    constructor(app: App, plugin: ThreeJSPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h6', {
            text: 'Important Note: All the settings below are default settings, all parameters you set here can be modified in the codeblock of your embed per 3D file. These settings are here as the base value where every scene gets initialized with',
        });

        containerEl.createEl('h2', {
            text: 'Config Options',
        });

        new Setting(containerEl)
            .setName('Load codeblock with all configurations')
            .setDesc('If true, this setting will load the codeblocks in your markdownnotes with all the settings you can configure. If false it will load only the minimally required settings')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.showConfig) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.showConfig = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )

        containerEl.createEl('h2', {
            text: 'Standard Scene Settings',
        });

        new Setting(containerEl)
            .setName('Standard scene color')
            .setDesc('Default background color for 3D scenes')
            .addColorPicker(colorPicker =>
                colorPicker.setValue(this.plugin.settings.standardColor)
                    .onChange(async (value) => {
                        this.plugin.settings.standardColor = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Standard scale of 3Dmodel')
            .setDesc('Default size of 3D models in scene (non whole numbers should be seperated by dot, not comma)')
            .addText(text =>
                text
                    .setValue(this.plugin.settings.standardScale.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.standardScale = numValue;
                        await this.plugin.saveSettings();
                    })

            )

        new Setting(containerEl)
            .setName('Standard height')
            .setDesc('Default height of a 3D model embed in your note (in pixels)')
            .addText(text =>
                text
                    .setValue(this.plugin.settings.standardEmbedHeight.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.standardEmbedHeight = numValue;
                        await this.plugin.saveSettings();
                    })

            )

        new Setting(containerEl)
            .setName('Auto Rotate Models')
            .setDesc('If true, will always automatically rotate the models in your scene')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.autoRotate) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.autoRotate = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )

        new Setting(containerEl)
            .setName('Toggle Automatically show GUI')
            .setDesc('If true, will show basic gui options for a scene (color selector, grid checkbox) upon model load. Can also be set in the codeblock config')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.autoShowGUI) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.autoShowGUI = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )

        containerEl.createEl('h2', {
            text: 'Standard Camera Settings',
        });

        new Setting(containerEl)
            .setClass("ThreeDEmbed_Position_Inputs")
            .setName('Standard Position Camera')
            .setDesc('The default position of the camera in your scene (X,Y,Z)')
            .addText(text =>
                text
                    .setValue(this.plugin.settings.camPosX.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.camPosX = numValue;
                        await this.plugin.saveSettings();
                    })

            )
            .addText(text =>
                text
                    .setValue(this.plugin.settings.camPosY.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.camPosY = numValue;
                        await this.plugin.saveSettings();
                    })

            )
            .addText(text =>
                text
                    .setValue(this.plugin.settings.camPosZ.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.camPosZ = numValue;
                        await this.plugin.saveSettings();
                    })

            )

        new Setting(containerEl)
            .setName('Toggle Orthographic Camera')
            .setDesc('If true, will load all your scenes with a orthographic camera, if false, defaults to a perspective camera. You can also set this per scene, in the codeblock config')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.orthographicCam) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.orthographicCam = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )

        new Setting(containerEl)
            .setName('Camera Type')
            .setDesc('Defaults a camera type. You can also set this per scene, in the codeblock config.')
            .addDropdown(
                (dropdown) =>
                    dropdown
                        .addOptions({
                            Perspective: "Perspective",
                            Orthographic: "Orthographic"
                        })
                        .setValue(this.plugin.settings.cameraType.toString())
                        .onChange(async (value) => {
                            this.plugin.settings.cameraType = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        }));

        containerEl.createEl('h2', {
            text: 'Lighting Settings',
        });

        new Setting(containerEl)
            .setName('Attach a light to the camera')
            .setDesc('If enabled, however you look at a model a light will point at it. It will take the strength and color attributes of the scene light')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.attachLightToCam) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.attachLightToCam = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )

        new Setting(containerEl)
            .setName('Standard light Color Attached to camera')
            .setDesc('Default color for the lightsource that is attached to the camera')
            .addColorPicker(colorPicker =>
                colorPicker.setValue(this.plugin.settings.standardLightColor_AttachedCam)
                    .onChange(async (value) => {
                        this.plugin.settings.standardLightColor_AttachedCam = value;
                        await this.plugin.saveSettings();
                    })

            );

        new Setting(containerEl)
            .setName('Standard Light Strength')
            .setDesc('The default strength of your light attached to the camera')
            .addText(text =>
                text
                    .setValue(this.plugin.settings.standardlightStrength_AttachedCam.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.standardlightStrength_AttachedCam = numValue;
                        await this.plugin.saveSettings();
                    })

            )

        new Setting(containerEl)
            .setName('Standard light Color')
            .setDesc('Default color for the lighting of the scene')
            .addColorPicker(colorPicker =>
                colorPicker.setValue(this.plugin.settings.standardLightColor)
                    .onChange(async (value) => {
                        this.plugin.settings.standardLightColor = value;
                        await this.plugin.saveSettings();
                    })

            );

        new Setting(containerEl)
            .setName('Standard Light Strength')
            .setDesc('The default strength of your light in the scene')
            .addText(text =>
                text
                    .setValue(this.plugin.settings.standardlightStrength.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.standardlightStrength = numValue;
                        await this.plugin.saveSettings();
                    })

            )

        new Setting(containerEl)
            .setName('Show the light in Scene')
            .setDesc('If enabled, shows a sphere in the scene at the location of the light by default')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.standardshowLight) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.standardshowLight = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )

        new Setting(containerEl)
            .setClass("ThreeDEmbed_Position_Inputs")
            .setName('Standard Position Light')
            .setDesc('The default position of the lightsource in your scene (X,Y,Z)')
            .addText(text =>
                text
                    .setValue(this.plugin.settings.standardlightPosX.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.standardlightPosX = numValue;
                        await this.plugin.saveSettings();
                    })

            )
            .addText(text =>
                text
                    .setValue(this.plugin.settings.standardlightPosY.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.standardlightPosY = numValue;
                        await this.plugin.saveSettings();
                    })

            )
            .addText(text =>
                text
                    .setValue(this.plugin.settings.standardlightPosZ.toString())
                    .onChange(async (value) => {
                        const numValue = parseFloat(value)
                        this.plugin.settings.standardlightPosZ = numValue;
                        await this.plugin.saveSettings();
                    })

            )

        containerEl.createEl('h2', {
            text: 'STL Type Options',
        });

        new Setting(containerEl)
            .setName('Standard model color')
            .setDesc('Default the model color for stl models')
            .addColorPicker(colorPicker =>
                colorPicker.setValue(this.plugin.settings.stlColor)
                    .onChange(async (value) => {
                        this.plugin.settings.stlColor = value;
                        await this.plugin.saveSettings();
                    })

            );


        new Setting(containerEl)
            .setName('Standard show wireframe mode')
            .setDesc('If true, will show all .STL models with a wireframe mode.')
            .addToggle(
                (toggle) =>
                    toggle
                        .setValue(this.plugin.settings.stlWireframe) // Set the initial value based on settings
                        .onChange(async (value) => {
                            this.plugin.settings.stlWireframe = value; // Update setting when toggled
                            await this.plugin.saveData(this.plugin.settings); // Save the new setting value
                        })
            )
    }
}