// OverlayPage.js
import { UIComponent } from './UIComponent.js';

export class OverlayPage extends UIComponent {
    constructor(id, title, onClose, contentId, closeBtnId) {
        super('div', { id: id });
        
        this.element.innerHTML = `
            <nav id="return-nav">
                <button id="${closeBtnId}"><</button>
                <h2>${title}</h2>
            </nav>
            <div id="${contentId}"></div>
        `;

        this.element.querySelector(`#${closeBtnId}`).onclick = onClose;
    }

    getContentContainer() {
        // Find the specific container by the ID 
        return this.element.querySelector('div[id$="-container"]');
    }

    show() { this.element.classList.add('active'); }
    hide() { this.element.classList.remove('active'); }
}