import React, { useState, useRef } from 'react';
import { 
  ImageIcon, 
  Sparkles, 
  Wand2, 
  Download, 
  RefreshCcw, 
  Upload, 
  Check, 
  AlertCircle,
  Maximize2,
  Trash2,
  Loader2
} from 'lucide-react';
import { editImageWithAI, generateImageWithAI } from '../services/gemini';
import { ImageSize } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

const ImageStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [selectedSize, setSelectedSize] = useState<ImageSize>(ImageSize.K1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [uploadImage, setUploadImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setUploadImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;

    setIsProcessing(true);
    try {
      const result = await generateImageWithAI(prompt, selectedSize);
      setResultImage(result);
    } catch (error: any) {
      console.error(error);
      alert('Generation failed. Please verify your prompt and ensure your AI settings are configured correctly.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = async () => {
    if (!uploadImage || !prompt) return;
    setIsProcessing(true);
    try {
      const base64 = uploadImage.split(',')[1];
      const result = await editImageWithAI(base64, prompt);
      setResultImage(result);
    } catch (error) {
      console.error(error);
      alert('Editing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div 
      className="max-w-6xl mx-auto p-4 space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            Media Studio
            <div className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] uppercase tracking-widest rounded border border-blue-500/20">Pro Mode</div>
          </h2>
          <p className="text-zinc-500">Generate and edit marketing collateral with DALL-E 3.</p>
        </div>
        
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 relative">
          <motion.div 
            className="absolute top-1 bottom-1 bg-zinc-800 rounded-lg shadow-lg"
            layoutId="activeTab"
            initial={false}
            animate={{ 
              x: activeTab === 'generate' ? 0 : '100%',
              width: '50%' 
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
          <button 
            onClick={() => { setActiveTab('generate'); setResultImage(null); }}
            className={`relative z-10 px-4 py-2 rounded-lg text-sm font-semibold transition-colors w-28 ${activeTab === 'generate' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Create New
          </button>
          <button 
            onClick={() => { setActiveTab('edit'); setResultImage(null); }}
            className={`relative z-10 px-4 py-2 rounded-lg text-sm font-semibold transition-colors w-28 ${activeTab === 'edit' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Edit Asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Control Panel */}
        <div className="lg:col-span-5 space-y-6">
          <motion.div 
            layout
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl"
          >
            <AnimatePresence mode="wait">
              {activeTab === 'edit' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Source Image</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-video bg-zinc-950 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group overflow-hidden relative"
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    {uploadImage ? (
                      <img src={uploadImage} alt="Upload" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload className="text-zinc-600 group-hover:text-blue-500 mb-2 transition-colors" size={32} />
                        <span className="text-xs text-zinc-500 font-medium">Click to upload asset</span>
                      </>
                    )}
                    {uploadImage && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setUploadImage(null); }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur rounded-lg text-white hover:bg-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                {activeTab === 'generate' ? 'Describe Vision' : 'Transformation Prompt'}
              </label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTab === 'generate' ? "e.g., A high-tech freight terminal at sunset with neon logistics holograms..." : "e.g., Add a retro cinematic filter and remove the truck in the distance..."}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-200 placeholder:text-zinc-700 h-32 outline-none focus:border-blue-500/50 transition-all resize-none shadow-inner"
              />
            </div>

            <AnimatePresence>
              {activeTab === 'generate' && (
                <motion.div 
                   initial={{ opacity: 0, height: 0 }} 
                   animate={{ opacity: 1, height: 'auto' }} 
                   exit={{ opacity: 0, height: 0 }}
                   className="space-y-4 overflow-hidden"
                >
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Resolution</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[ImageSize.K1, ImageSize.K2, ImageSize.K4].map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`
                          py-2 rounded-lg text-xs font-bold transition-all border
                          ${selectedSize === size 
                            ? 'bg-blue-500/10 border-blue-500 text-blue-500' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600'}
                        `}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={activeTab === 'generate' ? handleGenerate : handleEdit}
              disabled={isProcessing || !prompt || (activeTab === 'edit' && !uploadImage)}
              className={`
                w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg
                ${isProcessing || !prompt 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-95'}
              `}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Processing Core...
                </>
              ) : (
                <>
                  {activeTab === 'generate' ? <Sparkles size={18} /> : <Wand2 size={18} />}
                  {activeTab === 'generate' ? 'Generate Asset' : 'Refine Asset'}
                </>
              )}
            </button>
          </motion.div>

          <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-4">
            <div className="p-2 bg-blue-500/10 rounded-lg shrink-0 text-blue-500 h-fit">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-blue-400 mb-1">DALL-E 3 Generation</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Utilize high-fidelity generation for marketing displays. Ensure your API billing is active for 2K/4K outputs.
              </p>
            </div>
          </div>
        </div>

        {/* Right Output Area */}
        <div className="lg:col-span-7">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl h-full min-h-[500px] flex flex-col shadow-2xl overflow-hidden relative">
            <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Output Preview</span>
              {resultImage && (
                <div className="flex items-center gap-4">
                  <button className="text-zinc-500 hover:text-white transition-colors"><Maximize2 size={16} /></button>
                  <a 
                    href={resultImage} 
                    download="freightflow-asset.png"
                    className="flex items-center gap-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-all text-white"
                  >
                    <Download size={14} />
                    Export
                  </a>
                </div>
              )}
            </div>

            <div className="flex-1 bg-zinc-950 flex items-center justify-center p-8 relative">
              <AnimatePresence mode="wait">
                {isProcessing ? (
                  <motion.div 
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Loader2 className="animate-spin text-blue-500" size={32} />
                    </div>
                    <p className="text-sm font-bold text-blue-400 tracking-widest uppercase animate-pulse">Rendering Vector Space...</p>
                  </motion.div>
                ) : resultImage ? (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group max-w-full"
                  >
                    <img 
                      src={resultImage} 
                      alt="Generated output" 
                      className="max-h-[600px] rounded-xl shadow-2xl border border-zinc-800"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl backdrop-blur-sm">
                      <button 
                        onClick={() => setResultImage(null)}
                        className="px-6 py-3 bg-white text-black font-bold rounded-xl flex items-center gap-2 hover:scale-105 transition-all shadow-xl"
                      >
                        <RefreshCcw size={18} />
                        Start Over
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center space-y-4"
                  >
                    <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center mx-auto text-zinc-700">
                      <ImageIcon size={40} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-zinc-400">Awaiting Prompt Input</h3>
                      <p className="text-sm text-zinc-600 max-w-xs mx-auto">
                        Define your parameters on the left to initialize the visual synthesis engine.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ImageStudio;