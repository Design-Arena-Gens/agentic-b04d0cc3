"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "classnames";
import {
  AvatarParameters,
  AvatarStatus,
  AvatarState,
  UploadedImage,
  useAvatarStore,
} from "@/state/avatarStore";
import { Group } from "three";
import { exportAvatarAsFBX, exportAvatarAsGLTF } from "@/utils/exporters";

const AvatarScene = dynamic(() => import("./AvatarScene").then((mod) => mod.AvatarScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-3xl border border-slate-800/60 bg-slate-900/40">
      <span className="animate-pulse text-sm text-slate-400">
        Initializing renderer…
      </span>
    </div>
  ),
});

type ExportFormat = "gltf" | "fbx";

const hairStyleLabels = {
  buzz: "Buzz Cut",
  short: "Short Fade",
  medium: "Layered Medium",
  long: "Long Flow",
  braids: "Braided",
} as const;

const outfitLabels = {
  casual: "Casual Layers",
  athletic: "Athletic Techwear",
  formal: "Formal Tailored",
  street: "Streetwear",
} as const;

const sliderClass =
  "w-full accent-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400";

const cardClass =
  "rounded-3xl border border-slate-800/70 bg-slate-900/60 shadow-[0_24px_60px_-40px_rgba(15,15,40,0.6)] backdrop-blur";

const labelClass = "text-sm font-medium text-slate-200";

const helpTextClass = "text-xs text-slate-400";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed";

const buttonPrimary = `${buttonBase} bg-violet-500 text-white shadow-[0_10px_30px_-12px_rgba(124,58,237,0.7)] hover:bg-violet-400 disabled:bg-slate-700 disabled:text-slate-400`;

const buttonSecondary = `${buttonBase} border border-slate-700/60 bg-slate-900/40 text-slate-200 hover:border-violet-400/50`;

const numberFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const relativeTimeFromISO = (iso?: string) => {
  if (!iso) return null;
  try {
    const now = Date.now();
    const then = Date.parse(iso);
    const diffSeconds = Math.round((then - now) / 1000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
      [60, "seconds"],
      [60, "minutes"],
      [24, "hours"],
      [7, "days"],
      [4.34524, "weeks"],
      [12, "months"],
      [Number.MAX_SAFE_INTEGER, "years"],
    ];
    let duration = diffSeconds;
    for (const [amount, unit] of divisions) {
      if (Math.abs(duration) < amount) {
        return rtf.format(Math.round(duration), unit);
      }
      duration /= amount;
    }
    return rtf.format(Math.round(duration), "years");
  } catch (error) {
    console.error("Failed to format relative time", error);
    return null;
  }
};

const ControlSlider = ({
  id,
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  description,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  onChange: (value: number) => void;
}) => (
  <label htmlFor={id} className="flex flex-col gap-2">
    <span className={labelClass}>
      {label}
      <span className="ml-2 text-xs text-slate-400">
        {Math.round(value * 100)}%
      </span>
    </span>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={sliderClass}
    />
    {description ? <span className={helpTextClass}>{description}</span> : null}
  </label>
);

const ControlColor = ({
  id,
  label,
  value,
  onChange,
  description,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}) => (
  <label htmlFor={id} className="flex items-center justify-between gap-4">
    <div className="flex flex-col">
      <span className={labelClass}>{label}</span>
      {description ? (
        <span className={helpTextClass}>{description}</span>
      ) : null}
    </div>
    <input
      id={id}
      type="color"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-16 cursor-pointer rounded-lg border border-slate-700/60 bg-slate-900/60"
      aria-label={label}
    />
  </label>
);

const ControlSelect = <T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  description,
}: {
  id: string;
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  description?: string;
}) => (
  <label htmlFor={id} className="flex flex-col gap-2">
    <span className={labelClass}>{label}</span>
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="rounded-lg border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 shadow-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-slate-900">
          {option.label}
        </option>
      ))}
    </select>
    {description ? <span className={helpTextClass}>{description}</span> : null}
  </label>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <fieldset className={clsx(cardClass, "p-6 space-y-5")} role="group">
    <legend className="mb-4 px-2 text-sm uppercase tracking-[0.2em] text-slate-500">
      {title}
    </legend>
    {children}
  </fieldset>
);

