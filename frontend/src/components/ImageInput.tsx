"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Upload, Camera, X, SwitchCamera, Info } from "lucide-react";

interface ImageInputProps {
  onImageLoaded: (imageDataUrl: string) => void;
}

export default function ImageInput({ onImageLoaded }: ImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onImageLoaded(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    },
    [onImageLoaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const [cameraError, setCameraError] = useState<string | null>(null);

  const openCamera = useCallback(
    async (facing: "environment" | "user" = facingMode) => {
      setCameraError(null);

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          "Camera is not supported in this browser. Please use a modern browser (Chrome, Safari, Firefox) or upload an image instead.",
        );
        return;
      }

      try {
        // Stop existing stream
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: facing,
          },
        });
        setStream(mediaStream);
        setCameraActive(true);
        setFacingMode(facing);
        // Attach stream after state update triggers render
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.play();
          }
        }, 50);
      } catch (err) {
        console.error("Camera access error:", err);
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError") {
          setCameraError(
            "Camera permission was denied. To enable it:\n\n" +
              "• Click the lock/site-info icon in the address bar\n" +
              "• Find \"Camera\" and change it to \"Allow\"\n" +
              "• Then reload the page and try again",
          );
        } else if (name === "NotFoundError") {
          setCameraError(
            "No camera was found on this device. Please upload an image instead.",
          );
        } else if (name === "NotReadableError") {
          setCameraError(
            "Camera is in use by another application. Please close other apps using the camera and try again.",
          );
        } else {
          setCameraError(
            "Could not access the camera. Please check your browser permissions or upload an image instead.",
          );
        }
      }
    },
    [stream, facingMode],
  );

  const closeCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    setStream(null);
    setCameraActive(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    closeCamera();
    onImageLoaded(dataUrl);
  }, [closeCamera, onImageLoaded]);

  const switchCamera = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    openCamera(next);
  }, [facingMode, openCamera]);

  // Camera view
  if (cameraActive) {
    return (
      <div className="relative w-full bg-black rounded-xl overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] object-cover" />

        {/* Guide frame overlay */}
        <div className="absolute inset-6 pointer-events-none">
          <div
            className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-blue-400 rounded-tl-lg"
            style={{ borderWidth: "3px 0 0 3px" }}
          />
          <div
            className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-blue-400 rounded-tr-lg"
            style={{ borderWidth: "3px 3px 0 0" }}
          />
          <div
            className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-blue-400 rounded-bl-lg"
            style={{ borderWidth: "0 0 3px 3px" }}
          />
          <div
            className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-blue-400 rounded-br-lg"
            style={{ borderWidth: "0 3px 3px 0" }}
          />
        </div>

        {/* Status text */}
        <div className="absolute top-4 left-0 right-0 text-center space-y-2">
          <span className="bg-black/60 text-white text-sm px-3 py-1.5 rounded-full">
            Position the label in the frame
          </span>
          <div>
            <a
              href="/picture_guide.png"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-300 hover:text-white transition bg-black/40 px-2 py-1 rounded-full"
            >
              <Info size={11} />
              Picture-taking guidelines
            </a>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
          <button
            onClick={closeCamera}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition"
          >
            <X size={20} />
          </button>
          <button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition shadow-lg"
            aria-label="Take photo"
          >
            <div className="w-12 h-12 rounded-full border-4 border-gray-800" />
          </button>
          <button
            onClick={switchCamera}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition"
          >
            <SwitchCamera size={20} />
          </button>
        </div>
      </div>
    );
  }

  // Upload / camera selection view
  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-12
          flex flex-col items-center justify-center gap-4 transition-all
          ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"}
        `}
      >
        <Upload size={40} className={dragOver ? "text-blue-500" : "text-gray-400"} />
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">{dragOver ? "Drop image here" : "Upload Label Image"}</p>
          <p className="text-sm text-gray-500 mt-1">Drag & drop or click to browse — PNG, JPG, WEBP up to 10MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-400 font-medium">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Camera button */}
      <button
        onClick={() => openCamera()}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-700 hover:text-blue-600"
      >
        <Camera size={24} />
        <span className="font-medium">Use Camera</span>
      </button>

      {/* Picture-taking guidelines */}
      <div className="text-center">
        <a
          href="/picture_guide.png"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline transition"
        >
          <Info size={14} />
          Please follow our picture-taking guidelines for the best result
        </a>
      </div>

      {/* Camera error message */}
      {cameraError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Camera size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 mb-1">Camera Access Issue</p>
              <p className="text-xs text-amber-700 whitespace-pre-line">{cameraError}</p>
            </div>
            <button
              onClick={() => setCameraError(null)}
              className="text-amber-400 hover:text-amber-600 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
