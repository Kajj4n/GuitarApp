import { UIComponent } from './UIComponent.js';
import { ActionButton } from './NavBtn.js';
import { GuitarSection } from './GuitarSection.js';
import { AudioEngine } from './AudioEngine.js';
import { MeterCanvas } from './MeterCanvas.js';
import { OverlayPage } from './OverlayPage.js';

class App {
    constructor() {
        this.appContainer = document.getElementById('app');
        
        // State
        this.selectedMode = 'Auto'; 
        this.activeTuning = []; // Populated by JSON
        this.tuningsData = [];

        // Engines
        this.audio = new AudioEngine();
        this.meter = null; // Will be set after mount

        this.init();
    }

    async init() {
        await this.loadTunings();
        this.initUI();
        
        // Start the animation loop
        this.update();

        // One-time listener to start AudioContext (browser requirement)
        document.body.addEventListener('click', () => this.audio.init(), { once: true });
    }

    async loadTunings() {
        try {
            const response = await fetch('./guitartunings.json');
            const data = await response.json();
            this.tuningsData = data.guitarTunings;
            // Default to Standard Tuning
            this.applyTuning(this.tuningsData[0]);
        } catch (e) {
            console.error("Fetch error:", e);
        }
    }

    applyTuning(tuningObj) {
        this.currentTuningName = tuningObj.name;
        
        // Update the Logic Frequencies
        this.activeTuning = tuningObj.notes.map((note, i) => ({
            note: note,
            freq: tuningObj.frequencies[i]
        }));

        // Update the Nav Button Text
        if (this.tuningBtn) {
            this.tuningBtn.element.innerHTML = `${tuningObj.name} <img src="./images/note.png" alt="note">`;
        }

        // Update the Physical Guitar Strings
        // Your old mapping: [2, 1, 0, 3, 4, 5] matches the visual order of strings
        const mapping = [2, 1, 0, 3, 4, 5]; 
        const stringButtons = document.querySelectorAll('.string-btn');
        
        stringButtons.forEach((btn, i) => {
            const tuningIndex = mapping[i];
            const noteName = this.activeTuning[tuningIndex].note;
            btn.textContent = noteName.replace(/[0-9]/g, ''); // Remove the octave number (E2 -> E)
            btn.dataset.note = noteName;
            btn.classList.remove('active');
        });

        this.selectedMode = 'Auto';
        this.audio.stopAllAudio();
    }

    initUI() {
        this.tuningMenu = new OverlayPage(
            'tune-page', 
            'Select Tuning', 
            () => {
                this.tuningMenu.hide();
                this.appContainer.classList.remove('hide-main');
            },
            'tuning-list-container', // Exact ID for list
            'close-tune-btn'         // Exact ID for button
        );

        this.chordMenu = new OverlayPage(
            'chord-page', 
            'Chord Book', 
            () => {
                this.chordMenu.hide();
                this.appContainer.classList.remove('hide-main');
            },
            'chord-list-container',
            'close-chord-btn'
        );

        // 2. Initialize the Guitar Section first
        this.guitarSection = new GuitarSection((note) => {
            if (this.selectedMode === note) {
                this.selectedMode = 'Auto';
                this.audio.stopAllAudio();
            } else {
                this.selectedMode = note;
                this.audio.playStringAudio(note);
            }
        });

        // 3. Setup Top Nav
        this.tuningBtn = new ActionButton('Standard ', 'nav-btn', './images/note.png', (e) => {
            e.stopPropagation();
            this.appContainer.classList.add('hide-main');
            this.renderTuningList();
            this.tuningMenu.show();
        });

        const topNav = new UIComponent('div', { className: 'top-nav' }, [
            this.tuningBtn
        ]);

        // Mount everything
        topNav.mount(this.appContainer);
        
        // Mount Tuner UI...
        const tunerDisplay = new UIComponent('div', { className: 'tuner-nav', innerHTML: `
            <div class="note-display-wrapper">
                <div class="note-row">
                    <div class="accidental" id="flatIcon">♭</div>
                    <div id="noteDisplay">--</div>
                    <div class="accidental" id="sharpIcon">#</div>
                </div>
                <div id="frequencyDisplay">-- HZ</div>
            </div>
            <div class="meter-wrapper">
                <canvas id="meterCanvas"></canvas>
            </div>
        `});
        tunerDisplay.mount(this.appContainer);
        
        this.guitarSection.mount(this.appContainer);
        this.tuningMenu.mount(this.appContainer);
        this.chordMenu.mount(this.appContainer);

        // Connect Canvas & Refs
        this.meter = new MeterCanvas(document.getElementById('meterCanvas'));
        this.uiNote = document.getElementById('noteDisplay');
        this.uiFreq = document.getElementById('frequencyDisplay');
    }
    update() {
        const pitch = this.audio.getPitch();

        if (pitch !== -1) {
            const detectedNoteObj = this.audio.getClosestNote(pitch, this.activeTuning);
            const targetNoteObj = this.selectedMode === 'Auto' 
                ? detectedNoteObj 
                : this.activeTuning.find(n => n.note === this.selectedMode);

            if (targetNoteObj) {
                let cents = this.audio.getCents(pitch, targetNoteObj.freq);
                
                // FIX: Clamp the cents so the needle stays on the meter!
                cents = Math.max(-50, Math.min(50, cents));

                this.uiNote.textContent = detectedNoteObj.note.replace(/[0-9]/g, '');
                this.uiFreq.textContent = `${Math.round(pitch)} HZ`;
                
                this.meter.updateCents(cents, true);
            }
        } else {
            // Hide needle when silent
            this.meter.updateCents(0, false);
        }

        requestAnimationFrame(() => this.update());
    }

    renderTuningList() {
        const container = this.tuningMenu.getContentContainer();
        container.innerHTML = ''; // Clear old list

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
                this.tuningMenu.hide();
                this.appContainer.classList.remove('hide-main');
            };
            container.appendChild(item);
        }); 
    }
}

new App();