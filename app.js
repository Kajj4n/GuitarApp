class GuitarTuner {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
        this.isRunning = false;
        
        // Timer tracking for the fade effect
        this.fadeTimeout = null;
        this.fadeInterval = null;

        this.selectedMode = 'Auto'; 

        this.standardTuning = [
            { note: 'E2', freq: 82.41 },
            { note: 'A2', freq: 110.00 },
            { note: 'D3', freq: 146.83 },
            { note: 'G3', freq: 196.00 },
            { note: 'B3', freq: 246.94 },
            { note: 'E4', freq: 329.63 }
        ];

        this.stringSounds = {
            'E2': new Audio('./audio/E-standard.mp3'),
            'A2': new Audio('./audio/A-standard.mp3'),
            'D3': new Audio('./audio/D-standard.mp3'),
            'G3': new Audio('./audio/G-standard.mp3'),
            'B3': new Audio('./audio/B-standard.mp3'),
            'E4': new Audio('./audio/Es-standard.mp3')
        };

        this.ui = {
            note: document.getElementById('noteDisplay'),
            freq: document.getElementById('frequencyDisplay'),
            canvas: document.getElementById('meterCanvas'),
            flatIcon: document.getElementById('flatIcon'),
            sharpIcon: document.getElementById('sharpIcon'),
            stringBtns: document.querySelectorAll('.string-btn'),
        };

        this.ctx = this.ui.canvas.getContext('2d');
        this.currentCents = 0;
        
        this.ui.stringBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectString(e.target));
        });

        document.body.addEventListener('click', () => {
            if (!this.isRunning) this.startTuner();
        }, { once: true });

        this.drawMeter();
    }

    selectString(btnTarget) {
        if (btnTarget.classList.contains('active')) {
            btnTarget.classList.remove('active');
            this.selectedMode = 'Auto';
            this.stopAllAudio();
            return;
        }

        this.ui.stringBtns.forEach(btn => btn.classList.remove('active'));
        btnTarget.classList.add('active');
        this.selectedMode = btnTarget.dataset.note;
        
        this.playStringAudio(this.selectedMode);
        
        if (!this.isRunning) {
            this.startTuner();
        } else {
            this.currentCents = 0; 
            this.drawMeter();
        }
    }

    playStringAudio(note) {
        this.stopAllAudio();
        const audio = this.stringSounds[note];

        if (audio) {
            audio.volume = 1.0; // Ensure it starts at full volume
            audio.play().catch(e => console.warn("Audio file missing:", note));

            // 1. Wait 2 seconds before starting the fade
            this.fadeTimeout = setTimeout(() => {
                const fadeStep = 0.05; // Amount to reduce volume each tick
                const fadeSpeed = 50;  // Milliseconds between ticks

                // 2. Start decreasing volume every 50ms
                this.fadeInterval = setInterval(() => {
                    if (audio.volume > fadeStep) {
                        audio.volume -= fadeStep;
                    } else {
                        // 3. Once quiet enough, stop everything
                        audio.volume = 0;
                        this.stopAllAudio();
                    }
                }, fadeSpeed);

            }, 2000); // Initial 2-second sustain
        }
    }

    stopAllAudio() {
        // Clear any active fade timers immediately
        clearTimeout(this.fadeTimeout);
        clearInterval(this.fadeInterval);

        Object.values(this.stringSounds).forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1.0; // Reset volume for next time it's played
        });
    }

    // ... Rest of your existing functions (startTuner, update, autoCorrelate, etc.) unchanged ...

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
            alert("Microphone access denied.");
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
            const cents = this.getCents(pitch, targetNoteObj.freq);
            this.ui.note.textContent = detectedNoteObj.note.replace(/[0-9]/g, '');
            this.ui.freq.textContent = `${Math.round(pitch)} HZ`;
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
        const edgeScale = 50; 
        const maxDrawWidth = width / 2 - 40; 
        ctx.strokeStyle = "#573737"; 
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, baselineY - 80); 
        ctx.lineTo(centerX, baselineY + 15);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.textAlign = "center";
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
            if (tick % 20 === 0) {
                ctx.fillStyle = "#000000";
                ctx.font = "bold 12px sans-serif";
                ctx.fillText(tick, centerX + offset, baselineY + 30);
                ctx.fillText(tick, centerX - offset, baselineY + 30);
            }
        });
        ctx.fillStyle = "#000000";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("-", centerX - offsetMax, baselineY - 20);
        ctx.fillText("+", centerX + offsetMax, baselineY - 20);
        if (this.isRunning) {
            const needleX = centerX + (this.currentCents / edgeScale) * maxDrawWidth;
            ctx.strokeStyle = Math.abs(this.currentCents) < 5 ? "#47cf73" : "#000000"; 
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