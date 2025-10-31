import React, { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeScript, generateSceneImage, generateSpeech, checkImageQuality } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/fileUtils';
import type { Scene, VoiceOption, ProcessingStep, StepName, StepStatus } from '../types';
import Loader from './Loader';
import StatusBar from './StatusBar';


const voiceOptions: VoiceOption[] = [
  { name: 'Male Voice 1 (Kore)', value: 'Kore' },
  { name: 'Male Voice 2 (Charon)', value: 'Charon' },
  { name: 'Male Voice 3 (Fenrir)', value: 'Fenrir' },
];

const initialProcessingSteps: ProcessingStep[] = [
    { name: 'analyze', label: 'Analyzing Script', status: 'pending' },
    { name: 'audio', label: 'Generating Voice-over', status: 'pending' },
    { name: 'images', label: 'Generating & Verifying Images', status: 'pending' },
    { name: 'ready', label: 'Ready for Preview', status: 'pending' },
];

const VideoCreator: React.FC = () => {
    const [script, setScript] = useState<string>('');
    const [selectedVoice, setSelectedVoice] = useState<string>(voiceOptions[0].value);
    const [animationType, setAnimationType] = useState<'fade' | 'kenburns'>('fade');
    const [error, setError] = useState<string | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [characterDescription, setCharacterDescription] = useState<string | null>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [processingState, setProcessingState] = useState<ProcessingStep[]>(initialProcessingSteps);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    
    const audioContextRef = useRef<AudioContext | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const animationFrameRef = useRef<number>(0);

    const isRecordingSupported = typeof window !== 'undefined' && 'MediaRecorder' in window && 'captureStream' in HTMLCanvasElement.prototype;

    const isProcessing = processingState.some(s => s.status === 'in-progress');
    const isVideoReady = processingState.find(s => s.name === 'ready')?.status === 'success';

    // Cleanup audio context on unmount
    useEffect(() => {
        return () => {
            audioContextRef.current?.close();
        }
    }, []);

    const cleanup = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = 0;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };
    
    const updateStep = (name: StepName, status: StepStatus, error?: string) => {
        setProcessingState(prev => prev.map(step => 
            step.name === name ? { ...step, status, error } : step
        ));
    };

    /**
     * Generates an image for a scene, checks its quality, and retries once if it fails.
     */
    const generateAndVerifyImage = async (scene: Scene): Promise<{ imageUrl: string; imageQuality: { pass: boolean; feedback: string } }> => {
        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const imageUrl = await generateSceneImage(scene.image_prompt);
            const [header, base64Data] = imageUrl.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
            const qualityResult = await checkImageQuality(base64Data, mimeType, scene.image_prompt);

            if (qualityResult.pass || attempt === maxAttempts) {
                return { imageUrl, imageQuality: qualityResult };
            }
            // If it fails and it's not the last attempt, it will loop and try again.
        }
        // This part should not be reachable due to the logic above, but is a fallback.
        throw new Error(`Failed to generate a quality image for scene ${scene.scene} after ${maxAttempts} attempts.`);
    };


    const handleCreateVideo = async () => {
        if (!script) {
            setError('Please enter a script.');
            return;
        }

        setError(null);
        setScenes([]);
        setCharacterDescription(null);
        setAudioBuffer(null);
        setAudioPreviewUrl(null);
        setVideoBlobUrl(null);
        setProcessingState(initialProcessingSteps);
        cleanup();

        try {
            // Step 1: Analyze script
            updateStep('analyze', 'in-progress');
            const { character_description, scenes: analyzedScenes } = await analyzeScript(script);
            if (!analyzedScenes || analyzedScenes.length === 0) {
              throw new Error("Script analysis did not return any scenes.");
            }
            updateStep('analyze', 'success');
            setCharacterDescription(character_description);
            setScenes(analyzedScenes);

            // Step 2 & 3 in parallel: Generate Audio and sequential Images
            updateStep('audio', 'in-progress');
            updateStep('images', 'in-progress');
            
            const fullScriptText = analyzedScenes.map(s => s.text).join(' ');

            const audioPromise = generateSpeech(fullScriptText, selectedVoice);
            
            const imagesPromise = (async () => {
                const verifiedImagesData = [];
                for (const scene of analyzedScenes) {
                    const result = await generateAndVerifyImage(scene);
                    const sceneWithImage = {
                        ...scene,
                        imageUrl: result.imageUrl,
                        imageQuality: result.imageQuality,
                    };
                    verifiedImagesData.push(result);
                     // Update state to show progress as each image is generated
                    setScenes(prevScenes => prevScenes.map(s => s.scene === scene.scene ? sceneWithImage : s));
                    // Add a delay between API calls to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                return verifiedImagesData;
            })();


            const [audioResult, imagesResult] = await Promise.allSettled([
                audioPromise,
                imagesPromise
            ]);

            // Handle Audio Result
            let audioSuccess = false;
            if (audioResult.status === 'fulfilled') {
                if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                }
                const decodedAudio = await decodeAudioData(decode(audioResult.value), audioContextRef.current);
                setAudioBuffer(decodedAudio);
                const audioBlob = new Blob([decode(audioResult.value).buffer], { type: 'audio/wav' });
                setAudioPreviewUrl(URL.createObjectURL(audioBlob));
                updateStep('audio', 'success');
                audioSuccess = true;
            } else {
                updateStep('audio', 'error', 'Failed to generate audio.');
                console.error("Audio generation failed:", audioResult.reason);
            }

            // Handle Images Result
            let imagesSuccess = false;
            if (imagesResult.status === 'fulfilled') {
                const verifiedImagesData = imagesResult.value;
                 const scenesWithImages = analyzedScenes.map((scene, index) => ({
                    ...scene,
                    imageUrl: verifiedImagesData[index].imageUrl,
                    imageQuality: verifiedImagesData[index].imageQuality,
                }));
                setScenes(scenesWithImages);
                updateStep('images', 'success');
                imagesSuccess = true;
            } else {
                updateStep('images', 'error', 'Failed to generate one or more images.');
                console.error("Image generation failed:", imagesResult.reason);
            }
            
            // Step 4: Final readiness check
            if(audioSuccess && imagesSuccess) {
                updateStep('ready', 'success');
            } else {
                updateStep('ready', 'error', 'One or more generation steps failed.');
            }

        } catch (err) {
            const errorMessage = (err as Error).message;
            const currentFailedStep = processingState.find(s => s.status === 'in-progress')?.name || 'analyze';
            updateStep(currentFailedStep, 'error', errorMessage);
            setError(`An error occurred: ${errorMessage}`);
            console.error(err);
        }
    };

    const startRecordingAndPlayback = useCallback(() => {
        if (!canvasRef.current || !audioBuffer || scenes.length === 0 || scenes.some(s => !s.imageUrl) || !isRecordingSupported) return;

        setVideoBlobUrl(null);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const audioCtx = audioContextRef.current;
        if (!audioCtx || audioCtx.state === 'closed') {
          console.error("Audio context not available.");
          return;
        };

        // --- AUDIO/VIDEO STREAM COMBINING ---
        // 1. Get video stream from canvas
        const videoStream = canvas.captureStream(30);
        const [videoTrack] = videoStream.getVideoTracks();

        // 2. Create an audio destination node to capture the audio
        const audioDestination = audioCtx.createMediaStreamDestination();
        
        // 3. Create audio source and connect it to BOTH the destination (for recording) and the speakers (for preview)
        const audioSource = audioCtx.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioDestination);
        audioSource.connect(audioCtx.destination);

        // 4. Get the audio track from the destination
        const [audioTrack] = audioDestination.stream.getAudioTracks();
        
        // 5. Combine video and audio tracks into one stream
        const combinedStream = new MediaStream([videoTrack, audioTrack]);

        // --- MEDIA RECORDER SETUP ---
        const recordedChunks: Blob[] = [];
        // Use the combined stream for the recorder
        mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' });
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            setVideoBlobUrl(URL.createObjectURL(blob));
            // Clean up tracks
            videoTrack.stop();
            audioTrack.stop();
        };
        mediaRecorderRef.current.start();

        // --- START PLAYBACK & ANIMATION ---
        audioSource.start();
        const startTime = audioCtx.currentTime;
        const totalDuration = audioBuffer.duration;
        const sceneDuration = totalDuration / scenes.length;

        const images = scenes.map(scene => {
            const img = new Image();
            img.src = scene.imageUrl!;
            return img;
        });

        const draw = () => {
            if (!audioCtx || audioCtx.state === 'closed') {
                cleanup();
                return;
            }
            const elapsedTime = audioCtx.currentTime - startTime;
            if (elapsedTime >= totalDuration) {
                cleanup();
                return;
            }

            const currentSceneIndex = Math.min(Math.floor(elapsedTime / sceneDuration), scenes.length - 1);
            const nextSceneIndex = (currentSceneIndex + 1);
            const timeIntoScene = elapsedTime % sceneDuration;
            const progress = timeIntoScene / sceneDuration;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const currentImage = images[currentSceneIndex];
            
            if (currentImage.complete) {
              if (animationType === 'fade') {
                  const nextImage = images[nextSceneIndex];
                  ctx.globalAlpha = 1;
                  drawImageToFit(ctx, currentImage);

                  if (currentSceneIndex < scenes.length - 1 && nextImage && nextImage.complete && progress > 0.5) {
                      ctx.globalAlpha = (progress - 0.5) * 2;
                      drawImageToFit(ctx, nextImage);
                  }
                  ctx.globalAlpha = 1;
              } else { // Ken Burns effect
                  const scale = 1 + progress * 0.1;
                  const x = (canvas.width - canvas.width * scale) * progress;
                  const y = (canvas.height - canvas.height * scale) * progress;
                  ctx.drawImage(currentImage, x, y, canvas.width * scale, canvas.height * scale);
              }
            }
            
            // Draw watermark
            ctx.font = '24px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('Created using Google AI Studio', canvas.width - 15, canvas.height - 15);


            animationFrameRef.current = requestAnimationFrame(draw);
        };
        
        draw();
        
        audioSource.onended = () => {
            cleanup();
        };

    }, [audioBuffer, scenes, animationType, isRecordingSupported]);

    const drawImageToFit = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
        const canvas = ctx.canvas;
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.min(hRatio, vRatio);
        const centerShift_x = (canvas.width - img.width * ratio) / 2;
        const centerShift_y = (canvas.height - img.height * ratio) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height,
            centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-indigo-400">Hindi Script to Anime Creator</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Control Panel */}
                <div className="space-y-4">
                    <textarea
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        placeholder="अपनी हिंदी पटकथा यहाँ पेस्ट करें..."
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
                        rows={8}
                        disabled={isProcessing}
                    />
                    <div>
                        <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-2">Select Voice</label>
                        <select
                            id="voice-select"
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                            disabled={isProcessing}
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            {voiceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="animation-select" className="block text-sm font-medium text-gray-300 mb-2">Animation Style</label>
                        <select
                            id="animation-select"
                            value={animationType}
                            onChange={(e) => setAnimationType(e.target.value as 'fade' | 'kenburns')}
                            disabled={isProcessing}
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="fade">Fade Transition</option>
                            <option value="kenburns">Animated (Ken Burns)</option>
                        </select>
                    </div>
                    <button
                        onClick={handleCreateVideo}
                        disabled={isProcessing}
                        className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed transition-colors"
                    >
                        {isProcessing ? 'Creating...' : 'Generate Video Assets'}
                    </button>
                    {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

                    {processingState[0].status !== 'pending' && <StatusBar steps={processingState} />}

                    {characterDescription && (
                        <div className="bg-gray-700/50 rounded-lg p-3">
                            <h4 className="text-sm font-medium text-indigo-300 mb-2">AI Character Concept</h4>
                            <p className="text-sm text-gray-300 italic">{characterDescription}</p>
                        </div>
                    )}

                    {audioPreviewUrl && !isProcessing && (
                         <div className="bg-gray-700/50 rounded-lg p-3">
                            <h4 className="text-sm font-medium text-gray-200 mb-2">Audio Preview</h4>
                             <audio controls src={audioPreviewUrl} className="w-full"></audio>
                         </div>
                    )}
                </div>

                {/* Preview & Output Panel */}
                <div className="space-y-4">
                     <h3 className="text-lg font-semibold text-gray-200">Preview &amp; Download</h3>
                     <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <canvas ref={canvasRef} width="1280" height="720" className="w-full h-full"></canvas>
                     </div>
                     {!isRecordingSupported && (
                         <p className="text-sm text-yellow-400 text-center">Your browser does not support video recording. You can preview, but not download.</p>
                     )}
                     <button
                        onClick={startRecordingAndPlayback}
                        disabled={!isVideoReady || isProcessing || !isRecordingSupported}
                        className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed transition-colors"
                     >
                        Play Preview &amp; Record
                     </button>
                     {videoBlobUrl && (
                        <div className="text-center p-4 bg-gray-700/50 rounded-lg">
                           <h4 className="font-semibold text-green-400 mb-2">Video Ready!</h4>
                           <a 
                             href={videoBlobUrl} 
                             download={`creative-suite-video-${Date.now()}.webm`}
                             className="inline-block bg-indigo-600 text-white font-bold py-2 px-6 rounded-md hover:bg-indigo-700 transition-colors"
                           >
                            Download Video (.webm)
                           </a>
                        </div>
                     )}
                </div>
            </div>
            {/* Scenes Display */}
            {scenes.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold mb-4 text-gray-200">Generated Scenes</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {scenes.map(scene => (
                            <div key={scene.scene} className="bg-gray-700 rounded-lg p-2 text-xs group relative">
                                {scene.imageUrl ? (
                                    <img src={scene.imageUrl} alt={`Scene ${scene.scene}`} className="w-full aspect-square object-cover rounded"/>
                                ) : (
                                   <div className="w-full aspect-square bg-gray-600 rounded flex items-center justify-center">
                                       <Loader text="" />
                                   </div>
                                )}
                                <p className="mt-2 text-gray-300 truncate" title={scene.image_prompt}>
                                    <span className="font-bold">Scene {scene.scene}:</span> {scene.image_prompt}
                                </p>
                                {scene.imageQuality && (
                                    <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${scene.imageQuality.pass ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                                        {scene.imageQuality.pass ? '✓' : '✗'}
                                    </div>
                                )}
                                 {scene.imageQuality && (
                                     <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-b-lg">
                                       {scene.imageQuality.feedback}
                                     </div>
                                 )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoCreator;