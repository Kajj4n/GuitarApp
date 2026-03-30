import { UIComponent } from './UIComponent.js';
import { ActionButton } from './NavBtn.js';

export class GuitarSection extends UIComponent {
    constructor(onStringClick) {
        // Call parent constructor to create the main wrapper div
        super('div', { className: 'guitar-section' });

        this.onStringClick = onStringClick; // Callback for when a string is clicked
        this.stringButtons = []; // Keep track of buttons to manage 'active' states

        this.buildSection();
    }

    buildSection() {
        // 1. Left Strings Column
        const leftStrings = new UIComponent('div', { className: 'strings-col left-strings' }, [
            this.createStringBtn('D', 'D3'),
            this.createStringBtn('A', 'A2'),
            this.createStringBtn('E', 'E2')
        ]);

        // 2. Guitar Head Image
        const headWrapper = new UIComponent('div', { className: 'guitar-head-wrapper' }, [
            new UIComponent('img', { src: './images/guitarhead.png', alt: 'Guitar Head' })
        ]);

        // 3. Right Strings Column
        const rightStrings = new UIComponent('div', { className: 'strings-col right-strings' }, [
            this.createStringBtn('G', 'G3'),
            this.createStringBtn('B', 'B3'),
            this.createStringBtn('E', 'E4')
        ]);

        // Append all three columns to this main component
        this.element.appendChild(leftStrings.element);
        this.element.appendChild(headWrapper.element);
        this.element.appendChild(rightStrings.element);
    }

    createStringBtn(label, noteValue) {
        const btn = new ActionButton(label, 'string-btn', null, (e) => {
            const currentNote = btn.element.dataset.note;
            this.handleStringSelection(btn.element, currentNote);
        });
        
        // Store initial data-note attribute
        btn.element.dataset.note = noteValue;
        this.stringButtons.push(btn.element);
        
        return btn;
    }

    handleStringSelection(clickedNode, noteValue) {
        const wasActive = clickedNode.classList.contains('active');
        
        // Clear all
        this.stringButtons.forEach(b => b.classList.remove('active'));
        
        if (!wasActive) {
            clickedNode.classList.add('active');
            if (this.onStringClick) this.onStringClick(noteValue);
        } else {
            // If we clicked an active button, go back to Auto
            if (this.onStringClick) this.onStringClick('Auto');
        }
    }
}