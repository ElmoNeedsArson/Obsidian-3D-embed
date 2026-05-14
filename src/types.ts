export type XYZ = [number, number, number];

export interface ModelConfig {
    name: string;
    scale?: number;
    rotation?: XYZ;
    position?: XYZ;
}

export interface StlConfig {
    stlColorHexString?: string;
    stlWireframe?: boolean;
}

export interface LightRenderConfig {
    castShadows?: boolean;
    color2?: string;
    target?: XYZ;
    distance?: number;
    angle?: number;
    decay?: number;
    skyColor?: string;
    groundColor?: string;
}

export interface LightConfig extends LightRenderConfig {
    type: string;
    show?: boolean;
    color?: string;
    pos?: XYZ;
    strength?: number;
}

export interface CameraConfig {
    camPosXYZ?: XYZ;
    LookatXYZ?: XYZ;
    orthographic?: boolean;
}

export interface HdriBackgroundConfig {
    texturePath: string;
    sceneBackground?: boolean;
    baseGeometry?: boolean;
}

export interface SceneSettings {
    backgroundColor?: string;
    showAxisHelper?: boolean;
    showGridHelper?: boolean;
    length?: number;
    gridSize?: number;
    autoRotation?: XYZ;
    showGuiOverlay?: boolean;
    orbitControlDamping?: boolean;
    showGroundShadows?: boolean;
    hdriBackground?: HdriBackgroundConfig;
}

export interface RenderBlockConfig {
    alignment?: string;
    widthPercentage?: number;
    height?: number;
}

export interface GridSettings {
    columns?: number;
    rowHeight?: number;
    gapX?: number;
    gapY?: number;
}

export interface SceneData {
    camera?: CameraConfig;
    scene?: SceneSettings;
    models?: ModelConfig[];
    lights?: LightConfig[];
    stl?: StlConfig;
    renderBlock?: RenderBlockConfig;
    gridSettings?: GridSettings;
}

export interface GridConfig {
    gridSettings?: GridSettings;
    [key: string]: SceneData | GridSettings | undefined;
}

// Recursive JSON-serialisable value. used by the custom formatter in gui.ts
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
