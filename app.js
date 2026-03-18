class GuitarTuner {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
        this.isRunning = false;
        
        // 1. Set default string to Auto
        this.selectedMode = 'Auto'; 

        this.standardTuning = [
            { note: 'E2', freq: 82.41 },
            { note: 'A2', freq: 110.00 },
            { note: 'D3', freq: 146.83 },
            { note: 'G3', freq: 196.00 },
            { note: 'B3', freq: 246.94 },
            { note: 'E4', freq: 329.63 }
        ];

        // 2. Audio playback structure
        this.stringSounds = {
            'E2': new Audio('./sounds/E2.mp3'),
            'A2': new Audio('./sounds/A2.mp3'),
            'D3': new Audio('./sounds/D3.mp3'),
            'G3': new Audio('./sounds/G3.mp3'),
            'B3': new Audio('./sounds/B3.mp3'),
            'E4': new Audio('./sounds/E4.mp3')
        };

        this.ui = {
            note: document.getElementById('noteDisplay'),
            freq: document.getElementById('frequencyDisplay'),
            canvas: document.getElementById('meterCanvas'),
            flatIcon: document.getElementById('flatIcon'),
            sharpIcon: document.getElementById('sharpIcon'),
            stringBtns: document.querySelectorAll('.string-btn'),
            // Removed standardBtn listener since it's for future use
        };

        this.ctx = this.ui.canvas.getContext('2d');
        this.currentCents = 0;
        
        // Setup listeners for string selection
        this.ui.stringBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectString(e.target));
        });

        // Start tuner immediately in Auto mode on first user interaction 
        // (Browsers require interaction before audio context can start)
        document.body.addEventListener('click', () => {
            if (!this.isRunning) this.startTuner();
        }, { once: true });

        this.drawMeter(); // Draw initial static canvas
    }

    selectString(btnTarget) {
        // Toggle logic: If clicking the already active button, return to Auto
        if (btnTarget.classList.contains('active')) {
            btnTarget.classList.remove('active');
            this.selectedMode = 'Auto';
            this.stopAllAudio();
            this.currentCents = 0;
            return;
        }

        // Update styling for new selection
        this.ui.stringBtns.forEach(btn => btn.classList.remove('active'));
        btnTarget.classList.add('active');
        
        // Set internal state
        this.selectedMode = btnTarget.dataset.note;
        
        // Play the audio for the selected string
        this.playStringAudio(this.selectedMode);
        
        // Start tuner if it isn't already running
        if (!this.isRunning) {
            this.startTuner();
        } else {
            // Reset needle while waiting for new mic input
            this.currentCents = 0; 
            this.drawMeter();
        }
    }

    playStringAudio(note) {
        this.stopAllAudio();
        
        // Play the newly selected string sound
        if (this.stringSounds[note]) {
            this.stringSounds[note].play().catch(e => console.log("Audio file missing or blocked:", e)); 
        }
    }

    stopAllAudio() {
        Object.values(this.stringSounds).forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
    }

    async startTuner() {
        if (this.isRunning) return;

        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioCtx.createMediaStreamSource(stream);
            
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 2048;
            source.connect(this.analyser);

            this.dataArray = new Float32Array(this.analyser.fftSize);
            this.isRunning = true;
            this.update();
        } catch (err) {
            alert("Microphone access denied. Please allow microphone permissions to tune.");
        }
    }

    update() {
        if (!this.isRunning) return;

        this.analyser.getFloatTimeDomainData(this.dataArray);
        const pitch = this.autoCorrelate(this.dataArray, this.audioCtx.sampleRate);

        if (pitch !== -1) {
            const detectedNoteObj = this.getClosestNote(pitch);

            const targetNoteObj = this.selectedMode === 'Auto' 
                ? detectedNoteObj 
                : this.standardTuning.find(n => n.note === this.selectedMode);

            // Calculate cents (distance in musical pitch)
            const cents = this.getCents(pitch, targetNoteObj.freq);
            
            this.ui.note.textContent = detectedNoteObj.note.replace(/[0-9]/g, '');
            this.ui.freq.textContent = `${Math.round(pitch)} HZ`;
            
            // Limit the needle to a maximum of +/- 50 cents (half a semitone)
            // This prevents the needle from going out of bounds
            this.currentCents = Math.max(-50, Math.min(50, cents));
        }

        this.drawMeter();
        requestAnimationFrame(() => this.update());
    }

    autoCorrelate(buffer, sampleRate) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        if (Math.sqrt(sum / buffer.length) < 0.01) return -1;

        let r1 = 0, r2 = buffer.length - 1, thres = 0.2;
        for (let i = 0; i < buffer.length / 2; i++) {
            if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < buffer.length / 2; i++) {
            if (Math.abs(buffer[buffer.length - i]) < thres) { r2 = buffer.length - i; break; }
        }

        buffer = buffer.slice(r1, r2);
        const c = new Array(buffer.length).fill(0);
        for (let i = 0; i < buffer.length; i++) {
            for (let j = 0; j < buffer.length - i; j++) {
                c[i] = c[i] + buffer[j] * buffer[j + i];
            }
        }

        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < buffer.length; i++) {
            if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
        }

        return sampleRate / maxpos;
    }

    getClosestNote(freq) {
        return this.standardTuning.reduce((prev, curr) => {
            return (Math.abs(curr.freq - freq) < Math.abs(prev.freq - freq) ? curr : prev);
        });
    }

    getCents(detected, target) {
        return Math.floor(1200 * Math.log2(detected / target));
    }

    drawMeter() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.ui.canvas.getBoundingClientRect();
        
        if (this.ui.canvas.width !== rect.width * dpr) {
            this.ui.canvas.width = rect.width * dpr;
            this.ui.canvas.height = rect.height * dpr;
        }

        const width = rect.width;
        const height = rect.height;
        const ctx = this.ctx;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const baselineY = height - 45; 
        const centerX = width / 2;

        ctx.lineCap = "round"; 
        ctx.lineJoin = "round";

        // NEW SCALE: Edge of the meter is exactly 50 cents
        const edgeScale = 50; 
        const maxDrawWidth = width / 2 - 40; 

        // Target center line
        ctx.strokeStyle = "#573737"; 
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, baselineY - 80); 
        ctx.lineTo(centerX, baselineY + 15);
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.textAlign = "center";

        // Ticks representing 10, 20, 30, 40, 50 cents
        const ticks = [10, 20, 30, 40, 50];
        let offsetMax = 0; 

        ticks.forEach(tick => {
            const offset = (tick / edgeScale) * maxDrawWidth;
            if (tick === 50) offsetMax = offset;
            
            ctx.strokeStyle = "#573737";
            ctx.beginPath();
            ctx.moveTo(centerX + offset, baselineY - 5);
            ctx.lineTo(centerX + offset, baselineY + 10);
            ctx.moveTo(centerX - offset, baselineY - 5);
            ctx.lineTo(centerX - offset, baselineY + 10);
            ctx.stroke();

            // Only draw numbers for 20 and 40 to avoid crowding
            if (tick === 20 || tick === 40) {
                ctx.fillStyle = "#000000";
                ctx.font = "bold 12px sans-serif";
                ctx.fillText(tick, centerX + offset, baselineY + 30);
                ctx.fillText(tick, centerX - offset, baselineY + 30);
            }
        });

        // +/- signs at the very edge
        ctx.fillStyle = "#000000";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("-", centerX - offsetMax - 15, baselineY - 20);
        ctx.fillText("+", centerX + offsetMax + 15, baselineY - 20);

        if (this.isRunning) {
            const needleX = centerX + (this.currentCents / edgeScale) * maxDrawWidth;
            
            ctx.strokeStyle = Math.abs(this.currentCents) < 5 ? "#47cf73" : "#573737"; 
            
            // THINNER NEEDLE: Reduced from 5 to 3
            ctx.lineWidth = 3; 
            
            ctx.beginPath();
            ctx.moveTo(needleX, baselineY - 90); 
            ctx.lineTo(needleX, baselineY + 15);
            ctx.stroke();
            
            if (Math.abs(this.currentCents) < 5) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = "#47cf73";
                ctx.stroke();
                ctx.shadowBlur = 0; 
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GuitarTuner();
});