const generationBadgePalette: Record<AvatarStatus, string> = {
  idle: "bg-slate-900/50 text-slate-300 border border-slate-800/70",
  processing: "bg-amber-500/30 text-amber-100 border border-amber-400/40",
  ready: "bg-emerald-500/20 text-emerald-100 border border-emerald-500/50",
};

const useLiveGenerationProgress = () => {
  const status = useAvatarStore((state) => state.status);
  const progress = useAvatarStore((state) => state.generationProgress);
  const [displayProgress, setDisplayProgress] = useState(progress);

  useEffect(() => {
    if (status === "processing") {
      const interval = setInterval(() => {
        setDisplayProgress((value) => Math.min(value + 1, 99));
      }, 120);
      return () => clearInterval(interval);
    }
    const frame = requestAnimationFrame(() => setDisplayProgress(progress));
    return () => cancelAnimationFrame(frame);
  }, [status, progress]);

  useEffect(() => {
    if (status === "ready") {
      const frame = requestAnimationFrame(() => setDisplayProgress(100));
      return () => cancelAnimationFrame(frame);
    }
  }, [status]);

  return { status, progress: status === "processing" ? displayProgress : progress };
};

const UploadPanel = ({
  uploads,
  onUpload,
  onRemove,
}: {
  uploads: UploadedImage[];
  onUpload: (files: FileList | null) => void;
  onRemove: (id: string) => void;
}) => (
  <section className={clsx(cardClass, "p-6")} aria-labelledby="upload-title">
    <div className="flex items-center justify-between">
      <div>
        <h2 id="upload-title" className="text-sm font-semibold text-slate-200">
          Reference Photography
        </h2>
        <p className="text-xs text-slate-400">
          Upload 1-5 photos for photogrammetry alignment.
        </p>
      </div>
      <label
        className="cursor-pointer rounded-full border border-dashed border-slate-700/70 px-3 py-1 text-xs text-slate-200 hover:border-violet-400/70 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-400"
        aria-label="Upload reference photography"
      >
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => onUpload(event.target.files)}
        />
        Add images
      </label>
    </div>
    <ul className="mt-4 flex flex-col gap-3">
      {uploads.length === 0 ? (
        <li className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-4 text-xs text-slate-500">
          No images yet. Drop images anywhere on the canvas or use the button above.
        </li>
      ) : (
        uploads.map((image) => (
          <li
            key={image.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-900/50 p-3"
          >
            <div className="flex items-center gap-3">
              <Image
                src={image.src}
                alt={`${image.name} preview`}
                width={48}
                height={48}
                className="h-12 w-12 rounded-lg object-cover"
                unoptimized
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-200">
                  {image.name}
                </span>
                <span className="text-xs text-slate-400">
                  {formatFileSize(image.size)}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="rounded-full border border-transparent bg-slate-800/80 px-3 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
              onClick={() => onRemove(image.id)}
            >
              Remove
            </button>
          </li>
        ))
      )}
    </ul>
  </section>
);

