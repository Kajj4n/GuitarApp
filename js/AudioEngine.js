// AudioEngine.js
export class AudioEngine {
    constructor() {
        // Web Audio API components
        this.audioCtx = null;    // The main audio engine/context
        this.analyser = null;    // Node that extracts time/frequency data from the audio
        this.dataArray = null;   // Array to hold the raw waveform data
        this.isRunning = false;  // Flag to check if the mic is actively listening
        
        // MP3 Playback state
        this.currentAudio = null; 
        this.fadeInterval = null;
        this.fadeTimeout = null;
        
        // Optimization constants (Guitar range filter)
        this.minFreq = 60;  // Ignore sub-bass rumble (Low E is ~82Hz)
        this.maxFreq = 1000; // Ignore high-pitched squeaks/harmonics (High E is ~329Hz)
    }

    // Step 1: Request Microphone Access and Setup Audio
    async init() {
        // Don't initialize twice
        if (this.isRunning) return; 
        
        try {
            // Create the browser's audio context
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Ask user for mic permission
            // Turn off optimization for background noise
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: false, 
                    noiseSuppression: false, 
                    autoGainControl: false 
                } 
            });
            
            // Connect the microphone stream to analyser node
            const source = this.audioCtx.createMediaStreamSource(stream);
            this.analyser = this.audioCtx.createAnalyser();
            
            // fftSize determines the resolution of the audio slice. 2048 is a standard balance of speed/accuracy.
            this.analyser.fftSize = 2048;
            source.connect(this.analyser);
            
            // Create an empty array to hold the audio data slices
            this.dataArray = new Float32Array(this.analyser.fftSize);
            this.isRunning = true;
            
        } catch (err) {
            console.error("Microphone access denied.", err);
        }
    }

    // Step 2: Grab the current audio frame and calculate its pitch
    getPitch() {
        if (!this.isRunning) return -1;
        
        // Populate this.dataArray with the current physical waveform of the sound
        this.analyser.getFloatTimeDomainData(this.dataArray);
        
        // Pass the waveform to math algorithm to find the frequency
        const pitch = this.autoCorrelate(this.dataArray, this.audioCtx.sampleRate);
        
        // Filter out jumps in frequency
        if (pitch < this.minFreq || pitch > this.maxFreq) return -1;
        return pitch;
    }

    // Step 3: Find which note the pitch belongs to
    getClosestNote(freq, activeTuning) {
        // Loops through the tuning array and finds the note with the smallest frequency difference
        return activeTuning.reduce((prev, curr) => {
            return (Math.abs(curr.freq - freq) < Math.abs(prev.freq - freq) ? curr : prev);
        });
    }

    // Step 4: Calculate exactly how out of tune
    getCents(detected, target) {
        // 1200 cents = 1 Octave. 100 cents = 1 semitone (half-step).
        return Math.floor(1200 * Math.log2(detected / target));
    }

    //Autocorrelation Algorithm
    autoCorrelate(buffer, sampleRate) {
        // 1. Calculate the Volum
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        
        // If the volume is too low (< 0.02), assume it's background silence and return -1
        if (Math.sqrt(sum / buffer.length) < 0.02) return -1;

        // 2. Trim the noisy/silent edges of the buffer array
        let r1 = 0, r2 = buffer.length - 1, thres = 0.2;
        for (let i = 0; i < buffer.length / 2; i++) {
            if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < buffer.length / 2; i++) {
            if (Math.abs(buffer[buffer.length - i]) < thres) { r2 = buffer.length - i; break; }
        }
        buffer = buffer.slice(r1, r2);
        
        // Slide audio wave over a copy of itself. When the peaks line up perfectly,
        // Massive spike in the calculation. That distance is the length of the sound wave.
        const c = new Array(buffer.length).fill(0);
        for (let i = 0; i < buffer.length; i++) {
            for (let j = 0; j < buffer.length - i; j++) {
                c[i] = c[i] + buffer[j] * buffer[j + i];
            }
        }

        //Find the highest peak in the correlated data
        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < buffer.length; i++) {
            // maxpos is the repeating distance
            if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
        }
        
        // 5. Convert that repeating distance into Hertz (Cycles per Second)
        return sampleRate / maxpos;
    }

    // --- Audio Playback Logic ---
    playStringAudio(note) {
        // Stop any currently ringing strings
        this.stopAllAudio();
        
        // Build the file path and play the audio
        this.currentAudio = new Audio(`./audio/${note}.mp3`);
        this.currentAudio.volume = 1.0;
        this.currentAudio.play().catch(() => console.warn("Audio file missing for", note));

        // Wait 2000ms (2 seconds) letting the string ring out fully
        this.fadeTimeout = setTimeout(() => {
            // Every 50ms, drop the volume by 5% until it's silent
            this.fadeInterval = setInterval(() => {
                if (this.currentAudio && this.currentAudio.volume > 0.05) {
                    this.currentAudio.volume -= 0.05;
                } else {
                    this.stopAllAudio();
                }
            }, 50);
        }, 2000);
    }

    // Cleans up the audio engine so sounds don't overlap infinitely
    stopAllAudio() {
        clearTimeout(this.fadeTimeout);
        clearInterval(this.fadeInterval);
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }
}