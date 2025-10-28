"use client";

import { create } from "zustand";

export type AvatarStatus = "idle" | "processing" | "ready";

export interface UploadedImage {
  id: string;
  name: string;
  src: string;
  size: number;
}

export interface FacialConfig {
  eyeSpacing: number;
  eyeSize: number;
  noseWidth: number;
  noseLength: number;
  lipFullness: number;
  earSize: number;
}

export interface HeadConfig {
  headHeight: number;
  headWidth: number;
  chinDefinition: number;
  jawWidth: number;
  neckThickness: number;
}

export interface SkinConfig {
  tone: string;
  roughness: number;
  sheen: number;
  subsurface: number;
  freckles: number;
}

export interface HairConfig {
  style: "buzz" | "short" | "medium" | "long" | "braids";
  color: string;
  secondaryColor: string;
  length: number;
  curl: number;
  volume: number;
}

export interface BodyConfig {
  height: number;
  weight: number;
  muscle: number;
  posture: number;
  shoulderWidth: number;
}

export interface ClothingConfig {
  outfit: "casual" | "athletic" | "formal" | "street";
  primaryColor: string;
  secondaryColor: string;
  fabricSheen: number;
  layering: number;
}

export interface AvatarParameters {
  facial: FacialConfig;
  head: HeadConfig;
  skin: SkinConfig;
  hair: HairConfig;
  body: BodyConfig;
  clothing: ClothingConfig;
}

export interface AvatarState {
  parameters: AvatarParameters;
  status: AvatarStatus;
  generationProgress: number;
  uploadedImages: UploadedImage[];
  lastSavedISO?: string;
  setParameters: (params: AvatarParameters) => void;
  setParameter: <T extends keyof AvatarParameters, K extends keyof AvatarParameters[T]>(
    section: T,
    key: K,
    value: AvatarParameters[T][K],
  ) => void;
  setStatus: (status: AvatarStatus) => void;
  setGenerationProgress: (value: number) => void;
  addUpload: (image: UploadedImage) => void;
  removeUpload: (id: string) => void;
  resetUploads: () => void;
  generateAvatar: () => void;
  markSaved: (iso: string) => void;
  resetParameters: () => void;
}

const defaultParameters: AvatarParameters = {
  facial: {
    eyeSpacing: 0.5,
    eyeSize: 0.5,
    noseWidth: 0.5,
    noseLength: 0.5,
    lipFullness: 0.5,
    earSize: 0.5,
  },
  head: {
    headHeight: 0.5,
    headWidth: 0.5,
    chinDefinition: 0.5,
    jawWidth: 0.5,
    neckThickness: 0.5,
  },
  skin: {
    tone: "#c58c6d",
    roughness: 0.35,
    sheen: 0.4,
    subsurface: 0.6,
    freckles: 0.15,
  },
  hair: {
    style: "medium",
    color: "#1f1a17",
    secondaryColor: "#2f2723",
    length: 0.6,
    curl: 0.35,
    volume: 0.55,
  },
  body: {
    height: 0.6,
    weight: 0.5,
    muscle: 0.6,
    posture: 0.5,
    shoulderWidth: 0.55,
  },
  clothing: {
    outfit: "athletic",
    primaryColor: "#243447",
    secondaryColor: "#7e94ff",
    fabricSheen: 0.45,
    layering: 0.4,
  },
};

export const useAvatarStore = create<AvatarState>((set, get) => ({
  parameters: defaultParameters,
  status: "idle",
  generationProgress: 0,
  uploadedImages: [],
  lastSavedISO: undefined,
  setParameters: (params) =>
    set({
      parameters: params,
      status: "idle",
    }),
  setParameter: (section, key, value) =>
    set((state) => ({
      parameters: {
        ...state.parameters,
        [section]: {
          ...state.parameters[section],
          [key]: value,
        },
      },
      status: state.status === "ready" ? "idle" : state.status,
    })),
  setStatus: (status) => set({ status }),
  setGenerationProgress: (value) => set({ generationProgress: value }),
  addUpload: (image) =>
    set((state) => ({
      uploadedImages: [...state.uploadedImages, image],
    })),
  removeUpload: (id) =>
    set((state) => ({
      uploadedImages: state.uploadedImages.filter((img) => img.id !== id),
    })),
  resetUploads: () => set({ uploadedImages: [] }),
  generateAvatar: () => {
    const { status } = get();
    if (status === "processing") return;

    set({ status: "processing", generationProgress: 0 });

    const totalDuration = 3000;
    const steps = [0, 18, 37, 58, 76, 92, 100];
    steps.forEach((value, index) => {
      const delay = Math.min(totalDuration * (index / (steps.length - 1)), totalDuration);
      setTimeout(() => {
        set((state) => {
          const newStatus: AvatarStatus = value >= 100 ? "ready" : state.status;
          return {
            generationProgress: value,
            status: newStatus,
          };
        });
      }, delay);
    });
  },
  markSaved: (iso) => set({ lastSavedISO: iso }),
  resetParameters: () =>
    set({
      parameters: defaultParameters,
      status: "idle",
    }),
}));

export const selectParameters = () => useAvatarStore.getState().parameters;