const ActionBar = ({
  onGenerate,
  onSave,
  onExport,
  onShare,
  status,
  hasAvatar,
  lastSavedIso,
}: {
  onGenerate: () => void;
  onSave: () => void;
  onExport: (format: ExportFormat) => void;
  onShare: () => Promise<"shared" | "copied">;
  status: AvatarStatus;
  hasAvatar: boolean;
  lastSavedIso?: string;
}) => {
  const [feedback, setFeedback] = useState<"copied" | "shared" | null>(null);

  return (
    <section className={clsx(cardClass, "p-6 space-y-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition",
            generationBadgePalette[status],
          )}
          role="status"
          aria-live="polite"
        >
          <span
            className={clsx(
              "h-2.5 w-2.5 rounded-full",
              status === "processing"
                ? "bg-amber-300 animate-pulse"
                : status === "ready"
                  ? "bg-emerald-300"
                  : "bg-slate-500",
            )}
            aria-hidden
          />
          {status === "processing"
            ? "Generating avatar"
            : status === "ready"
              ? "Avatar ready"
              : "Idle"}
        </span>
        {lastSavedIso ? (
          <span className="text-xs text-slate-400">
            Saved {relativeTimeFromISO(lastSavedIso) ?? "recently"}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonPrimary}
          onClick={onGenerate}
          aria-label="Generate photorealistic avatar"
        >
          Generate Avatar
        </button>
        <button
          type="button"
          className={buttonSecondary}
          onClick={onSave}
          disabled={!hasAvatar}
        >
          Save Preset
        </button>
        <button
          type="button"
          className={buttonSecondary}
          onClick={() => onExport("gltf")}
          disabled={!hasAvatar}
        >
          Export glTF
        </button>
        <button
          type="button"
          className={buttonSecondary}
          onClick={() => onExport("fbx")}
          disabled={!hasAvatar}
        >
          Export FBX
        </button>
        <button
          type="button"
          className={buttonSecondary}
          onClick={async () => {
            const result = await onShare();
            setFeedback(result);
            setTimeout(() => setFeedback(null), 2200);
          }}
        >
          {feedback === "copied"
            ? "Link copied"
            : feedback === "shared"
              ? "Shared!"
              : "Share"}
        </button>
      </div>
    </section>
  );
};

const parameterSections: {
  section: keyof AvatarParameters;
  title: string;
  controls: (
    params: AvatarParameters,
    setParameter: AvatarState["setParameter"],
  ) => React.ReactNode;
}[] = [
  {
    section: "facial",
    title: "Facial Profiling",
    controls: (params, setParameter) => (
      <>
        <ControlSlider
          id="eye-spacing"
          label="Orbital Spacing"
          value={params.facial.eyeSpacing}
          onChange={(value) => setParameter("facial", "eyeSpacing", value)}
          description="Adjust interpupillary distance to match subject proportion."
        />
        <ControlSlider
          id="eye-size"
          label="Eye Scale"
          value={params.facial.eyeSize}
          onChange={(value) => setParameter("facial", "eyeSize", value)}
        />
        <ControlSlider
          id="nose-width"
          label="Nasal Width"
          value={params.facial.noseWidth}
          onChange={(value) => setParameter("facial", "noseWidth", value)}
        />
        <ControlSlider
          id="nose-length"
          label="Nasal Bridge Length"
          value={params.facial.noseLength}
          onChange={(value) => setParameter("facial", "noseLength", value)}
        />
        <ControlSlider
          id="lip-fullness"
          label="Lip Fullness"
          value={params.facial.lipFullness}
          onChange={(value) => setParameter("facial", "lipFullness", value)}
        />
        <ControlSlider
          id="ear-size"
          label="Auricle Scale"
          value={params.facial.earSize}
          onChange={(value) => setParameter("facial", "earSize", value)}
        />
      </>
    ),
  },
  {
    section: "head",
    title: "Cranial Structure",
    controls: (params, setParameter) => (
      <>
        <ControlSlider
          id="head-height"
          label="Crown Height"
          value={params.head.headHeight}
          onChange={(value) => setParameter("head", "headHeight", value)}
        />
        <ControlSlider
          id="head-width"
          label="Cephalic Width"
          value={params.head.headWidth}
          onChange={(value) => setParameter("head", "headWidth", value)}
        />
        <ControlSlider
          id="chin-definition"
          label="Chin Definition"
          value={params.head.chinDefinition}
          onChange={(value) => setParameter("head", "chinDefinition", value)}
        />
        <ControlSlider
          id="jaw-width"
          label="Mandible Width"
          value={params.head.jawWidth}
          onChange={(value) => setParameter("head", "jawWidth", value)}
        />
        <ControlSlider
          id="neck-thickness"
          label="Cervical Thickness"
          value={params.head.neckThickness}
          onChange={(value) => setParameter("head", "neckThickness", value)}
        />
      </>
    ),
  },
  {
    section: "skin",
    title: "Dermal Response",
    controls: (params, setParameter) => (
      <>
        <ControlColor
          id="skin-tone"
          label="Melanin Tone"
          value={params.skin.tone}
          onChange={(value) => setParameter("skin", "tone", value)}
        />
        <ControlSlider
          id="skin-roughness"
          label="Micro Roughness"
          value={params.skin.roughness}
          onChange={(value) => setParameter("skin", "roughness", value)}
        />
        <ControlSlider
          id="skin-sheen"
          label="Epidermal Sheen"
          value={params.skin.sheen}
          onChange={(value) => setParameter("skin", "sheen", value)}
        />
        <ControlSlider
          id="skin-subsurface"
          label="Subsurface Scattering"
          value={params.skin.subsurface}
          onChange={(value) => setParameter("skin", "subsurface", value)}
        />
        <ControlSlider
          id="skin-freckles"
          label="Freckle Density"
          value={params.skin.freckles}
          onChange={(value) => setParameter("skin", "freckles", value)}
        />
      </>
    ),
  },
  {
    section: "hair",
    title: "Hair Simulation",
    controls: (params, setParameter) => (
      <>
        <ControlSelect
          id="hair-style"
          label="Style"
          value={params.hair.style}
          options={(Object.keys(hairStyleLabels) as Array<keyof typeof hairStyleLabels>).map(
            (key) => ({
              value: key,
              label: hairStyleLabels[key],
            }),
          )}
          onChange={(value) => setParameter("hair", "style", value)}
        />
        <ControlColor
          id="hair-color"
          label="Primary Pigment"
          value={params.hair.color}
          onChange={(value) => setParameter("hair", "color", value)}
        />
        <ControlColor
          id="hair-secondary"
          label="Secondary Pigment"
          value={params.hair.secondaryColor}
          onChange={(value) => setParameter("hair", "secondaryColor", value)}
        />
        <ControlSlider
          id="hair-length"
          label="Length"
          value={params.hair.length}
          onChange={(value) => setParameter("hair", "length", value)}
        />
        <ControlSlider
          id="hair-curl"
          label="Curl Dynamics"
          value={params.hair.curl}
          onChange={(value) => setParameter("hair", "curl", value)}
        />
        <ControlSlider
          id="hair-volume"
          label="Volume"
          value={params.hair.volume}
          onChange={(value) => setParameter("hair", "volume", value)}
        />
      </>
    ),
  },
  {
    section: "body",
    title: "Body Morphology",
    controls: (params, setParameter) => (
      <>
        <ControlSlider
          id="body-height"
          label="Stature"
          value={params.body.height}
          onChange={(value) => setParameter("body", "height", value)}
        />
        <ControlSlider
          id="body-weight"
          label="Mass Distribution"
          value={params.body.weight}
          onChange={(value) => setParameter("body", "weight", value)}
        />
        <ControlSlider
          id="body-muscle"
          label="Muscle Density"
          value={params.body.muscle}
          onChange={(value) => setParameter("body", "muscle", value)}
        />
        <ControlSlider
          id="body-posture"
          label="Posture Alignment"
          value={params.body.posture}
          onChange={(value) => setParameter("body", "posture", value)}
        />
        <ControlSlider
          id="shoulder-width"
          label="Shoulder Spread"
          value={params.body.shoulderWidth}
          onChange={(value) => setParameter("body", "shoulderWidth", value)}
        />
      </>
    ),
  },
  {
    section: "clothing",
    title: "Wardrobe & Materials",
    controls: (params, setParameter) => (
      <>
        <ControlSelect
          id="clothing-outfit"
          label="Outfit System"
          value={params.clothing.outfit}
          options={(Object.keys(outfitLabels) as Array<keyof typeof outfitLabels>).map(
            (key) => ({
              value: key,
              label: outfitLabels[key],
            }),
          )}
          onChange={(value) => setParameter("clothing", "outfit", value)}
        />
        <ControlColor
          id="clothing-primary"
          label="Primary Fabric"
          value={params.clothing.primaryColor}
          onChange={(value) => setParameter("clothing", "primaryColor", value)}
        />
        <ControlColor
          id="clothing-secondary"
          label="Secondary Fabric"
          value={params.clothing.secondaryColor}
          onChange={(value) => setParameter("clothing", "secondaryColor", value)}
        />
        <ControlSlider
          id="clothing-sheen"
          label="Sheen"
          value={params.clothing.fabricSheen}
          onChange={(value) => setParameter("clothing", "fabricSheen", value)}
        />
        <ControlSlider
          id="clothing-layering"
          label="Layering Density"
          value={params.clothing.layering}
          onChange={(value) => setParameter("clothing", "layering", value)}
        />
      </>
    ),
  },
];

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const AvatarStudio = () => {
  const avatarGroupRef = useRef<Group | null>(null);
  const restoredRef = useRef(false);
  const status = useAvatarStore((state) => state.status);
  const parameters = useAvatarStore((state) => state.parameters);
  const uploadedImages = useAvatarStore((state) => state.uploadedImages);
  const lastSavedIso = useAvatarStore((state) => state.lastSavedISO);
  const setParameters = useAvatarStore((state) => state.setParameters);
  const setParameter = useAvatarStore((state) => state.setParameter);
  const addUpload = useAvatarStore((state) => state.addUpload);
  const removeUpload = useAvatarStore((state) => state.removeUpload);
  const generateAvatar = useAvatarStore((state) => state.generateAvatar);
  const markSaved = useAvatarStore((state) => state.markSaved);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("avatar-studio-profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          parameters: AvatarParameters;
          uploadedImages: UploadedImage[];
          savedAt?: string;
        };
        if (parsed.parameters) {
          setParameters(parsed.parameters);
        }
        if (parsed.uploadedImages) {
          parsed.uploadedImages.forEach((image) => addUpload(image));
        }
        if (parsed.savedAt) {
          markSaved(parsed.savedAt);
        }
      } catch (error) {
        console.warn("Failed to restore saved avatar", error);
      }
    }
  }, [addUpload, markSaved, setParameters]);

  const handleUpload = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const currentCount = uploadedImages.length;
      const queue = Array.from(files).slice(0, Math.max(0, 5 - currentCount));
      queue.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const uid =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const image: UploadedImage = {
            id: `${file.name}-${uid}`,
            name: file.name,
            src: reader.result as string,
            size: file.size,
          };
          addUpload(image);
        };
        reader.readAsDataURL(file);
      });
    },
    [addUpload, uploadedImages.length],
  );

  useEffect(() => {
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer?.files) {
        handleUpload(event.dataTransfer.files);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragover", handleDragOver);
    return () => {
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, [handleUpload]);

  const handleGenerate = useCallback(() => {
    generateAvatar();
  }, [generateAvatar]);

  const handleSave = useCallback(() => {
    if (typeof window === "undefined") return;
    const payload = {
      parameters,
      uploadedImages,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem("avatar-studio-profile", JSON.stringify(payload));
    markSaved(payload.savedAt);
  }, [markSaved, parameters, uploadedImages]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      const group = avatarGroupRef.current;
      if (!group) return;

      if (format === "gltf") {
        const blob = await exportAvatarAsGLTF(group);
        downloadBlob(blob, `avatar-${Date.now()}.gltf`);
      } else {
        const blob = exportAvatarAsFBX(group);
        downloadBlob(blob, `avatar-${Date.now()}.fbx`);
      }
    },
    [],
  );

  const handleShare = useCallback(async (): Promise<"shared" | "copied"> => {
    if (typeof window === "undefined") return "copied";
    const shareData = {
      title: "My Photorealistic Avatar",
      text: "Check out this avatar generated with PBR and dynamic physics.",
      url: window.location.href,
    };

    if (navigator.share) {
      await navigator.share(shareData);
      return "shared";
    } else {
      await navigator.clipboard.writeText(shareData.url);
      return "copied";
    }
  }, []);

  const { status: statusForBadge, progress: animatedProgress } = useLiveGenerationProgress();

  const hasAvatar = status === "ready" || uploadedImages.length > 0;

  const metrics = useMemo(
    () => [
      {
        label: "Physics Strands",
        value: numberFormatter.format(
          Math.round(1200 + parameters.hair.volume * 800 + parameters.hair.length * 600),
        ),
      },
      {
        label: "Material Variants",
        value: numberFormatter.format(
          Math.round(
            12 +
              parameters.clothing.layering * 6 +
              parameters.skin.freckles * 4 +
              parameters.hair.curl * 5,
          ),
        ),
      },
      {
        label: "Rig Controllers",
        value: numberFormatter.format(
          Math.round(48 + parameters.body.muscle * 12 + parameters.facial.eyeSize * 10),
        ),
      },
    ],
    [parameters],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <a
        href="#avatar-studio"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:rounded-xl focus:bg-slate-900/90 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-violet-300"
      >
        Skip to Avatar Studio
      </a>
      <header className="border-b border-slate-900/80 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-violet-400/80">
              Avatar Forge
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
              Photorealistic Avatar Authoring Suite
            </h1>
            <p className="max-w-xl text-sm text-slate-400 md:text-base">
              Upload facial references, dial in anatomical accuracy, and export animation-ready
              avatars in physically based formats tailored for real-time engines or offline
              rendering pipelines.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-6 py-4">
            <div>
              <span className="text-xs uppercase tracking-[0.4em] text-slate-500">
                Progress
              </span>
              <p className="text-2xl font-semibold text-violet-400">
                {animatedProgress}%
              </p>
            </div>
            <div className="h-12 w-px bg-slate-800" aria-hidden />
            <div>
              <span className="text-xs uppercase tracking-[0.4em] text-slate-500">
                Status
              </span>
              <p className="text-sm text-slate-300">{statusForBadge.toUpperCase()}</p>
            </div>
          </div>
        </div>
      </header>

      <main
        id="avatar-studio"
        className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row"
      >
        <section className="flex-1 space-y-6">
          <div
            className={clsx(
              cardClass,
              "relative aspect-[4/5] overflow-hidden border-slate-800/70",
            )}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between p-6">
              <span
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                  generationBadgePalette[statusForBadge],
                )}
              >
                <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
                {statusForBadge === "processing"
                  ? "Synthesizing Physically Based Mesh"
                  : statusForBadge === "ready"
                    ? "Rigged Avatar Ready"
                    : "Awaiting Input"}
              </span>
              <span className="rounded-full border border-slate-800/50 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
                {uploadedImages.length
                  ? `${uploadedImages.length} reference ${uploadedImages.length === 1 ? "image" : "images"}`
                  : "No references"}
              </span>
            </div>
            <AvatarScene avatarGroupRef={avatarGroupRef} />
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-6">
              <dl className="grid grid-cols-3 gap-4 text-xs text-slate-300">
                {metrics.map((metric) => (
                  <div key={metric.label} className="flex flex-col gap-1">
                    <dt className="uppercase tracking-[0.3em] text-slate-500">
                      {metric.label}
                    </dt>
                    <dd className="text-base font-semibold text-slate-100">
                      {metric.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <UploadPanel uploads={uploadedImages} onUpload={handleUpload} onRemove={removeUpload} />
        </section>

        <aside className="flex w-full max-w-xl flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-[0.4em] text-slate-500">
              Avatar Controls
            </h2>
            <button
              type="button"
              className="rounded-full border border-slate-700/60 px-3 py-1 text-xs text-slate-300 hover:border-violet-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
              onClick={() => useAvatarStore.getState().resetParameters()}
            >
              Reset to Default
            </button>
          </div>

          <div className="scrollbar-thin flex max-h-[70vh] flex-col gap-6 overflow-y-auto rounded-3xl border border-slate-800/60 bg-slate-900/50 p-4 pr-3">
            {parameterSections.map((section) => (
              <Section key={section.section} title={section.title}>
                {section.controls(parameters, setParameter)}
              </Section>
            ))}
          </div>

          <ActionBar
            onGenerate={handleGenerate}
            onSave={handleSave}
            onExport={handleExport}
            onShare={handleShare}
            status={statusForBadge}
            hasAvatar={hasAvatar}
            lastSavedIso={lastSavedIso}
          />
        </aside>
      </main>
    </div>
  );
};

export default AvatarStudio;
