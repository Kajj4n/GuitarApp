class GuitarTuner {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
        this.isRunning = false;
        this.selectedMode = 'E2'; // Set default string to E

        this.standardTuning = [
            { note: 'E2', freq: 82.41 },
            { note: 'A2', freq: 110.00 },
            { note: 'D3', freq: 146.83 },
            { note: 'G3', freq: 196.00 },
            { note: 'B3', freq: 246.94 },
            { note: 'E4', freq: 329.63 }
        ];

        this.ui = {
            note: document.getElementById('noteDisplay'),
            freq: document.getElementById('frequencyDisplay'),
            canvas: document.getElementById('meterCanvas'),
            flatIcon: document.getElementById('flatIcon'),
            sharpIcon: document.getElementById('sharpIcon'),
            stringBtns: document.querySelectorAll('.string-btn'),
            standardBtn: document.querySelector('.nav-btn.active')
        };

        this.ctx = this.ui.canvas.getContext('2d');
        this.currentCents = 0;
        
        // Setup listeners for string selection
        this.ui.stringBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectString(e.target));
        });

        // Click "Standard" to reset to Auto mode if desired
        this.ui.standardBtn.addEventListener('click', () => {
            this.ui.stringBtns.forEach(b => b.classList.remove('active'));
            this.selectedMode = 'Auto';
            this.ui.note.textContent = "-";
            this.ui.freq.textContent = "-- HZ";
            if (!this.isRunning) this.startTuner();
        });

        this.drawMeter(); // Draw initial static canvas
    }

    selectString(btnTarget) {
        // Update styling
        this.ui.stringBtns.forEach(btn => btn.classList.remove('active'));
        btnTarget.classList.add('active');
        
        // Set internal state
        this.selectedMode = btnTarget.dataset.note;
        
        // Start tuner if it isn't already running
        if (!this.isRunning) {
            this.startTuner();
        } else {
            // If already running, immediately show the target note UI
            const targetNoteObj = this.standardTuning.find(n => n.note === this.selectedMode);
            this.ui.note.textContent = targetNoteObj.note.replace(/[0-9]/g, '');
            this.ui.freq.textContent = "-- HZ";
            this.currentCents = 0; // Reset needle
            this.drawMeter();
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
            alert("Microphone access denied. Please allow microphone permissions to tune.");
        }
    }

    update() {
        if (!this.isRunning) return;

        this.analyser.getFloatTimeDomainData(this.dataArray);
        const pitch = this.autoCorrelate(this.dataArray, this.audioCtx.sampleRate);

        if (pitch !== -1) {
            let targetNoteObj = this.selectedMode === 'Auto' 
                ? this.getClosestNote(pitch) 
                : this.standardTuning.find(n => n.note === this.selectedMode);

            const cents = this.getCents(pitch, targetNoteObj.freq);
            
            if (this.selectedMode === 'Auto' || Math.abs(cents) < 1200) {
                this.ui.note.textContent = targetNoteObj.note.replace(/[0-9]/g, '');
                this.ui.freq.textContent = `${Math.round(pitch)} HZ`;
                
                this.currentCents = Math.max(-100, Math.min(100, cents));

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

    // We set a 'baseline' for the ticks. 
    // This leaves just enough room for numbers below and the needle above.
    const baselineY = height - 45; 
    const centerX = width / 2;

    ctx.lineCap = "round"; 
    ctx.lineJoin = "round";

    // --- Spread & Scale Logic ---
    const edgeScale = 78; 
    const maxDrawWidth = width / 2 - 40; 

    // 2. Draw Taller Center Tick (Target)
    // Height: From baseline - 90px to baseline + 15px
    ctx.strokeStyle = "#573737"; 
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, baselineY - 80); 
    ctx.lineTo(centerX, baselineY + 15);
    ctx.stroke();

    // 3. Draw Side Ticks and Numbers
    ctx.lineWidth = 2;
    ctx.textAlign = "center";

    const ticks = [20, 40, 60, 80];
    let offset80 = 0; 

    ticks.forEach(tick => {
        const offset = (tick / edgeScale) * maxDrawWidth;
        if (tick === 80) offset80 = offset;
        
        // Draw Ticks (Burgundy)
        ctx.strokeStyle = "#573737";
        ctx.beginPath();
        ctx.moveTo(centerX + offset, baselineY - 5);
        ctx.lineTo(centerX + offset, baselineY + 10);
        ctx.moveTo(centerX - offset, baselineY - 5);
        ctx.lineTo(centerX - offset, baselineY + 10);
        ctx.stroke();

        // Draw Numbers (Black)
        ctx.fillStyle = "#000000";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(tick, centerX + offset, baselineY + 30);
        ctx.fillText(tick, centerX - offset, baselineY + 30);
    });

    // 4. Position +/- Signs (Black, directly above the 80 ticks)
    ctx.fillStyle = "#000000";
    ctx.font = "bold 20px sans-serif";
    // Placed higher up the needle's length
    ctx.fillText("-", centerX - offset80, baselineY - 20);
    ctx.fillText("+", centerX + offset80, baselineY - 20);

    // 5. Draw Dynamic Needle
    if (this.isRunning) {
        const needleX = centerX + (this.currentCents / edgeScale) * maxDrawWidth;
        
        ctx.strokeStyle = Math.abs(this.currentCents) < 5 ? "#47cf73" : "#573737"; 
        ctx.lineWidth = 5; 
        
        ctx.beginPath();
        // Needle top and bottom now match the Target line perfectly
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