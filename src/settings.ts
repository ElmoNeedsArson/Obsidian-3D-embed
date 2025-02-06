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

    lightSettings: {
        dropdownValue: string;
        position: [number, number, number];
        intensity: number;
        color: string;
    }[];
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
    standardlightPosZ: 5,

    lightSettings: [
        {
            dropdownValue: "directional", // Default light type
            position: [5, 10, 5], // Default position
            intensity: 1, // Default light strength
            color: "#FFFFFF", // Default light color
        }
    ]
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
            .setName('Standard height')
            .setDesc('Default height of a 3D embed in your note (in pixels)')
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
            .setName('Auto Rotate Scene')
            .setDesc('If true, will automatically rotate your scene to get a showcase effect')
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
            text: 'Standard Model Settings',
        });

        new Setting(containerEl)
            .setName('Standard scale of 3Dmodels')
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

        containerEl.createEl("h2", { text: "Lighting Settings" });

        new Setting(containerEl)
            .setName("Add Lights")
            .setDesc("It is strongly recommended to keep the 2 preloaded lights")
            .addButton((button) => {
                button.setButtonText("+").onClick(() => {
                    this.plugin.settings.lightSettings.push({
                        dropdownValue: "ambient",
                        position: [5, 10, 5],
                        intensity: 1,
                        color: "#ffffff",
                    });
                    this.plugin.saveData(this.plugin.settings);
                    this.display(); // Refresh UI
                });
            });

        // Iterate over each light setting and create UI elements
        this.plugin.settings.lightSettings.forEach((light, index) => {
            const lightDiv = containerEl.createDiv({ cls: "light-setting" });

            // Create collapsible section
            const details = lightDiv.createEl("details");
            const summary = details.createEl("summary", { text: `Lightsource number ${index + 1}: ` + light.dropdownValue });

            // Light Type Dropdown
            new Setting(details)
                .setName("Light Type")
                .addDropdown((dropdown) => {
                    dropdown.addOptions({
                        point: "point",
                        directional: "directional",
                        ambient: "ambient",
                        attachToCam: "attach to camera"
                    });
                    dropdown.setValue(light.dropdownValue);
                    dropdown.onChange(async (value) => {
                        light.dropdownValue = value;
                        summary.innerText = `Lightsource number ${index + 1}: ` + value
                        await this.plugin.saveData(this.plugin.settings);
                    });
                });

            // Position Inputs with Title
            new Setting(details)
                .setClass("ThreeDEmbed_Position_Inputs")
                .setName("Light Position")
                .setDesc("The position of the light in the scene (X, Y, Z)")
                .addText(text =>
                    text
                        .setValue(light.position[0].toString())
                        .onChange(async (value) => {
                            const numValue = parseFloat(value);
                            light.position[0] = numValue;
                            await this.plugin.saveData(this.plugin.settings);
                        })
                )
                .addText(text =>
                    text
                        .setValue(light.position[1].toString())
                        .onChange(async (value) => {
                            const numValue = parseFloat(value);
                            light.position[1] = numValue;
                            await this.plugin.saveData(this.plugin.settings);
                        })
                )
                .addText(text =>
                    text
                        .setValue(light.position[2].toString())
                        .onChange(async (value) => {
                            const numValue = parseFloat(value);
                            light.position[2] = numValue;
                            await this.plugin.saveData(this.plugin.settings);
                        })
                );

            // Light Intensity
            new Setting(details)
                .setName("Light Intensity")
                .addText((text) => {
                    text.inputEl.type = "number";
                    text.setValue(light.intensity.toString());
                    text.onChange(async (value) => {
                        light.intensity = parseFloat(value);
                        await this.plugin.saveData(this.plugin.settings);
                    });
                });

            // Color Picker
            new Setting(details)
                .setName("Light Color")
                .addColorPicker((picker) => {
                    picker.setValue(light.color);
                    picker.onChange(async (value) => {
                        light.color = value;
                        await this.plugin.saveData(this.plugin.settings);
                    });
                });

            // Remove Light Button
            new Setting(details)
                .addButton((button) => {
                    button.setButtonText("Remove").setClass("ThreeDEmbed_Remove_Button").onClick(async () => {
                        this.plugin.settings.lightSettings.splice(index, 1);
                        await this.plugin.saveData(this.plugin.settings);
                        this.display(); // Refresh UI
                    });

                    button.buttonEl.style.backgroundColor = "red";
                    button.buttonEl.style.color = "white"
                });

            lightDiv.appendChild(details);
        });

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