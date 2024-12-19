import { App, PluginSettingTab, Setting } from 'obsidian';
import ThreeJSPlugin from './main';

export interface ThreeDEmbedSettings {
    standardColor: string;
    standardScale: number;
    standardEmbedHeight: number;
    autoRotate: boolean;
    orthographicCam: boolean;
    autoShowGUI: boolean;
}

export const DEFAULT_SETTINGS: ThreeDEmbedSettings = {
    standardColor: "#ADD8E6",
    standardScale: 0.5,
    standardEmbedHeight: 300,
    autoRotate: false,
    orthographicCam: false,
    autoShowGUI: false,
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
    }
}