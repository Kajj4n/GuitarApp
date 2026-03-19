class GuitarTuner {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
        this.isRunning = false;
        this.fadeTimeout = null;
        this.fadeInterval = null;
        this.currentAudio = null;

        this.selectedMode = 'Auto'; // Can be 'Auto' or a specific note like 'E2'
        this.currentTuningName = "Standard";
        this.tuningsData = []; // Loaded from JSON
        
        // This will hold the active notes/freqs for the current tuning
        this.activeTuning = []; 

        this.ui = {
            note: document.getElementById('noteDisplay'),
            freq: document.getElementById('frequencyDisplay'),
            canvas: document.getElementById('meterCanvas'),
            stringBtns: document.querySelectorAll('.string-btn'),
            appContainer: document.getElementById('app'),
            tunePage: document.getElementById('tune-page'),
            openTuneBtn: document.getElementById('open-tune-btn'),
            closeTuneBtn: document.getElementById('close-tune-btn'),
            tuningList: document.getElementById('tuning-list-container')
        };

        this.ctx = this.ui.canvas.getContext('2d');
        this.currentCents = 0;

        this.init();
    }

    async init() {
        await this.loadTunings();
        this.setupEventListeners();
        this.drawMeter();
    }

    async loadTunings() {
        try {
            const response = await fetch('./guitartunings.json');
            const data = await response.json();
            this.tuningsData = data.guitarTunings;
            // Set default to Standard
            this.applyTuning(this.tuningsData[0]);
            this.renderTuningList();
        } catch (e) {
            console.error("Failed to load tunings:", e);
        }
    }

    setupEventListeners() {
        this.ui.stringBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectString(e.target));
        });

        if (this.ui.openTuneBtn) {
            this.ui.openTuneBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.ui.appContainer.classList.add('hide-main');
                this.ui.tunePage.classList.add('active');
            });
        }

        if (this.ui.closeTuneBtn) {
            this.ui.closeTuneBtn.addEventListener('click', () => {
                this.ui.appContainer.classList.remove('hide-main');
                this.ui.tunePage.classList.remove('active');
            });
        }

        document.body.addEventListener('click', () => {
            if (!this.isRunning) this.startTuner();
        }, { once: true });
    }

    renderTuningList() {
        this.ui.tuningList.innerHTML = '';
        this.tuningsData.forEach(t => {
            const item = document.createElement('div');
            item.className = `tuning-item ${t.name === this.currentTuningName ? 'selected' : ''}`;
            item.innerHTML = `
                <div class="tuning-info">
                    <span class="tuning-name">${t.name}</span>
                    <span class="tuning-notes">${t.notes.join(' ')}</span>
                </div>
                <div class="radio-circle"></div>
            `;
            item.onclick = () => {
                this.applyTuning(t);
                this.renderTuningList(); // Refresh selection UI
                this.ui.closeTuneBtn.click(); // Close page
            };
            this.ui.tuningList.appendChild(item);
        });
    }

    applyTuning(tuningObj) {
        this.currentTuningName = tuningObj.name;
        this.activeTuning = tuningObj.notes.map((note, i) => ({
            note: note,
            freq: tuningObj.frequencies[i]
        }));

        // Update Nav Button Text
        this.ui.openTuneBtn.innerHTML = `${tuningObj.name} <img src="./images/note.png" alt="note">`;

        // Update Guitar String Buttons
        // Indices: 0=E(low), 1=A, 2=D, 3=G, 4=B, 5=E(high)
        // Mapping to HTML layout (Left col: index 2,1,0 | Right col: 3,4,5)
        const mapping = [2, 1, 0, 3, 4, 5]; 
        this.ui.stringBtns.forEach((btn, i) => {
            const tuningIndex = mapping[i];
            const noteName = this.activeTuning[tuningIndex].note;
            btn.textContent = noteName.replace(/[0-9]/g, ''); // Remove octave number for display
            btn.dataset.note = noteName;
            btn.classList.remove('active');
        });

        this.selectedMode = 'Auto';
        this.stopAllAudio();
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
        
        // Note: For actual audio files per tuning, you'd need the specific mp3 paths 
        // linked in your JSON. For now, this uses existing play logic.
        this.playStringAudio(this.selectedMode);
    }

    // ... Keeping your existing audio, correlation, and draw logic ...
    
    playStringAudio(note) {
        this.stopAllAudio();
        
        // Keeping your exact pathing requirement
        this.currentAudio = new Audio(`./audio/${note}-standard.mp3`); 

        this.currentAudio.volume = 1.0;
        this.currentAudio.play().catch(() => console.warn("Audio not found for", note));

        this.fadeTimeout = setTimeout(() => {
            this.fadeInterval = setInterval(() => {
                if (this.currentAudio && this.currentAudio.volume > 0.05) {
                    this.currentAudio.volume -= 0.05;
                } else {
                    this.stopAllAudio();
                }
            }, 50);
        }, 2000);
    }

    stopAllAudio() {
        clearTimeout(this.fadeTimeout);
        clearInterval(this.fadeInterval);
        
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
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
            console.error("Microphone access denied.");
        }
    }

    update() {
        if (!this.isRunning) return;
        this.analyser.getFloatTimeDomainData(this.dataArray);
        const pitch = this.autoCorrelate(this.dataArray, this.audioCtx.sampleRate);
        
        if (pitch !== -1) {
            const detectedNoteObj = this.getClosestNote(pitch);
            
            // Logic change: Compare against the ACTIVE tuning notes
            const targetNoteObj = this.selectedMode === 'Auto' 
                ? detectedNoteObj 
                : this.activeTuning.find(n => n.note === this.selectedMode);

            if (targetNoteObj) {
                const cents = this.getCents(pitch, targetNoteObj.freq);
                this.ui.note.textContent = detectedNoteObj.note.replace(/[0-9]/g, '');
                this.ui.freq.textContent = `${Math.round(pitch)} HZ`;
                this.currentCents = Math.max(-50, Math.min(50, cents));
            }
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
        // Always compare against standard notes to detect what note the user is "hitting"
        return this.activeTuning.reduce((prev, curr) => {
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
        const edgeScale = 50; 
        const maxDrawWidth = width / 2 - 40; 

        // Center line
        ctx.strokeStyle = "#573737"; 
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, baselineY - 80); 
        ctx.lineTo(centerX, baselineY + 15);
        ctx.stroke();

        // Ticks
        const ticks = [10, 20, 30, 40, 50];
        ticks.forEach(tick => {
            const offset = (tick / edgeScale) * maxDrawWidth;
            ctx.beginPath();
            ctx.moveTo(centerX + offset, baselineY - 5);
            ctx.lineTo(centerX + offset, baselineY + 10);
            ctx.moveTo(centerX - offset, baselineY - 5);
            ctx.lineTo(centerX - offset, baselineY + 10);
            ctx.stroke();
        });

        if (this.isRunning) {
            const needleX = centerX + (this.currentCents / edgeScale) * maxDrawWidth;
            ctx.strokeStyle = Math.abs(this.currentCents) < 5 ? "#47cf73" : "#000000"; 
            ctx.lineWidth = 3; 
            ctx.beginPath();
            ctx.moveTo(needleX, baselineY - 90); 
            ctx.lineTo(needleX, baselineY + 15);
            ctx.stroke();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GuitarTuner();
});