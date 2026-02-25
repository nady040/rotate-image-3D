import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, RotateCw, ArrowRight, RefreshCw, Download, Maximize2, Info, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateNewPerspective, CameraParams, buildCameraPrompt } from './services/gemini';
import { CameraControl3D } from './components/CameraControl3D';

const MAX_SEED = 2147483647;

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [params, setParams] = useState<CameraParams>({
    azimuth: 0,
    elevation: 0,
    distance: 1.0,
    prompt: '',
  });
  
  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seed, setSeed] = useState(0);
  const [randomizeSeed, setRandomizeSeed] = useState(true);
  const [guidanceScale, setGuidanceScale] = useState(1.0);
  const [numInferenceSteps, setNumInferenceSteps] = useState(4);
  const [height, setHeight] = useState(1024);
  const [width, setWidth] = useState(1024);

  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setOriginalImage(result);
        setGeneratedImage(null);
        setError(null);
        
        // Auto-calculate dimensions
        const img = new Image();
        img.onload = () => {
          let newWidth = 1024;
          let newHeight = 1024;
          if (img.width > img.height) {
            newWidth = 1024;
            newHeight = Math.floor(1024 * (img.height / img.width));
          } else {
            newHeight = 1024;
            newWidth = Math.floor(1024 * (img.width / img.height));
          }
          setWidth((Math.floor(newWidth / 8)) * 8);
          setHeight((Math.floor(newHeight / 8)) * 8);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!originalImage) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateNewPerspective(originalImage, params);
      if (result) {
        setGeneratedImage(result);
      } else {
        setError("Failed to generate image. Please try again.");
      }
    } catch (err) {
      setError("An error occurred while generating the image.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setOriginalImage(null);
    setGeneratedImage(null);
    setParams({ azimuth: 0, elevation: 0, distance: 1.0, prompt: '' });
    setError(null);
  };

  const currentPrompt = buildCameraPrompt(params.azimuth, params.elevation, params.distance);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30 font-sans">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Qwen Image Edit 3D</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={reset}
              className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">🎬 Qwen Image Edit 2511 — 3D Camera Control</h2>
          <p className="text-white/50 text-sm">
            Control camera angles using the 3D viewport or sliders. 
            Using precise camera control logic for high-fidelity spatial re-rendering.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Input & Controls */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-widest">Input Image</h3>
              <div 
                className={`relative aspect-[4/3] max-h-[300px] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden ${
                  originalImage 
                    ? 'border-transparent bg-black' 
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 cursor-pointer'
                }`}
                onClick={() => !originalImage && fileInputRef.current?.click()}
              >
                {originalImage ? (
                  <img 
                    src={originalImage} 
                    alt="Original" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-8">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-6 h-6 text-white/40" />
                    </div>
                    <p className="text-sm text-white/60 mb-1">Drop image here</p>
                    <p className="text-xs text-white/30">or click to browse</p>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-widest">🎮 3D Camera Control</h3>
              <p className="text-[10px] text-white/30 italic">*Drag the colored handles: 🟢 Azimuth, 🩷 Elevation, 🟠 Distance*</p>
              <CameraControl3D 
                value={params} 
                onChange={(newVal) => setParams({ ...params, ...newVal })} 
                imageUrl={originalImage}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!originalImage || isGenerating}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                !originalImage || isGenerating 
                  ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-5 h-5" />
                  <span>🚀 Generate</span>
                </>
              )}
            </button>

            <div className="glass rounded-2xl p-6 space-y-8">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-widest">🎚️ Slider Controls</h3>
              
              {/* Azimuth Slider */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <label className="text-white/70">Azimuth (Horizontal Rotation)</label>
                  <span className="font-mono text-blue-400">{params.azimuth.toFixed(0)}°</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="315" 
                  step="45"
                  value={params.azimuth}
                  onChange={(e) => setParams({ ...params, azimuth: parseInt(e.target.value) })}
                  className="custom-slider"
                />
                <div className="flex justify-between text-[10px] text-white/30 font-mono">
                  <span>0° (Front)</span>
                  <span>180° (Back)</span>
                  <span>315°</span>
                </div>
              </div>

              {/* Elevation Slider */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <label className="text-white/70">Elevation (Vertical Angle)</label>
                  <span className="font-mono text-blue-400">{params.elevation.toFixed(0)}°</span>
                </div>
                <input 
                  type="range" 
                  min="-30" 
                  max="60" 
                  step="30"
                  value={params.elevation}
                  onChange={(e) => setParams({ ...params, elevation: parseInt(e.target.value) })}
                  className="custom-slider"
                />
                <div className="flex justify-between text-[10px] text-white/30 font-mono">
                  <span>-30° (Low)</span>
                  <span>0° (Eye)</span>
                  <span>60° (High)</span>
                </div>
              </div>

              {/* Distance Slider */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <label className="text-white/70">Distance</label>
                  <span className="font-mono text-blue-400">{params.distance.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" 
                  min="0.6" 
                  max="1.4" 
                  step="0.4"
                  value={params.distance}
                  onChange={(e) => setParams({ ...params, distance: parseFloat(e.target.value) })}
                  className="custom-slider"
                />
                <div className="flex justify-between text-[10px] text-white/30 font-mono">
                  <span>0.6 (Close)</span>
                  <span>1.0 (Med)</span>
                  <span>1.4 (Wide)</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/40 uppercase tracking-widest">Generated Prompt</label>
                <div className="w-full bg-black/50 border border-white/10 rounded-xl p-3 font-mono text-xs text-[#00ff88]">
                  {currentPrompt}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Output & Advanced */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-widest">Output Image</h3>
              <div className="relative aspect-square rounded-2xl border border-white/10 bg-black overflow-hidden flex items-center justify-center min-h-[500px]">
                <AnimatePresence mode="wait">
                  {generatedImage ? (
                    <motion.img 
                      key="generated"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      src={generatedImage} 
                      alt="Generated Perspective" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <motion.div 
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center p-8"
                    >
                      {isGenerating ? (
                        <div className="space-y-4">
                          <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                          <p className="text-sm text-white/40 animate-pulse">Computing 3D geometry...</p>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ArrowRight className="w-6 h-6 text-white/20" />
                          </div>
                          <p className="text-sm text-white/20">Result will appear here</p>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {generatedImage && (
                  <a 
                    href={generatedImage} 
                    download="perspective.png"
                    className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-lg text-white/80 hover:text-white transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>

            {/* Advanced Settings Accordion */}
            <div className="glass rounded-2xl overflow-hidden">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-white/40" />
                  <span className="text-sm font-medium">⚙️ Advanced Settings</span>
                </div>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5 p-6 space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-xs text-white/50">Seed</label>
                        <input 
                          type="number" 
                          value={seed}
                          onChange={(e) => setSeed(parseInt(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input 
                          type="checkbox" 
                          id="randomizeSeed"
                          checked={randomizeSeed}
                          onChange={(e) => setRandomizeSeed(e.target.checked)}
                          className="w-4 h-4 rounded border-white/10 bg-white/5"
                        />
                        <label htmlFor="randomizeSeed" className="text-xs text-white/50">Randomize Seed</label>
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs text-white/50">Guidance Scale ({guidanceScale.toFixed(1)})</label>
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          step="0.1"
                          value={guidanceScale}
                          onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                          className="custom-slider"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs text-white/50">Inference Steps ({numInferenceSteps})</label>
                        <input 
                          type="range" 
                          min="1" 
                          max="20" 
                          step="1"
                          value={numInferenceSteps}
                          onChange={(e) => setNumInferenceSteps(parseInt(e.target.value))}
                          className="custom-slider"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs text-white/50">Width ({width}px)</label>
                        <input 
                          type="range" 
                          min="256" 
                          max="2048" 
                          step="8"
                          value={width}
                          onChange={(e) => setWidth(parseInt(e.target.value))}
                          className="custom-slider"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs text-white/50">Height ({height}px)</label>
                        <input 
                          type="range" 
                          min="256" 
                          max="2048" 
                          step="8"
                          value={height}
                          onChange={(e) => setHeight(parseInt(e.target.value))}
                          className="custom-slider"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-3">
                <Info className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-white/5 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-white/30 text-xs text-center md:text-left">
          <p>© 2024 Qwen Image Edit 3D Clone. Replicating the Hugging Face Space experience.</p>
          <div className="flex gap-8">
            <a href="https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Original Space</a>
            <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Gemini API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

